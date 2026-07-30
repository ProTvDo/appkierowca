const express    = require('express');
const db         = require('../db');
const authMW     = require('../middleware/auth');
const nodemailer = require('nodemailer');
const { adresatFirmy } = require('../lib/adresaci');

const router = express.Router();

// Konfiguracja e-mail — ten sam wzorzec co w routes/usterki.js
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
});

const POLA = `id, data, cel_podrozy, godz_wyjazdu, godz_podstawienia, godz_dojazdu, kilometry,
  pilot_imie_nazwisko, pilot_telefon, nr_rejestracyjny, marka_model, nr_boczny, dodatkowe_info,
  zaliczka, zakonczony, punkty_postojowe, nocleg, wyzywienie, oplaty_drogowe, winiety_oplacone,
  ograniczenia_trasy, wielkosc_grupy`;

// ── GET /api/wyjazdy ──────────────────────────────────────
// Lista wyjazdów zalogowanego kierowcy, najbliższe na górze
router.get('/', authMW, async (req, res) => {
  const kierowcaId = req.kierowca.id;

  try {
    const { rows } = await db.query(
      `SELECT ${POLA} FROM wyjazdy_turystyczne WHERE kierowca_id = $1 ORDER BY data ASC`,
      [kierowcaId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/wyjazdy/najblizszy ───────────────────────────
// Najbliższy nadchodzący wyjazd — używane na ekranie głównym
router.get('/najblizszy', authMW, async (req, res) => {
  const kierowcaId = req.kierowca.id;
  const dzisiaj = new Date().toISOString().split('T')[0];

  try {
    const { rows } = await db.query(
      `SELECT ${POLA} FROM wyjazdy_turystyczne
       WHERE kierowca_id = $1 AND data >= $2
       ORDER BY data ASC LIMIT 1`,
      [kierowcaId, dzisiaj]
    );
    res.json(rows[0] || null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/wyjazdy/:id/zaliczka ────────────────────────
// Body: { zaliczka }
router.post('/:id/zaliczka', authMW, async (req, res) => {
  const { id } = req.params;
  const { zaliczka } = req.body;
  const kierowcaId = req.kierowca.id;

  try {
    const { rows } = await db.query(
      `UPDATE wyjazdy_turystyczne SET zaliczka = $1
       WHERE id = $2 AND kierowca_id = $3
       RETURNING ${POLA}`,
      [zaliczka, id, kierowcaId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Wyjazd nie znaleziony' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/wyjazdy/:id/tankowanie ──────────────────────
// Body: { litry, koszt }
router.post('/:id/tankowanie', authMW, async (req, res) => {
  const { id } = req.params;
  const { litry, koszt } = req.body;
  const kierowcaId = req.kierowca.id;

  if (!litry || !koszt) {
    return res.status(400).json({ error: 'Podaj litry i koszt' });
  }

  try {
    // Upewnij się, że wyjazd należy do zalogowanego kierowcy
    const { rows: wyjazdRows } = await db.query(
      `SELECT id FROM wyjazdy_turystyczne WHERE id = $1 AND kierowca_id = $2`,
      [id, kierowcaId]
    );
    if (wyjazdRows.length === 0) return res.status(404).json({ error: 'Wyjazd nie znaleziony' });

    const { rows } = await db.query(
      `INSERT INTO tankowania (wyjazd_id, litry, koszt) VALUES ($1, $2, $3) RETURNING *`,
      [id, litry, koszt]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/wyjazdy/:id/tankowania ───────────────────────
router.get('/:id/tankowania', authMW, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `SELECT id, litry, koszt, created_at FROM tankowania WHERE wyjazd_id = $1 ORDER BY created_at`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/wyjazdy/:id/zakoncz ─────────────────────────
// Oznacza wyjazd jako zakończony i wysyła mailem podsumowanie do biura
router.post('/:id/zakoncz', authMW, async (req, res) => {
  const { id } = req.params;
  const kierowcaId = req.kierowca.id;

  let wyjazd, tankowania;
  try {
    const { rows: updRows } = await db.query(
      `UPDATE wyjazdy_turystyczne SET zakonczony = true
       WHERE id = $1 AND kierowca_id = $2
       RETURNING ${POLA}`,
      [id, kierowcaId]
    );
    if (updRows.length === 0) return res.status(404).json({ error: 'Wyjazd nie znaleziony' });

    const { rows: kierowcyRows } = await db.query(
      `SELECT imie, nazwisko FROM kierowcy WHERE id = $1`,
      [kierowcaId]
    );

    wyjazd = { ...updRows[0], kierowcy: kierowcyRows[0] || null };

    const { rows: tankRows } = await db.query(
      `SELECT litry, koszt, created_at FROM tankowania WHERE wyjazd_id = $1 ORDER BY created_at`,
      [id]
    );
    tankowania = tankRows;
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const sumaLitrow = tankowania.reduce((s, t) => s + Number(t.litry), 0);
  const sumaKosztow = tankowania.reduce((s, t) => s + Number(t.koszt), 0);

  // Kierowca musi wiedzieć, czy biuro naprawdę dostało podsumowanie. Bez tego
  // aplikacja pokazywała "mail wysłany do biura" także wtedy, gdy poczta nie
  // była skonfigurowana i nic nie wychodziło.
  let emailWyslany = false;
  let emailBlad = null;

  // Adresat należy do firmy kierowcy — nie jest wspólny dla całej aplikacji.
  const { adres: emailTo, powod } = await adresatFirmy(req.kierowca.firma_id, 'biuro');
  if (!emailTo) {
    emailBlad = powod;
  } else {
    try {
      const wierszeTankowan = tankowania
        .map(t => `<tr><td style="padding:4px 12px">${new Date(t.created_at).toLocaleString('pl-PL')}</td><td style="padding:4px 12px">${t.litry} l</td><td style="padding:4px 12px">${t.koszt} zł</td></tr>`)
        .join('');

      await transporter.sendMail({
        from:    `"KierowcaApp" <${process.env.SMTP_USER}>`,
        to:      emailTo,
        subject: `🧳 Podsumowanie wyjazdu — ${wyjazd.cel_podrozy} (${wyjazd.kierowcy?.imie} ${wyjazd.kierowcy?.nazwisko})`,
        html: `
          <h2>Wyjazd zakończony</h2>
          <table style="border-collapse:collapse;font-family:Arial,sans-serif;">
            <tr><td style="padding:6px 12px;color:#666">Kierowca:</td>
                <td style="padding:6px 12px;font-weight:bold">${wyjazd.kierowcy?.imie} ${wyjazd.kierowcy?.nazwisko}</td></tr>
            <tr><td style="padding:6px 12px;color:#666">Cel podróży:</td>
                <td style="padding:6px 12px;font-weight:bold">${wyjazd.cel_podrozy}</td></tr>
            <tr><td style="padding:6px 12px;color:#666">Data:</td>
                <td style="padding:6px 12px">${wyjazd.data}</td></tr>
            <tr><td style="padding:6px 12px;color:#666">Pojazd:</td>
                <td style="padding:6px 12px">${wyjazd.nr_rejestracyjny || '—'} · ${wyjazd.marka_model || '—'}</td></tr>
            <tr><td style="padding:6px 12px;color:#666">Zaliczka pobrana:</td>
                <td style="padding:6px 12px">${wyjazd.zaliczka != null ? wyjazd.zaliczka + ' zł' : '—'}</td></tr>
          </table>
          <h3 style="margin-top:16px">Tankowania (razem ${sumaLitrow.toFixed(2)} l, ${sumaKosztow.toFixed(2)} zł)</h3>
          <table style="border-collapse:collapse;font-family:Arial,sans-serif;">
            <tr><th style="padding:4px 12px;text-align:left">Data</th><th style="padding:4px 12px;text-align:left">Litry</th><th style="padding:4px 12px;text-align:left">Koszt</th></tr>
            ${wierszeTankowan || '<tr><td style="padding:4px 12px" colspan="3">Brak tankowań</td></tr>'}
          </table>
        `
      });
      emailWyslany = true;
    } catch (emailErr) {
      console.error('Błąd wysyłki e-mail z podsumowaniem wyjazdu:', emailErr.message);
      emailBlad = emailErr.message;
      // nie przerywamy — wyjazd i tak jest oznaczony jako zakończony
    }
  }

  res.json({
    ok: true, wyjazd, tankowania,
    suma_litrow: sumaLitrow, suma_kosztow: sumaKosztow,
    email_wyslany: emailWyslany,
    email_blad: emailBlad,
  });
});

module.exports = router;
