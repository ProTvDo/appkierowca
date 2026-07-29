// Import danych firmy z plików CSV wypełnionych w Excelu.
//
// Każdy import działa w dwóch krokach: najpierw podgląd (nic nie zapisuje,
// zwraca listę błędów z numerami wierszy), potem zapis. Dzięki temu firma
// widzi, co jest nie tak, zanim połowa danych wyląduje w bazie.
//
// Wszystko jest zawężone do firmy zalogowanego admina — identyfikatory z
// pliku nigdy nie wskazują danych innej firmy.

const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const authMW  = require('../middleware/auth');
const { parsujCsv, normalizujDate, normalizujGodzine, normalizujTak } = require('../lib/csv');

const router = express.Router();

function wymagajAdmina(req, res, next) {
  if (req.kierowca.rola !== 'admin') {
    return res.status(403).json({ error: 'Brak uprawnień administratora' });
  }
  next();
}

// Pierwsza wartość, która w wierszu w ogóle występuje — nagłówki bywają
// skracane przez firmy i nie chcemy się wywracać na drobnej różnicy.
function pole(w, ...nazwy) {
  for (const n of nazwy) if (w[n]) return w[n];
  return '';
}

const SEGMENTY = {
  miejska: 'miejski', miejski: 'miejski',
  turystyka: 'turystyka', turystyczna: 'turystyka',
  dalekobiezna: 'liniowe', liniowe: 'liniowe', liniowa: 'liniowe',
};

function losowyPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// ── POST /api/import/kierowcy ─────────────────────────────
// Body: { csv, podglad }
// Kolumny: Imie, Nazwisko, Numer_sluzbowy, Segment
router.post('/kierowcy', authMW, wymagajAdmina, async (req, res) => {
  const { csv, podglad } = req.body;
  if (!csv) return res.status(400).json({ error: 'Brak treści pliku' });

  const firmaId = req.kierowca.firma_id;
  const { wiersze } = parsujCsv(csv);
  if (wiersze.length === 0) return res.status(400).json({ error: 'Plik nie zawiera żadnych wierszy' });

  const bledy = [];
  const doZapisu = [];
  const numeryWPliku = new Set();

  // Domyślny segment bierzemy z firmy — jeśli firma testuje wersję
  // turystyczną, nie ma powodu wymagać kolumny w każdym wierszu.
  const { rows: firmaRows } = await db.query('SELECT wersja FROM firmy WHERE id = $1', [firmaId]);
  const wersjaFirmy = firmaRows[0]?.wersja || 'miejski';

  for (const w of wiersze) {
    const imie     = pole(w, 'imie');
    const nazwisko = pole(w, 'nazwisko');
    let   nr       = pole(w, 'numer_sluzbowy', 'nr_sluzbowy', 'numer');
    const segment  = pole(w, 'segment', 'wersja', 'branza');

    if (!imie || !nazwisko) {
      bledy.push({ wiersz: w.__wiersz, powod: 'Brak imienia lub nazwiska' });
      continue;
    }

    // Numer służbowy bywa pusty w szablonie — wtedy nadajemy go sami,
    // żeby firma nie musiała nic wymyślać.
    if (!nr) {
      const { rows } = await db.query(
        `SELECT coalesce(max(nullif(regexp_replace(nr_sluzbowy, '\\D', '', 'g'), ''))::bigint, 1000) AS ostatni
           FROM kierowcy WHERE firma_id = $1`,
        [firmaId]
      );
      nr = String(Number(rows[0].ostatni) + 1 + doZapisu.length);
    }

    if (numeryWPliku.has(nr)) {
      bledy.push({ wiersz: w.__wiersz, powod: `Numer ${nr} powtarza się w pliku` });
      continue;
    }
    numeryWPliku.add(nr);

    const wersja = segment
      ? SEGMENTY[segment.toLowerCase().replace(/[^a-z]/g, '')] || null
      : wersjaFirmy;

    if (!wersja) {
      bledy.push({ wiersz: w.__wiersz, powod: `Nieznany segment "${segment}" — użyj: Miejska, Turystyka lub Dalekobiezna` });
      continue;
    }

    doZapisu.push({ imie, nazwisko, nr, wersja, wiersz: w.__wiersz });
  }

  if (podglad) {
    return res.json({
      podglad: true,
      podsumowanie: { do_dodania: doZapisu.length, bledow: bledy.length },
      bledy,
      przyklady: doZapisu.slice(0, 5),
    });
  }

  const konta = [];
  let dodane = 0, zaktualizowane = 0;

  for (const k of doZapisu) {
    try {
      const { rows: istnieje } = await db.query(
        'SELECT id FROM kierowcy WHERE firma_id = $1 AND nr_sluzbowy = $2',
        [firmaId, k.nr]
      );

      if (istnieje[0]) {
        // Aktualizujemy dane, ale NIE resetujemy PIN-u — kierowca mógł go
        // już zmienić, a ponowny import nie może go wylogować z konta.
        await db.query(
          'UPDATE kierowcy SET imie = $1, nazwisko = $2, wersja = $3 WHERE id = $4',
          [k.imie, k.nazwisko, k.wersja, istnieje[0].id]
        );
        zaktualizowane++;
      } else {
        const pin = losowyPin();
        await db.query(
          `INSERT INTO kierowcy (nr_sluzbowy, imie, nazwisko, pin_hash, firma_id, wersja, rola, aktywny)
           VALUES ($1, $2, $3, $4, $5, $6, 'kierowca', true)`,
          [k.nr, k.imie, k.nazwisko, await bcrypt.hash(pin, 10), firmaId, k.wersja]
        );
        // PIN pokazujemy jeden raz — w bazie jest tylko hash, więc później
        // nie da się go odtworzyć, można go wyłącznie nadać na nowo.
        konta.push({ nr_sluzbowy: k.nr, imie: k.imie, nazwisko: k.nazwisko, pin });
        dodane++;
      }
    } catch (e) {
      bledy.push({ wiersz: k.wiersz, powod: e.message });
    }
  }

  res.json({ podsumowanie: { dodane, zaktualizowane, bledow: bledy.length }, bledy, konta });
});

