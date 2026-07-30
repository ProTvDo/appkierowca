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

// ── POST /api/import/pojazdy ──────────────────────────────
// Kolumny: Nr_rejestracyjny, Marka, Model, Nr_boczny, Typ, Liczba_miejsc
router.post('/pojazdy', authMW, wymagajAdmina, async (req, res) => {
  const { csv, podglad } = req.body;
  if (!csv) return res.status(400).json({ error: 'Brak treści pliku' });

  const firmaId = req.kierowca.firma_id;
  const { wiersze } = parsujCsv(csv);
  if (wiersze.length === 0) return res.status(400).json({ error: 'Plik nie zawiera żadnych wierszy' });

  const bledy = [];
  const doZapisu = [];
  const rejestracjeWPliku = new Set();

  for (const w of wiersze) {
    const rej = pole(w, 'nr_rejestracyjny', 'numer_rejestracyjny', 'rejestracja');
    if (!rej) {
      bledy.push({ wiersz: w.__wiersz, powod: 'Brak numeru rejestracyjnego' });
      continue;
    }
    // Tablice zapisuje się różnie ("GD12345", "GD 12345"), a to ten sam pojazd.
    const rejNorm = rej.toUpperCase().replace(/\s+/g, ' ').trim();
    if (rejestracjeWPliku.has(rejNorm)) {
      bledy.push({ wiersz: w.__wiersz, powod: `Pojazd ${rejNorm} powtarza się w pliku` });
      continue;
    }
    rejestracjeWPliku.add(rejNorm);

    const miejsca = pole(w, 'liczba_miejsc', 'miejsca', 'pojemnosc');
    if (miejsca && !/^\d{1,3}$/.test(miejsca)) {
      bledy.push({ wiersz: w.__wiersz, powod: `"${miejsca}" nie jest liczbą miejsc` });
      continue;
    }

    doZapisu.push({
      rej: rejNorm,
      marka:  pole(w, 'marka') || null,
      model:  pole(w, 'model') || null,
      boczny: pole(w, 'nr_boczny', 'numer_boczny') || null,
      typ:    pole(w, 'typ') || null,
      miejsca: miejsca ? parseInt(miejsca) : null,
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

  let dodane = 0, zaktualizowane = 0;
  for (const p of doZapisu) {
    try {
      const { rows } = await db.query(
        'SELECT id FROM pojazdy WHERE firma_id = $1 AND upper(nr_rejestracyjny) = $2',
        [firmaId, p.rej]
      );
      if (rows[0]) {
        await db.query(
          `UPDATE pojazdy SET marka = $1, model = $2, nr_boczny = $3, typ = $4, liczba_miejsc = $5
            WHERE id = $6`,
          [p.marka, p.model, p.boczny, p.typ, p.miejsca, rows[0].id]
        );
        zaktualizowane++;
      } else {
        await db.query(
          `INSERT INTO pojazdy (nr_rejestracyjny, marka, model, nr_boczny, typ, liczba_miejsc, firma_id, aktywny)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
          [p.rej, p.marka, p.model, p.boczny, p.typ, p.miejsca, firmaId]
        );
        dodane++;
      }
    } catch (e) {
      bledy.push({ wiersz: p.wiersz, powod: e.message });
    }
  }

  res.json({ podsumowanie: { dodane, zaktualizowane, bledow: bledy.length }, bledy });
});

// ── POST /api/import/kontakty ─────────────────────────────
// Kolumny: Nazwa, Telefon, Rola, Grupa, Kolejnosc
router.post('/kontakty', authMW, wymagajAdmina, async (req, res) => {
  const { csv, podglad } = req.body;
  if (!csv) return res.status(400).json({ error: 'Brak treści pliku' });

  const firmaId = req.kierowca.firma_id;
  const { wiersze } = parsujCsv(csv);
  if (wiersze.length === 0) return res.status(400).json({ error: 'Plik nie zawiera żadnych wierszy' });

  const bledy = [];
  const doZapisu = [];

  for (const w of wiersze) {
    const nazwa = pole(w, 'nazwa');
    const telefon = pole(w, 'telefon', 'numer', 'nr_telefonu');
    if (!nazwa) { bledy.push({ wiersz: w.__wiersz, powod: 'Brak nazwy kontaktu' }); continue; }
    if (!telefon) { bledy.push({ wiersz: w.__wiersz, powod: `Brak telefonu dla "${nazwa}"` }); continue; }

    doZapisu.push({
      nazwa, telefon,
      rola:  pole(w, 'rola', 'stanowisko') || null,
      grupa: pole(w, 'grupa', 'kategoria') || null,
      kolejnosc: parseInt(pole(w, 'kolejnosc')) || doZapisu.length,
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

  let dodane = 0, zaktualizowane = 0;
  for (const k of doZapisu) {
    try {
      const { rows } = await db.query(
        'SELECT id FROM kontakty WHERE firma_id = $1 AND nazwa = $2',
        [firmaId, k.nazwa]
      );
      if (rows[0]) {
        await db.query(
          'UPDATE kontakty SET telefon = $1, rola = $2, grupa = $3, kolejnosc = $4, aktywny = true WHERE id = $5',
          [k.telefon, k.rola, k.grupa, k.kolejnosc, rows[0].id]
        );
        zaktualizowane++;
      } else {
        await db.query(
          `INSERT INTO kontakty (nazwa, telefon, rola, grupa, kolejnosc, aktywny, firma_id)
           VALUES ($1, $2, $3, $4, $5, true, $6)`,
          [k.nazwa, k.telefon, k.rola, k.grupa, k.kolejnosc, firmaId]
        );
        dodane++;
      }
    } catch (e) {
      bledy.push({ wiersz: k.wiersz, powod: e.message });
    }
  }

  res.json({ podsumowanie: { dodane, zaktualizowane, bledow: bledy.length }, bledy });
});

// ── POST /api/import/wyjazdy ──────────────────────────────
// Zlecenia turystyczne. Pojazd dopasowujemy po rejestracji albo numerze
// bocznym — biura posługują się i jednym, i drugim.
router.post('/wyjazdy', authMW, wymagajAdmina, async (req, res) => {
  const { csv, podglad } = req.body;
  if (!csv) return res.status(400).json({ error: 'Brak treści pliku' });

  const firmaId = req.kierowca.firma_id;
  const { wiersze } = parsujCsv(csv);
  if (wiersze.length === 0) return res.status(400).json({ error: 'Plik nie zawiera żadnych wierszy' });

  const { rows: kierowcy } = await db.query(
    'SELECT id, nr_sluzbowy, imie, nazwisko FROM kierowcy WHERE firma_id = $1',
    [firmaId]
  );
  const poNumerze = new Map(kierowcy.map(k => [k.nr_sluzbowy, k.id]));
  // Szablon dopuszcza "Jan Kowalski" zamiast numeru — biura myślą nazwiskami.
  const poNazwisku = new Map(
    kierowcy.map(k => [`${k.imie} ${k.nazwisko}`.toLowerCase().trim(), k.id])
  );

  const { rows: pojazdy } = await db.query(
    'SELECT id, nr_rejestracyjny, nr_boczny, marka, model, liczba_miejsc FROM pojazdy WHERE firma_id = $1',
    [firmaId]
  );
  const poRejestracji = new Map(
    pojazdy.filter(p => p.nr_rejestracyjny)
           .map(p => [p.nr_rejestracyjny.toUpperCase().replace(/\s+/g, ''), p])
  );
  const poBocznym = new Map(pojazdy.filter(p => p.nr_boczny).map(p => [p.nr_boczny, p]));

  const bledy = [];
  const ostrzezenia = [];
  const doZapisu = [];

  for (const w of wiersze) {
    const kto  = pole(w, 'numer_sluzbowy_lub_imie_nazwisko_kierowcy', 'numer_sluzbowy_kierowcy', 'kierowca', 'numer_sluzbowy');
    const data = normalizujDate(pole(w, 'data'));
    const cel  = pole(w, 'cel_podrozy', 'cel', 'trasa');

    if (!kto)  { bledy.push({ wiersz: w.__wiersz, powod: 'Brak kierowcy' }); continue; }
    if (!data) { bledy.push({ wiersz: w.__wiersz, powod: `Nieczytelna data "${pole(w, 'data')}" — użyj RRRR-MM-DD` }); continue; }
    if (!cel)  { bledy.push({ wiersz: w.__wiersz, powod: 'Brak celu podróży' }); continue; }

    const kierowcaId = poNumerze.get(kto) || poNazwisku.get(kto.toLowerCase().trim());
    if (!kierowcaId) {
      bledy.push({ wiersz: w.__wiersz, powod: `Nie ma kierowcy "${kto}" — najpierw wgraj listę kierowców` });
      continue;
    }

    const rejWiersza = pole(w, 'nr_rejestracyjny', 'rejestracja');
    const bocznyWiersza = pole(w, 'nr_boczny');
    let pojazd = null;
    if (rejWiersza) pojazd = poRejestracji.get(rejWiersza.toUpperCase().replace(/\s+/g, '')) || null;
    if (!pojazd && bocznyWiersza) pojazd = poBocznym.get(bocznyWiersza) || null;

    if ((rejWiersza || bocznyWiersza) && !pojazd) {
      ostrzezenia.push({ wiersz: w.__wiersz, powod: `Nie znaleziono pojazdu "${rejWiersza || bocznyWiersza}" — wyjazd zapiszemy bez przypisanego autokaru` });
    }

    const grupa = pole(w, 'wielkosc_grupy', 'liczba_osob', 'grupa');
    const liczbaOsob = grupa && /^\d{1,3}$/.test(grupa) ? parseInt(grupa) : null;

    // Zlecenie na więcej osób, niż autokar ma miejsc, to błąd dyspozytora,
    // który wychodzi dopiero na miejscu — lepiej powiedzieć od razu.
    if (liczbaOsob && pojazd?.liczba_miejsc && liczbaOsob > pojazd.liczba_miejsc) {
      ostrzezenia.push({
        wiersz: w.__wiersz,
        powod: `Grupa ${liczbaOsob} osób, a ${pojazd.nr_rejestracyjny} ma ${pojazd.liczba_miejsc} miejsc`,
      });
    }

    const winiety = pole(w, 'winiety_oplacone', 'winiety');

    doZapisu.push({
      kierowcaId, data, cel,
      pojazdId: pojazd?.id || null,
      rej:      pojazd?.nr_rejestracyjny || rejWiersza || null,
      markaModel: pojazd ? `${pojazd.marka || ''} ${pojazd.model || ''}`.trim() : (pole(w, 'marka_model') || null),
      boczny:   pojazd?.nr_boczny || bocznyWiersza || null,
      podstawienie: normalizujGodzine(pole(w, 'godzina_podstawienia', 'godz_podstawienia')),
      wyjazd:       normalizujGodzine(pole(w, 'godzina_wyjazdu', 'godz_wyjazdu')),
      dojazd:       normalizujGodzine(pole(w, 'godzina_dojazdu', 'godz_dojazdu')),
      kilometry: parseInt(pole(w, 'kilometry', 'km')) || null,
      pilot:     pole(w, 'pilot_imie_nazwisko', 'pilot') || null,
      pilotTel:  pole(w, 'pilot_telefon') || null,
      grupa: liczbaOsob,
      postoje:    pole(w, 'punkty_postojowe', 'postoje') || null,
      nocleg:     pole(w, 'nocleg') || null,
      wyzywienie: pole(w, 'wyzywienie') || null,
      oplaty:     pole(w, 'oplaty_drogowe', 'oplaty') || null,
      winiety: winiety ? normalizujTak(winiety) : null,
      ograniczenia: pole(w, 'ograniczenia_trasy', 'ograniczenia') || null,
      info: pole(w, 'dodatkowe_info', 'uwagi') || null,
      wiersz: w.__wiersz,
    });
  }

  if (podglad) {
    return res.json({
      podglad: true,
      podsumowanie: { do_zapisu: doZapisu.length, bledow: bledy.length, ostrzezen: ostrzezenia.length },
      bledy, ostrzezenia,
    });
  }

  let zapisane = 0;
  for (const z of doZapisu) {
    try {
      await db.query(
        `INSERT INTO wyjazdy_turystyczne
          (kierowca_id, pojazd_id, data, cel_podrozy, godz_podstawienia, godz_wyjazdu,
           godz_dojazdu, kilometry, pilot_imie_nazwisko, pilot_telefon, nr_rejestracyjny,
           marka_model, nr_boczny, dodatkowe_info, wielkosc_grupy, punkty_postojowe,
           nocleg, wyzywienie, oplaty_drogowe, winiety_oplacone, ograniczenia_trasy)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [z.kierowcaId, z.pojazdId, z.data, z.cel, z.podstawienie, z.wyjazd, z.dojazd,
         z.kilometry, z.pilot, z.pilotTel, z.rej, z.markaModel, z.boczny, z.info,
         z.grupa, z.postoje, z.nocleg, z.wyzywienie, z.oplaty, z.winiety, z.ograniczenia]
      );
      zapisane++;
    } catch (e) {
      bledy.push({ wiersz: z.wiersz, powod: e.message });
    }
  }

  res.json({ podsumowanie: { zapisane, bledow: bledy.length, ostrzezen: ostrzezenia.length }, bledy, ostrzezenia });
});

// ── GET /api/import/szablon/:rodzaj ───────────────────────
// Szablony generujemy w kodzie, a nie trzymamy jako pliki — dzięki temu nie
// mogą się rozjechać z tym, co import naprawdę potrafi wczytać.
const SZABLONY = {
  kierowcy: {
    naglowki: ['Imie', 'Nazwisko', 'Numer_sluzbowy', 'Segment (Miejska/Turystyka/Dalekobiezna)'],
    przyklad: [['Jan', 'Kowalski', '1001', 'Turystyka'], ['Anna', 'Nowak', '1002', 'Turystyka']],
  },
  pojazdy: {
    naglowki: ['Nr_rejestracyjny', 'Marka', 'Model', 'Nr_boczny', 'Typ', 'Liczba_miejsc'],
    przyklad: [['GD 12345', 'Setra', 'S 431 DT', '01', 'autokar', '83'],
               ['GD 54321', 'Mercedes', 'Tourismo', '02', 'autokar', '49']],
  },
  kontakty: {
    naglowki: ['Nazwa', 'Telefon', 'Rola', 'Grupa', 'Kolejnosc'],
    przyklad: [['Biuro — dyspozytor', '+48 600 100 200', 'dyspozytor', 'biuro', '1'],
               ['Serwis mobilny', '+48 600 300 400', 'serwis', 'awarie', '2']],
  },
  grafik: {
    naglowki: ['Numer_sluzbowy_kierowcy', 'Data', 'Linia', 'Brygada', 'Zmiana (I/II/III)',
               'Godzina_start', 'Godzina_koniec', 'Nr_boczny_pojazdu', 'Wolne (tak/nie)'],
    przyklad: [['1001', '2026-08-01', '145', '3', 'I', '06:00', '14:00', '01', 'nie'],
               ['1001', '2026-08-02', '', '', '', '', '', '', 'tak']],
  },
  wyjazdy: {
    naglowki: ['Numer_sluzbowy_kierowcy', 'Data', 'Cel_podrozy', 'Godzina_podstawienia',
               'Godzina_wyjazdu', 'Godzina_dojazdu', 'Kilometry', 'Wielkosc_grupy',
               'Nr_rejestracyjny', 'Pilot_imie_nazwisko', 'Pilot_telefon', 'Punkty_postojowe',
               'Nocleg', 'Wyzywienie', 'Oplaty_drogowe', 'Winiety_oplacone (tak/nie)',
               'Ograniczenia_trasy', 'Dodatkowe_info'],
    przyklad: [['1001', '2026-08-01', 'Malbork — wycieczka szkolna', '06:30', '07:00', '10:30',
                '180', '45', 'GD 12345', 'Anna Kowalczyk', '+48 600 100 200',
                'Gniew — postój 20 min', 'nie dotyczy', 'obiad z grupa', 'karta flotowa',
                'tak', 'most w Tczewie do 12 t', 'grupa szkolna, opiekunowie 3 osoby']],
  },
};

router.get('/szablon/:rodzaj', authMW, wymagajAdmina, (req, res) => {
  const s = SZABLONY[req.params.rodzaj];
  if (!s) return res.status(404).json({ error: 'Nie ma takiego szablonu' });

  // Średnik i BOM, bo plik ma się otworzyć poprawnie po dwukliku w polskim
  // Excelu — przecinek wrzuca wszystko do jednej kolumny, a bez BOM-u giną ogonki.
  const linie = [s.naglowki, ...s.przyklad].map(w => w.join(';')).join('\r\n');
  const tresc = '﻿' + linie + '\r\n';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="szablon-${req.params.rodzaj}.csv"`);
  res.send(tresc);
});

module.exports = router;
