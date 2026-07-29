const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');

const router = express.Router();

// ── POST /api/auth/login ──────────────────────────────────
// Body: { nr_sluzbowy: "2669", pin: "1234" }
router.post('/login', async (req, res) => {
  const { nr_sluzbowy, pin } = req.body;

  if (!nr_sluzbowy || !pin) {
    return res.status(400).json({ error: 'Podaj numer służbowy i PIN' });
  }

  let kierowca;
  try {
    const { rows } = await db.query(
      `SELECT id, nr_sluzbowy, imie, nazwisko, pin_hash, aktywny, zajezdnia_id, wersja, firma, rola
       FROM kierowcy WHERE nr_sluzbowy = $1`,
      [nr_sluzbowy]
    );
    kierowca = rows[0];
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  if (!kierowca) {
    return res.status(401).json({ error: 'Nieprawidłowy numer służbowy lub PIN' });
  }

  if (!kierowca.aktywny) {
    return res.status(403).json({ error: 'Konto nieaktywne. Skontaktuj się z dyspozytornią.' });
  }

  const pinOk = await bcrypt.compare(pin, kierowca.pin_hash);
  if (!pinOk) {
    return res.status(401).json({ error: 'Nieprawidłowy numer służbowy lub PIN' });
  }

  const token = jwt.sign(
    {
      id:          kierowca.id,
      nr_sluzbowy: kierowca.nr_sluzbowy,
      imie:        kierowca.imie,
      nazwisko:    kierowca.nazwisko,
      rola:        kierowca.rola,
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
      wersja:      kierowca.wersja,
      firma:       kierowca.firma,
      rola:        kierowca.rola,
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

  const { rows } = await db.query('SELECT pin_hash FROM kierowcy WHERE id = $1', [kierowcaId]);
  const kierowca = rows[0];

  const staryOk = await bcrypt.compare(stary_pin, kierowca.pin_hash);
  if (!staryOk) {
    return res.status(401).json({ error: 'Stary PIN jest nieprawidłowy' });
  }

  const nowyHash = await bcrypt.hash(nowy_pin, 10);
  await db.query('UPDATE kierowcy SET pin_hash = $1 WHERE id = $2', [nowyHash, kierowcaId]);

  res.json({ ok: true, message: 'PIN zmieniony pomyślnie' });
});

module.exports = router;
