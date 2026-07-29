// Zarządzanie firmami na okresie próbnym — zakładanie, przedłużanie, blokowanie.
// Tylko dla roli superadmin (ProTvDo); dyspozytor firmy ('admin') nie ma tu wstępu
// i nie może zobaczyć, jakie inne firmy testują aplikację.

const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const authMW  = require('../middleware/auth');

const router = express.Router();

function wymagajSuperadmina(req, res, next) {
  if (req.kierowca.rola !== 'superadmin') {
    return res.status(403).json({ error: 'Brak uprawnień' });
  }
  next();
}

const ZAREZERWOWANE = ['app', 'api', 'www', 'demo', 'mail', 'ftp', 'admin', 'test', 'panel'];

function zrobKod(nazwa) {
  const mapa = { ą:'a', ć:'c', ę:'e', ł:'l', ń:'n', ó:'o', ś:'s', ź:'z', ż:'z' };
  return nazwa.toLowerCase()
    .replace(/[ąćęłńóśźż]/g, z => mapa[z])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

function losowyPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// ── GET /api/firmy ────────────────────────────────────────
router.get('/', authMW, wymagajSuperadmina, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT f.id, f.nazwa, f.kod, f.wersja, f.trial_do, f.aktywna,
              f.kontakt_osoba, f.kontakt_email, f.kontakt_telefon, f.notatki,
              (f.trial_do IS NOT NULL AND f.trial_do < current_date) AS trial_wygasl,
              (f.trial_do - current_date)                            AS dni_do_konca,
              count(k.id) FILTER (WHERE k.rola = 'kierowca')          AS kierowcow
         FROM firmy f
         LEFT JOIN kierowcy k ON k.firma_id = f.id
        GROUP BY f.id
        ORDER BY f.nazwa`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/firmy ───────────────────────────────────────
// Body: { nazwa, kod?, wersja, dni_trialu?, kontakt_* }
// Zakłada firmę i od razu konto dyspozytora — bez tego firma nie miałaby
// jak wejść do aplikacji i wgrać swoich danych.
router.post('/', authMW, wymagajSuperadmina, async (req, res) => {
  const { nazwa, kod, wersja, dni_trialu, kontakt_osoba, kontakt_email, kontakt_telefon, notatki } = req.body;

  if (!nazwa || !nazwa.trim()) return res.status(400).json({ error: 'Podaj nazwę firmy' });
  if (!['miejski', 'turystyka', 'liniowe'].includes(wersja)) {
    return res.status(400).json({ error: 'Wybierz branżę: miejski, turystyka lub liniowe' });
  }

  const kodFinalny = (kod || zrobKod(nazwa)).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(kodFinalny)) {
    return res.status(400).json({ error: 'Kod może zawierać tylko małe litery, cyfry i myślniki' });
  }
  if (ZAREZERWOWANE.includes(kodFinalny)) {
    return res.status(400).json({ error: `Kod "${kodFinalny}" jest zarezerwowany — wybierz inny` });
  }

  const dni = Number.isFinite(Number(dni_trialu)) ? Number(dni_trialu) : 30;

  try {
    const { rows } = await db.query(
      `INSERT INTO firmy (nazwa, kod, wersja, trial_do, kontakt_osoba, kontakt_email, kontakt_telefon, notatki)
       VALUES ($1, $2, $3, CASE WHEN $4::int > 0 THEN current_date + $4::int ELSE NULL END, $5, $6, $7, $8)
       RETURNING id, nazwa, kod, wersja, trial_do`,
      [nazwa.trim(), kodFinalny, wersja, dni, kontakt_osoba || null, kontakt_email || null,
       kontakt_telefon || null, notatki || null]
    );
    const firma = rows[0];

    // Dyspozytor dostaje numer 1000 — pierwszy wolny, łatwy do podyktowania.
    const pin = losowyPin();
    await db.query(
      `INSERT INTO kierowcy (nr_sluzbowy, imie, nazwisko, pin_hash, firma_id, wersja, rola, aktywny)
       VALUES ('1000', 'Dyspozytor', $1, $2, $3, $4, 'admin', true)`,
      [nazwa.trim().slice(0, 40), await bcrypt.hash(pin, 10), firma.id, wersja]
    );

    res.status(201).json({
      firma,
      adres: `${firma.kod}.appkierowca.pl`,
      konto_dyspozytora: { nr_sluzbowy: '1000', pin },
    });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(400).json({ error: 'Firma o takiej nazwie lub kodzie już istnieje' });
    }
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/firmy/:id ──────────────────────────────────
// Body: { trial_do? | przedluz_o_dni?, aktywna?, notatki? }
router.patch('/:id', authMW, wymagajSuperadmina, async (req, res) => {
  const { trial_do, przedluz_o_dni, aktywna, notatki } = req.body;

  try {
    const { rows: istnieje } = await db.query('SELECT id, trial_do FROM firmy WHERE id = $1', [req.params.id]);
    if (!istnieje[0]) return res.status(404).json({ error: 'Nie ma takiej firmy' });

    if (przedluz_o_dni !== undefined) {
      // Liczymy od dziś, gdy okres już minął — inaczej "przedłuż o 30 dni"
      // dla firmy sprzed dwóch miesięcy nie dałoby jej ani jednego dnia.
      await db.query(
        `UPDATE firmy
            SET trial_do = greatest(coalesce(trial_do, current_date), current_date) + $1::int
          WHERE id = $2`,
        [Number(przedluz_o_dni), req.params.id]
      );
    } else if (trial_do !== undefined) {
      await db.query('UPDATE firmy SET trial_do = $1 WHERE id = $2', [trial_do || null, req.params.id]);
    }

    if (aktywna !== undefined) {
      await db.query('UPDATE firmy SET aktywna = $1 WHERE id = $2', [!!aktywna, req.params.id]);
    }
    if (notatki !== undefined) {
      await db.query('UPDATE firmy SET notatki = $1 WHERE id = $2', [notatki, req.params.id]);
    }

    const { rows } = await db.query(
      `SELECT id, nazwa, kod, wersja, trial_do, aktywna, notatki,
              (trial_do - current_date) AS dni_do_konca
         FROM firmy WHERE id = $1`,
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/firmy/:id/reset-pin ─────────────────────────
// Kierowca zapomniał PIN-u — nadajemy nowy, bo starego nie da się odczytać.
router.post('/:id/reset-pin', authMW, wymagajSuperadmina, async (req, res) => {
  const { nr_sluzbowy } = req.body;
  if (!nr_sluzbowy) return res.status(400).json({ error: 'Podaj numer służbowy' });

  try {
    const pin = losowyPin();
    const { rowCount } = await db.query(
      'UPDATE kierowcy SET pin_hash = $1 WHERE firma_id = $2 AND nr_sluzbowy = $3',
      [await bcrypt.hash(pin, 10), req.params.id, nr_sluzbowy]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Nie ma takiego kierowcy w tej firmie' });
    res.json({ nr_sluzbowy, pin });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
