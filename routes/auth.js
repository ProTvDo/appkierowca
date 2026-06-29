const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const supabase = require('../supabaseClient');

const router = express.Router();

// ── POST /api/auth/login ──────────────────────────────────
// Body: { nr_sluzbowy: "2669", pin: "1234" }
router.post('/login', async (req, res) => {
  const { nr_sluzbowy, pin } = req.body;

  if (!nr_sluzbowy || !pin) {
    return res.status(400).json({ error: 'Podaj numer służbowy i PIN' });
  }

  // Szukaj kierowcy w bazie
  const { data: kierowca, error } = await supabase
    .from('kierowcy')
    .select('id, nr_sluzbowy, imie, nazwisko, pin_hash, aktywny, zajezdnia_id')
    .eq('nr_sluzbowy', nr_sluzbowy)
    .single();

  if (error || !kierowca) {
    return res.status(401).json({ error: 'Nieprawidłowy numer służbowy lub PIN' });
  }

  if (!kierowca.aktywny) {
    return res.status(403).json({ error: 'Konto nieaktywne. Skontaktuj się z dyspozytornią.' });
  }

  // Sprawdź PIN
  const pinOk = await bcrypt.compare(pin, kierowca.pin_hash);
  if (!pinOk) {
    return res.status(401).json({ error: 'Nieprawidłowy numer służbowy lub PIN' });
  }

  // Generuj token JWT (ważny 12 godzin — jedna zmiana)
  const token = jwt.sign(
    {
      id:          kierowca.id,
      nr_sluzbowy: kierowca.nr_sluzbowy,
      imie:        kierowca.imie,
      nazwisko:    kierowca.nazwisko,
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    token,
    kierowca: {
      id:          kierowca.id,
      nr_sluzbowy: kierowca.nr_sluzbowy,
      imie:        kierowca.imie,
      nazwisko:    kierowca.nazwisko,
    }
  });
});

// ── POST /api/auth/zmien-pin ──────────────────────────────
// Body: { stary_pin: "1234", nowy_pin: "5678" }
router.post('/zmien-pin', require('../middleware/auth'), async (req, res) => {
  const { stary_pin, nowy_pin } = req.body;
  const kierowcaId = req.kierowca.id;

  if (!stary_pin || !nowy_pin || nowy_pin.length !== 4 || !/^\d{4}$/.test(nowy_pin)) {
    return res.status(400).json({ error: 'PIN musi mieć dokładnie 4 cyfry' });
  }

  // Pobierz aktualny hash
  const { data: kierowca } = await supabase
    .from('kierowcy')
    .select('pin_hash')
    .eq('id', kierowcaId)
    .single();

  const staryOk = await bcrypt.compare(stary_pin, kierowca.pin_hash);
  if (!staryOk) {
    return res.status(401).json({ error: 'Stary PIN jest nieprawidłowy' });
  }

  const nowyHash = await bcrypt.hash(nowy_pin, 10);
  await supabase.from('kierowcy').update({ pin_hash: nowyHash }).eq('id', kierowcaId);

  res.json({ ok: true, message: 'PIN zmieniony pomyślnie' });
});

module.exports = router;
