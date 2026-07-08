const express    = require('express');
const supabase   = require('../supabaseClient');
const authMW     = require('../middleware/auth');
const nodemailer = require('nodemailer');

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

const POLA = 'id, data, cel_podrozy, godz_wyjazdu, godz_podstawienia, godz_dojazdu, kilometry, pilot_imie_nazwisko, pilot_telefon, nr_rejestracyjny, marka_model, nr_boczny, dodatkowe_info, zaliczka, zakonczony';

// ── GET /api/wyjazdy ──────────────────────────────────────
// Lista wyjazdów zalogowanego kierowcy, najbliższe na górze
router.get('/', authMW, async (req, res) => {
  const kierowcaId = req.kierowca.id;

  const { data, error } = await supabase
    .from('wyjazdy_turystyczne')
    .select(POLA)
    .eq('kierowca_id', kierowcaId)
    .order('data', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── GET /api/wyjazdy/najblizszy ───────────────────────────
// Najbliższy nadchodzący wyjazd — używane na ekranie głównym
router.get('/najblizszy', authMW, async (req, res) => {
  const kierowcaId = req.kierowca.id;
  const dzisiaj = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('wyjazdy_turystyczne')
    .select(POLA)
    .eq('kierowca_id', kierowcaId)
    .gte('data', dzisiaj)
    .order('data', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── POST /api/wyjazdy/:id/zaliczka ────────────────────────
// Body: { zaliczka }
router.post('/:id/zaliczka', authMW, async (req, res) => {
  const { id } = req.params;
  const { zaliczka } = req.body;
  const kierowcaId = req.kierowca.id;

  const { data, error } = await supabase
    .from('wyjazdy_turystyczne')
    .update({ zaliczka })
    .eq('id', id)
    .eq('kierowca_id', kierowcaId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
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

  // Upewnij się, że wyjazd należy do zalogowanego kierowcy
  const { data: wyjazd } = await supabase
    .from('wyjazdy_turystyczne')
    .select('id')
    .eq('id', id)
    .eq('kierowca_id', kierowcaId)
    .maybeSingle();

  if (!wyjazd) return res.status(404).json({ error: 'Wyjazd nie znaleziony' });

  const { data, error } = await supabase
    .from('tankowania')
    .insert({ wyjazd_id: id, litry, koszt })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ── GET /api/wyjazdy/:id/tankowania ───────────────────────
router.get('/:id/tankowania', authMW, async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('tankowania')
    .select('id, litry, koszt, created_at')
    .eq('wyjazd_id', id)
    .order('created_at');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── POST /api/wyjazdy/:id/zakoncz ─────────────────────────
// Oznacza wyjazd jako zakończony i wysyła mailem podsumowanie do biura
router.post('/:id/zakoncz', authMW, async (req, res) => {
  const { id } = req.params;
  const kierowcaId = req.kierowca.id;

  const { data: wyjazd, error: eWyjazd } = await supabase
    .from('wyjazdy_turystyczne')
    .update({ zakonczony: true })
    .eq('id', id)
    .eq('kierowca_id', kierowcaId)
    .select(`${POLA}, kierowcy ( imie, nazwisko )`)
    .single();

  if (eWyjazd || !wyjazd) return res.status(404).json({ error: 'Wyjazd nie znaleziony' });

  const { data: tankowania } = await supabase
    .from('tankowania')
    .select('litry, koszt, created_at')
    .eq('wyjazd_id', id)
    .order('created_at');

  const sumaLitrow = (tankowania || []).reduce((s, t) => s + Number(t.litry), 0);
  const sumaKosztow = (tankowania || []).reduce((s, t) => s + Number(t.koszt), 0);

  const emailTo = process.env.EMAIL_BIURO || process.env.SMTP_USER;
  if (emailTo && process.env.SMTP_USER) {
    try {
      const wierszeTankowan = (tankowania || [])
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
    } catch (emailErr) {
      console.error('Błąd wysyłki e-mail z podsumowaniem wyjazdu:', emailErr.message);
      // nie przerywamy — wyjazd i tak jest oznaczony jako zakończony
    }
  }

  res.json({ ok: true, wyjazd, tankowania: tankowania || [], suma_litrow: sumaLitrow, suma_kosztow: sumaKosztow });
});

module.exports = router;
