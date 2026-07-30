// Protokół zdawczo-odbiorczy autokaru — odbiór przed wyjazdem i zdanie po nim.
//
// Kierowca wypełnia, biuro dostaje maila tylko wtedy, gdy coś jest nie tak.
// Powiadamianie o każdym poprawnym protokole zalałoby skrzynkę i nikt by ich
// nie czytał, więc ginęłyby też te ważne.

const express    = require('express');
const db         = require('../db');
const authMW     = require('../middleware/auth');
const { adresatFirmy } = require('../lib/adresaci');
const { transporter, nadawca } = require('../lib/poczta');
const { esc, escWiersze } = require('../lib/html');

const router = express.Router();

const PUNKTY = [
  ['swiatla',          'Światła'],
  ['opony',            'Opony'],
  ['plyny',            'Płyny'],
  ['hamulce',          'Hamulce'],
  ['gasnica',          'Gaśnica'],
  ['apteczka',         'Apteczka'],
  ['czystosc_wnetrza', 'Czystość wnętrza'],
  ['klimatyzacja',     'Klimatyzacja'],
];

const POLA = `id, wyjazd_id, rodzaj, swiatla, opony, plyny, hamulce, gasnica, apteczka,
  czystosc_wnetrza, klimatyzacja, stan_paliwa, licznik_km, uszkodzenia, uwagi,
  wszystko_ok, created_at`;

