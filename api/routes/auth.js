const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const { sprawdzLimit, przytrzymaj, zapiszNieudana, wyczysc } = require('../lib/limit');

const router = express.Router();

// Skrót nieistniejącego PIN-u, na którym i tak wykonujemy bcrypt, gdy konta nie
// ma. Bez tego odpowiedź przychodziła 9 razy szybciej niż przy istniejącym
// koncie (pomiar: 68 vs 7,3 próby na sekundę), co pozwalało wyliczyć, które
// numery służbowe istnieją, bez znajomości żadnego PIN-u.
const ATRAPA_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

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
    console.error('Błąd:', e.message); res.status(500).json({ error: 'Błąd serwera' });
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

  // Limit liczymy na parę (adres klienta, firma + numer), żeby zgadywanie PIN-u
  // jednego konta nie blokowało pozostałym kierowcom logowania.
  const cel = `${String(kod_firmy).toLowerCase()}/${nr_sluzbowy}`;
  const limit = sprawdzLimit(req, cel);
  if (!limit.wolno) {
    const minuty = Math.ceil(limit.sekundy / 60);
    return res.status(429).json({
      error: `Za dużo nieudanych prób. Spróbuj ponownie za ${minuty} min.`,
      ponow_po_sekundach: limit.sekundy,
    });
  }
  await przytrzymaj(req, cel);

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
      // które kody firm istnieją. Bcrypt na atrapie, żeby czas odpowiedzi
      // nie różnił nieistniejącej firmy od złego PIN-u.
      await bcrypt.compare(String(pin), ATRAPA_HASH);
      zapiszNieudana(req, cel);
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
    console.error('Błąd logowania:', e.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }

  if (!kierowca) {
    // Ta sama praca co przy istniejącym koncie — inaczej szybsza odpowiedź
    // ujawniałaby, których numerów służbowych nie ma.
    await bcrypt.compare(String(pin), ATRAPA_HASH);
    zapiszNieudana(req, cel);
    return res.status(401).json({ error: 'Nieprawidłowy numer służbowy lub PIN' });
  }

  if (!kierowca.aktywny) {
    return res.status(403).json({ error: 'Konto nieaktywne. Skontaktuj się z dyspozytornią.' });
  }

  const pinOk = await bcrypt.compare(pin, kierowca.pin_hash);
  if (!pinOk) {
    zapiszNieudana(req, cel);
    return res.status(401).json({ error: 'Nieprawidłowy numer służbowy lub PIN' });
  }

  // Udane logowanie zeruje licznik, żeby kierowca, który raz się pomylił,
  // nie chodził z narastającym opóźnieniem do końca dnia.
  wyczysc(req, cel);

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
  if (nowy_pin === stary_pin) {
    return res.status(400).json({ error: 'Nowy PIN musi się różnić od obecnego' });
  }
  // Cztery takie same cyfry i proste ciągi to pierwsze, co zgaduje ktoś obcy.
  if (/^(\d)\1{3}$/.test(nowy_pin) || ['1234', '4321', '0123', '9876'].includes(nowy_pin)) {
    return res.status(400).json({ error: 'Ten PIN jest zbyt łatwy do odgadnięcia — wybierz inny' });
  }

  // Ten endpoint też pozwala zgadywać PIN, tylko z ważnym tokenem, więc
  // podlega temu samemu ograniczeniu co logowanie.
  const cel = `zmiana-pin/${kierowcaId}`;
  const limit = sprawdzLimit(req, cel);
  if (!limit.wolno) {
    return res.status(429).json({
      error: `Za dużo nieudanych prób. Spróbuj ponownie za ${Math.ceil(limit.sekundy / 60)} min.`,
    });
  }
  await przytrzymaj(req, cel);

  try {
    const { rows } = await db.query('SELECT pin_hash FROM kierowcy WHERE id = $1', [kierowcaId]);
    const kierowca = rows[0];
    if (!kierowca) return res.status(401).json({ error: 'Zaloguj się ponownie' });

    const staryOk = await bcrypt.compare(stary_pin, kierowca.pin_hash);
    if (!staryOk) {
      zapiszNieudana(req, cel);
      return res.status(401).json({ error: 'Obecny PIN jest nieprawidłowy' });
    }

    const nowyHash = await bcrypt.hash(nowy_pin, 10);
    await db.query('UPDATE kierowcy SET pin_hash = $1 WHERE id = $2', [nowyHash, kierowcaId]);
    wyczysc(req, cel);

    res.json({ ok: true, message: 'PIN zmieniony pomyślnie' });
  } catch (e) {
    console.error('Błąd zmiany PIN-u:', e.message);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
