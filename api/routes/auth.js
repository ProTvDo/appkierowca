const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');

const router = express.Router();

// ── GET /api/auth/firma/:kod ──────────────────────────────
// Ekran logowania pyta o firmę rozpoznaną z subdomeny, żeby pokazać jej nazwę
// i wiedzieć, czy w ogóle wpuszczać do formularza. Celowo nie zwraca niczego
// poza nazwą i branżą — to endpoint publiczny.
router.get('/firma/:kod', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT nazwa, wersja, aktywna, trial_do,
              (trial_do IS NOT NULL AND trial_do < current_date) AS trial_wygasl
         FROM firmy WHERE kod = $1`,
      [String(req.params.kod).toLowerCase()]
    );
    const firma = rows[0];
    if (!firma || !firma.aktywna) {
      return res.status(404).json({ error: 'Nie znamy takiego adresu firmy' });
    }
    res.json({
      nazwa:        firma.nazwa,
      wersja:       firma.wersja,
      trial_do:     firma.trial_do,
      trial_wygasl: firma.trial_wygasl,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────
// Body: { kod_firmy: "pks-gdynia", nr_sluzbowy: "2669", pin: "1234" }
// Numery służbowe są unikalne w obrębie firmy, nie globalnie — dlatego bez
// kodu firmy nie da się jednoznacznie wskazać konta.
router.post('/login', async (req, res) => {
  const { kod_firmy, nr_sluzbowy, pin } = req.body;

  if (!nr_sluzbowy || !pin) {
    return res.status(400).json({ error: 'Podaj numer służbowy i PIN' });
  }
  if (!kod_firmy) {
    return res.status(400).json({ error: 'Nie wiadomo, z której firmy jest to konto' });
  }

  let firma, kierowca;
  try {
    const { rows: firmaRows } = await db.query(
      `SELECT id, nazwa, aktywna, trial_do,
              (trial_do IS NOT NULL AND trial_do < current_date) AS trial_wygasl
         FROM firmy WHERE kod = $1`,
      [String(kod_firmy).toLowerCase()]
    );
    firma = firmaRows[0];

    if (!firma || !firma.aktywna) {
      // Ten sam komunikat co przy złym PIN-ie — nie podpowiadamy z zewnątrz,
      // które kody firm istnieją.
      return res.status(401).json({ error: 'Nieprawidłowy numer służbowy lub PIN' });
    }
    if (firma.trial_wygasl) {
      const do_ = new Date(firma.trial_do).toLocaleDateString('pl-PL');
      return res.status(403).json({
        error: `Okres próbny zakończył się ${do_}. Skontaktuj się z nami, żeby przedłużyć dostęp.`,
        trial_wygasl: true,
      });
    }

    const { rows } = await db.query(
      `SELECT id, nr_sluzbowy, imie, nazwisko, pin_hash, aktywny, zajezdnia_id,
              wersja, firma_id, rola
         FROM kierowcy WHERE firma_id = $1 AND nr_sluzbowy = $2`,
      [firma.id, nr_sluzbowy]
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
      // Bez tego każde zapytanie musiałoby dopytywać bazę, z której firmy jest
      // konto — a od tego zależy, jakie dane w ogóle wolno pokazać.
      firma_id:    kierowca.firma_id,
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
      firma:       firma.nazwa,
      firma_id:    kierowca.firma_id,
      rola:        kierowca.rola,
    },
    trial_do: firma.trial_do,
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