// ── GET /api/protokoly/wyjazd/:wyjazdId ───────────────────
// Oba protokoły danego wyjazdu (jeśli już są), do pokazania kierowcy.
router.get('/wyjazd/:wyjazdId', authMW, async (req, res) => {
  try {
    // Filtr po kierowcy, nie tylko po wyjeździe — inaczej dałoby się odczytać
    // protokół cudzego wyjazdu, zgadując numer.
    const { rows } = await db.query(
      `SELECT ${POLA} FROM protokoly_pojazdu
        WHERE wyjazd_id = $1 AND kierowca_id = $2
        ORDER BY rodzaj`,
      [req.params.wyjazdId, req.kierowca.id]
    );
    res.json(rows);
  } catch (e) {
    console.error('Błąd:', e.message); res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ── POST /api/protokoly ───────────────────────────────────
// Body: { wyjazd_id, rodzaj, swiatla, opony, ..., stan_paliwa, licznik_km,
//         uszkodzenia, uwagi }
router.post('/', authMW, async (req, res) => {
  const { wyjazd_id, rodzaj } = req.body;

  if (!wyjazd_id) return res.status(400).json({ error: 'Brak wyjazdu' });
  if (!['odbior', 'zdanie'].includes(rodzaj)) {
    return res.status(400).json({ error: 'Rodzaj musi być "odbior" albo "zdanie"' });
  }

  try {
    const { rows: wyjazdRows } = await db.query(
      `SELECT w.id, w.cel_podrozy, w.data, w.nr_rejestracyjny, w.marka_model
         FROM wyjazdy_turystyczne w
        WHERE w.id = $1 AND w.kierowca_id = $2`,
      [wyjazd_id, req.kierowca.id]
    );
    const wyjazd = wyjazdRows[0];
    if (!wyjazd) return res.status(404).json({ error: 'Wyjazd nie znaleziony' });

    const wartosci = {};
    for (const [klucz] of PUNKTY) {
      // Brak odpowiedzi zapisujemy jako null, nie jako "nie sprawdzono = ok".
      wartosci[klucz] = req.body[klucz] === undefined ? null : !!req.body[klucz];
    }

    const licznik = req.body.licznik_km;
    if (licznik !== undefined && licznik !== null && licznik !== '' && !/^\d{1,8}$/.test(String(licznik))) {
      return res.status(400).json({ error: 'Stan licznika musi być liczbą' });
    }

    // "Wszystko w porządku" tylko wtedy, gdy każdy punkt odhaczony i nie ma
    // opisanych uszkodzeń — nie ufamy temu, co przyśle klient.
    const uszkodzenia = (req.body.uszkodzenia || '').trim();
    const wszystkoOk = PUNKTY.every(([k]) => wartosci[k] === true) && uszkodzenia === '';

    const { rows } = await db.query(
      `INSERT INTO protokoly_pojazdu
         (wyjazd_id, kierowca_id, firma_id, rodzaj, swiatla, opony, plyny, hamulce,
          gasnica, apteczka, czystosc_wnetrza, klimatyzacja, stan_paliwa, licznik_km,
          uszkodzenia, uwagi, wszystko_ok)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (wyjazd_id, rodzaj) DO UPDATE SET
         swiatla = EXCLUDED.swiatla, opony = EXCLUDED.opony, plyny = EXCLUDED.plyny,
         hamulce = EXCLUDED.hamulce, gasnica = EXCLUDED.gasnica, apteczka = EXCLUDED.apteczka,
         czystosc_wnetrza = EXCLUDED.czystosc_wnetrza, klimatyzacja = EXCLUDED.klimatyzacja,
         stan_paliwa = EXCLUDED.stan_paliwa, licznik_km = EXCLUDED.licznik_km,
         uszkodzenia = EXCLUDED.uszkodzenia, uwagi = EXCLUDED.uwagi,
         wszystko_ok = EXCLUDED.wszystko_ok, created_at = now()
       RETURNING ${POLA}`,
      [wyjazd_id, req.kierowca.id, req.kierowca.firma_id, rodzaj,
       wartosci.swiatla, wartosci.opony, wartosci.plyny, wartosci.hamulce,
       wartosci.gasnica, wartosci.apteczka, wartosci.czystosc_wnetrza, wartosci.klimatyzacja,
       req.body.stan_paliwa || null,
       licznik === '' || licznik === undefined ? null : parseInt(licznik),
       uszkodzenia || null, req.body.uwagi || null, wszystkoOk]
    );

    const protokol = rows[0];
    let emailWyslany = false;

    // Powiadamiamy tylko przy uwagach — mail o każdym poprawnym protokole
    // przestałby być czytany, a wtedy ginęłyby też te istotne.
    const { adres: emailTo } = wszystkoOk
      ? { adres: null }
      : await adresatFirmy(req.kierowca.firma_id, 'biuro');

    if (emailTo) {
      const braki = PUNKTY.filter(([k]) => wartosci[k] !== true)
        .map(([k, etykieta]) => `${etykieta}: ${wartosci[k] === false ? 'usterka' : 'nie sprawdzono'}`);

      try {
        await transporter.sendMail({
          from: nadawca(),
          to:   emailTo,
          subject: `⚠️ Protokół ${rodzaj === 'odbior' ? 'odbioru' : 'zdania'} z uwagami — ${esc(wyjazd.nr_rejestracyjny || 'pojazd')} (${esc(wyjazd.cel_podrozy)})`,
          html: `
            <h2>Protokół ${rodzaj === 'odbior' ? 'odbioru pojazdu' : 'zdania pojazdu'} z uwagami</h2>
            <p><strong>Kierowca:</strong> ${esc(req.kierowca.imie)} ${esc(req.kierowca.nazwisko)}<br/>
               <strong>Wyjazd:</strong> ${esc(wyjazd.cel_podrozy)} (${esc(wyjazd.data)})<br/>
               <strong>Pojazd:</strong> ${esc(wyjazd.nr_rejestracyjny || '—')} ${esc(wyjazd.marka_model || '')}</p>
            <h3>Punkty wymagające uwagi</h3>
            <ul>${braki.map(b => `<li>${esc(b)}</li>`).join('') || '<li>—</li>'}</ul>
            ${uszkodzenia ? `<h3>Uszkodzenia</h3><p>${escWiersze(uszkodzenia)}</p>` : ''}
            ${protokol.uwagi ? `<h3>Uwagi kierowcy</h3><p>${escWiersze(protokol.uwagi)}</p>` : ''}
            <p style="color:#666">Stan paliwa: ${esc(protokol.stan_paliwa || '—')} · Licznik: ${esc(protokol.licznik_km ?? '—')} km</p>
          `,
        });
        emailWyslany = true;
      } catch (err) {
        console.error('Błąd wysyłki protokołu:', err.message);
      }
    }

    res.status(201).json({ protokol, email_wyslany: emailWyslany });
  } catch (e) {
    console.error('Błąd:', e.message); res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
