const express    = require('express');
const supabase   = require('../supabaseClient');
const authMW     = require('../middleware/auth');
const nodemailer = require('nodemailer');

const router = express.Router();

// Konfiguracja e-mail — ustaw w .env
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

  const { data, error } = await supabase
    .from('usterki')
    .select(`
      id, opis, lokalizacja, status, zdjecie_url, created_at,
      pojazdy ( nr_boczny, marka, model ),
      kategorie_usterek ( nazwa, ikona )
    `)
    .eq('kierowca_id', kierowcaId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── POST /api/usterki ────────────────────────────────────
// Zgłoś nową usterkę
router.post('/', authMW, async (req, res) => {
  const { pojazd_id, kategoria_id, opis, lokalizacja } = req.body;
  const kierowcaId = req.kierowca.id;

  if (!pojazd_id || !kategoria_id) {
    return res.status(400).json({ error: 'Podaj pojazd i kategorię usterki' });
  }

  // Zapisz usterkę
  const { data: usterka, error } = await supabase
    .from('usterki')
    .insert({
      kierowca_id:  kierowcaId,
      pojazd_id,
      kategoria_id,
      opis,
      lokalizacja,
      status: 'nowa'
    })
    .select(`
      id,
      pojazdy ( nr_boczny, marka, model ),
      kategorie_usterek ( nazwa, ikona ),
      kierowcy ( imie, nazwisko, nr_sluzbowy )
    `)
    .single();

  if (error) return res.status(500).json({ error: error.message });

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

      await supabase.from('usterki').update({ email_wyslany: true }).eq('id', usterka.id);
    } catch (emailErr) {
      console.error('Błąd wysyłki e-mail:', emailErr.message);
      // nie przerywamy — usterka zapisana, tylko mail nie poszedł
    }
  }

  res.status(201).json({ ok: true, usterka });
});

// ── GET /api/usterki/kategorie ───────────────────────────
router.get('/kategorie', authMW, async (req, res) => {
  const { data, error } = await supabase
    .from('kategorie_usterek')
    .select('*')
    .order('id');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
