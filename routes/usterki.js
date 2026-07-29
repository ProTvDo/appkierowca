const express    = require('express');
const db         = require('../db');
const authMW     = require('../middleware/auth');
const nodemailer = require('nodemailer');

const router = express.Router();

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
});

// ── GET /api/usterki ─────────────────────────────────────
// Historia usterek zalogowanego kierowcy
router.get('/', authMW, async (req, res) => {
  const kierowcaId = req.kierowca.id;

  try {
    const { rows } = await db.query(
      `SELECT u.id, u.opis, u.lokalizacja, u.status, u.zdjecie_url, u.created_at,
              p.nr_boczny, p.marka, p.model,
              k.nazwa AS kategoria_nazwa, k.ikona AS kategoria_ikona
       FROM usterki u
       LEFT JOIN pojazdy p ON p.id = u.pojazd_id
       LEFT JOIN kategorie_usterek k ON k.id = u.kategoria_id
       WHERE u.kierowca_id = $1
       ORDER BY u.created_at DESC`,
      [kierowcaId]
    );

    const wynik = rows.map(r => ({
      id: r.id, opis: r.opis, lokalizacja: r.lokalizacja, status: r.status,
      zdjecie_url: r.zdjecie_url, created_at: r.created_at,
      pojazdy: r.nr_boczny ? { nr_boczny: r.nr_boczny, marka: r.marka, model: r.model } : null,
      kategorie_usterek: r.kategoria_nazwa ? { nazwa: r.kategoria_nazwa, ikona: r.kategoria_ikona } : null,
    }));

    res.json(wynik);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/usterki ────────────────────────────────────
// Zgłoś nową usterkę
router.post('/', authMW, async (req, res) => {
  const { pojazd_id, kategoria_id, opis, lokalizacja } = req.body;
  const kierowcaId = req.kierowca.id;

  if (!pojazd_id || !kategoria_id) {
    return res.status(400).json({ error: 'Podaj pojazd i kategorię usterki' });
  }

  let usterka;
  try {
    const { rows: usterkiRows } = await db.query(
      `INSERT INTO usterki (kierowca_id, pojazd_id, kategoria_id, opis, lokalizacja, status)
       VALUES ($1, $2, $3, $4, $5, 'nowa')
       RETURNING id`,
      [kierowcaId, pojazd_id, kategoria_id, opis, lokalizacja]
    );
    const id = usterkiRows[0].id;

    const { rows } = await db.query(
      `SELECT u.id, p.nr_boczny, p.marka, p.model, k.nazwa AS kategoria_nazwa, k.ikona AS kategoria_ikona,
              d.imie, d.nazwisko, d.nr_sluzbowy
       FROM usterki u
       LEFT JOIN pojazdy p ON p.id = u.pojazd_id
       LEFT JOIN kategorie_usterek k ON k.id = u.kategoria_id
       LEFT JOIN kierowcy d ON d.id = u.kierowca_id
       WHERE u.id = $1`,
      [id]
    );
    const r = rows[0];
    usterka = {
      id: r.id,
      pojazdy: { nr_boczny: r.nr_boczny, marka: r.marka, model: r.model },
      kategorie_usterek: { nazwa: r.kategoria_nazwa, ikona: r.kategoria_ikona },
      kierowcy: { imie: r.imie, nazwisko: r.nazwisko, nr_sluzbowy: r.nr_sluzbowy },
    };
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  // Wyślij e-mail do mistrza
  const emailTo = process.env.EMAIL_MISTRZ || process.env.SMTP_USER;
  if (emailTo && process.env.SMTP_USER) {
    try {
      const k = usterka.kierowcy;
      const p = usterka.pojazdy;
      const kat = usterka.kategorie_usterek;

      await transporter.sendMail({
        from:    `"KierowcaApp" <${process.env.SMTP_USER}>`,
        to:      emailTo,
        subject: `🔧 Nowa usterka — pojazd ${p.nr_boczny} — ${kat.nazwa}`,
        html: `
          <h2>Nowe zgłoszenie usterki</h2>
          <table style="border-collapse:collapse;font-family:Arial,sans-serif;">
            <tr><td style="padding:6px 12px;color:#666">Kierowca:</td>
                <td style="padding:6px 12px;font-weight:bold">${k.imie} ${k.nazwisko} (nr ${k.nr_sluzbowy})</td></tr>
            <tr><td style="padding:6px 12px;color:#666">Pojazd:</td>
                <td style="padding:6px 12px;font-weight:bold">${p.nr_boczny} · ${p.marka} ${p.model}</td></tr>
            <tr><td style="padding:6px 12px;color:#666">Kategoria:</td>
                <td style="padding:6px 12px">${kat.ikona} ${kat.nazwa}</td></tr>
            <tr><td style="padding:6px 12px;color:#666">Opis:</td>
                <td style="padding:6px 12px">${opis || '—'}</td></tr>
            <tr><td style="padding:6px 12px;color:#666">Lokalizacja:</td>
                <td style="padding:6px 12px">${lokalizacja || '—'}</td></tr>
            <tr><td style="padding:6px 12px;color:#666">Data:</td>
                <td style="padding:6px 12px">${new Date().toLocaleString('pl-PL')}</td></tr>
          </table>
        `
      });

      await db.query('UPDATE usterki SET email_wyslany = true WHERE id = $1', [usterka.id]);
    } catch (emailErr) {
      console.error('Błąd wysyłki e-mail:', emailErr.message);
    }
  }

  res.status(201).json({ ok: true, usterka });
});

// ── GET /api/usterki/kategorie ───────────────────────────
router.get('/kategorie', authMW, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM kategorie_usterek ORDER BY id');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