// ── POST /api/import/grafik ───────────────────────────────
// Kolumny: Numer_sluzbowy_kierowcy, Data, Linia, Brygada, Zmiana,
//          Godzina_start, Godzina_koniec, Nr_boczny_pojazdu, Wolne
router.post('/grafik', authMW, wymagajAdmina, async (req, res) => {
  const { csv, podglad } = req.body;
  if (!csv) return res.status(400).json({ error: 'Brak treści pliku' });

  const firmaId = req.kierowca.firma_id;
  const { wiersze } = parsujCsv(csv);
  if (wiersze.length === 0) return res.status(400).json({ error: 'Plik nie zawiera żadnych wierszy' });

  // Jedno zapytanie zamiast jednego na wiersz — grafik miesięczny to
  // kilkaset wierszy i odpytywanie bazy za każdym razem trwałoby zauważalnie.
  const { rows: kierowcy } = await db.query(
    'SELECT id, nr_sluzbowy FROM kierowcy WHERE firma_id = $1',
    [firmaId]
  );
  const poNumerze = new Map(kierowcy.map(k => [k.nr_sluzbowy, k.id]));

  const { rows: pojazdy } = await db.query(
    'SELECT id, nr_boczny FROM pojazdy WHERE firma_id = $1 AND nr_boczny IS NOT NULL',
    [firmaId]
  );
  const pojazdPoBocznym = new Map(pojazdy.map(p => [p.nr_boczny, p.id]));

  const bledy = [];
  const doZapisu = [];

  for (const w of wiersze) {
    const nr   = pole(w, 'numer_sluzbowy_kierowcy', 'numer_sluzbowy', 'nr_sluzbowy');
    const data = normalizujDate(pole(w, 'data'));

    if (!nr)   { bledy.push({ wiersz: w.__wiersz, powod: 'Brak numeru służbowego' }); continue; }
    if (!data) { bledy.push({ wiersz: w.__wiersz, powod: `Nieczytelna data "${pole(w, 'data')}" — użyj formatu RRRR-MM-DD` }); continue; }

    const kierowcaId = poNumerze.get(nr);
    if (!kierowcaId) {
      bledy.push({ wiersz: w.__wiersz, powod: `Nie ma kierowcy o numerze ${nr} — najpierw wgraj listę kierowców` });
      continue;
    }

    const wolne = normalizujTak(pole(w, 'wolne'));
    const nrBoczny = pole(w, 'nr_boczny_pojazdu', 'nr_boczny');

    doZapisu.push({
      kierowcaId, data, wolne,
      linia:   pole(w, 'linia') || null,
      brygada: pole(w, 'brygada') || null,
      zmiana:  pole(w, 'zmiana') || null,
      start:   normalizujGodzine(pole(w, 'godzina_start', 'godz_start')),
      koniec:  normalizujGodzine(pole(w, 'godzina_koniec', 'godz_koniec')),
      pojazdId: nrBoczny ? (pojazdPoBocznym.get(nrBoczny) || null) : null,
      wiersz: w.__wiersz,
    });
  }

  if (podglad) {
    return res.json({
      podglad: true,
      podsumowanie: { do_zapisu: doZapisu.length, bledow: bledy.length },
      bledy,
    });
  }

  let zapisane = 0;
  for (const g of doZapisu) {
    try {
      // Ponowny import tego samego miesiąca ma poprawiać wpisy, nie dublować.
      await db.query(
        `INSERT INTO grafiki (kierowca_id, data, linia, brygada, zmiana, godz_start, godz_koniec, wolne, pojazd_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (kierowca_id, data) DO UPDATE SET
           linia = EXCLUDED.linia, brygada = EXCLUDED.brygada, zmiana = EXCLUDED.zmiana,
           godz_start = EXCLUDED.godz_start, godz_koniec = EXCLUDED.godz_koniec,
           wolne = EXCLUDED.wolne, pojazd_id = EXCLUDED.pojazd_id`,
        [g.kierowcaId, g.data, g.linia, g.brygada, g.zmiana, g.start, g.koniec, g.wolne, g.pojazdId]
      );
      zapisane++;
    } catch (e) {
      bledy.push({ wiersz: g.wiersz, powod: e.message });
    }
  }

  res.json({ podsumowanie: { zapisane, bledow: bledy.length }, bledy });
});

module.exports = router;
