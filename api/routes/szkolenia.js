const express = require('express');
const db      = require('../db');
const authMW  = require('../middleware/auth');

const router = express.Router();

// ── GET /api/szkolenia ────────────────────────────────────
// Lista aktywnych materiałów + status ukończenia + czy ma test
router.get('/', authMW, async (req, res) => {
  const kierowcaId = req.kierowca.id;

  try {
    // Baza wiedzy jest wspólna (firma_id NULL), ale firma może dołożyć własne
    // materiały — widoczne tylko dla jej kierowców.
    const { rows: materialy } = await db.query(
      `SELECT id, tytul, typ, opis_skrocony, kolejnosc
       FROM materialy_szkoleniowe
       WHERE aktywny = true AND (firma_id IS NULL OR firma_id = $1)
       ORDER BY kolejnosc`,
      [req.kierowca.firma_id]
    );

    const { rows: postepy } = await db.query(
      'SELECT material_id FROM postepy_szkolen WHERE kierowca_id = $1',
      [kierowcaId]
    );

    const { rows: testy } = await db.query(
      'SELECT id, material_id FROM testy WHERE aktywny = true AND (firma_id IS NULL OR firma_id = $1)',
      [req.kierowca.firma_id]
    );

    const ukonczoneIds = new Set(postepy.map(p => p.material_id));
    const testyByMaterial = new Map(testy.map(t => [t.material_id, t.id]));

    const wynik = materialy.map(m => ({
      ...m,
      ukonczony: ukonczoneIds.has(m.id),
      test_id: testyByMaterial.get(m.id) || null,
    }));

    res.json(wynik);
  } catch (e) {
    console.error('Błąd:', e.message); res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ── GET /api/szkolenia/:id ────────────────────────────────
// Szczegóły materiału + pytania powiązanego testu (bez poprawnych odpowiedzi)
router.get('/:id', authMW, async (req, res) => {
  const { id } = req.params;

  try {
    // Identyfikator materiału przychodzi z adresu, więc sam filtr po id nie
    // wystarczy — bez warunku na firmę dałoby się odczytać materiał własny
    // innej firmy, zgadując numer.
    const { rows: materialRows } = await db.query(
      `SELECT id, tytul, typ, tresc, wideo_url, opis_skrocony
       FROM materialy_szkoleniowe
       WHERE id = $1 AND (firma_id IS NULL OR firma_id = $2)`,
      [id, req.kierowca.firma_id]
    );
    const material = materialRows[0];
    if (!material) return res.status(404).json({ error: 'Materiał nie znaleziony' });

    const { rows: testRows } = await db.query(
      `SELECT id, tytul FROM testy
        WHERE material_id = $1 AND aktywny = true AND (firma_id IS NULL OR firma_id = $2)`,
      [id, req.kierowca.firma_id]
    );
    const testRow = testRows[0];

    let test = null;
    if (testRow) {
      const { rows: pytaniaRows } = await db.query(
        `SELECT id, tresc, kolejnosc FROM pytania_testowe WHERE test_id = $1 ORDER BY kolejnosc`,
        [testRow.id]
      );

      const pytania = [];
      for (const p of pytaniaRows) {
        const { rows: odpowiedzi } = await db.query(
          `SELECT id, tresc FROM odpowiedzi_testowe WHERE pytanie_id = $1`,
          [p.id]
        );
        pytania.push({ id: p.id, tresc: p.tresc, kolejnosc: p.kolejnosc, odpowiedzi_testowe: odpowiedzi });
      }

      test = { id: testRow.id, tytul: testRow.tytul, pytania_testowe: pytania };
    }

    res.json({ ...material, test });
  } catch (e) {
    console.error('Błąd:', e.message); res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ── POST /api/szkolenia/:id/ukoncz ────────────────────────
router.post('/:id/ukoncz', authMW, async (req, res) => {
  const { id } = req.params;
  const kierowcaId = req.kierowca.id;

  try {
    // Materiał musi być widoczny dla firmy kierowcy — inaczej dałoby się
    // zapisać ukończenie materiału własnego innej firmy.
    const { rows: mat } = await db.query(
      `SELECT id FROM materialy_szkoleniowe
        WHERE id = $1 AND aktywny = true AND (firma_id IS NULL OR firma_id = $2)`,
      [id, req.kierowca.firma_id]
    );
    if (!mat[0]) return res.status(404).json({ error: 'Materiał nie znaleziony' });

    await db.query(
      `INSERT INTO postepy_szkolen (kierowca_id, material_id)
       VALUES ($1, $2)
       ON CONFLICT (kierowca_id, material_id) DO NOTHING`,
      [kierowcaId, id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('Błąd zapisu ukończenia materiału:', e.message);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ── POST /api/szkolenia/testy/:testId/wyslij ──────────────
// Body: { odpowiedzi: [{ pytanie_id, odpowiedz_id }] }
router.post('/testy/:testId/wyslij', authMW, async (req, res) => {
  const { testId } = req.params;
  const { odpowiedzi } = req.body;
  const kierowcaId = req.kierowca.id;

  if (!Array.isArray(odpowiedzi) || odpowiedzi.length === 0) {
    return res.status(400).json({ error: 'Brak odpowiedzi' });
  }

  try {
    // Test musi należeć do firmy kierowcy albo być wspólny — bez tego można było
    // rozwiązywać i zapisywać wynik testu należącego do innej firmy.
    const { rows: testRows } = await db.query(
      `SELECT id FROM testy
        WHERE id = $1 AND aktywny = true AND (firma_id IS NULL OR firma_id = $2)`,
      [testId, req.kierowca.firma_id]
    );
    if (!testRows[0]) return res.status(404).json({ error: 'Test nie znaleziony' });

    const { rows: pytaniaRows } = await db.query(
      `SELECT id FROM pytania_testowe WHERE test_id = $1`,
      [testId]
    );
    if (pytaniaRows.length === 0) return res.status(404).json({ error: 'Test nie znaleziony' });

    const pytania = [];
    for (const p of pytaniaRows) {
      const { rows: odp } = await db.query(
        `SELECT id, czy_poprawna FROM odpowiedzi_testowe WHERE pytanie_id = $1`,
        [p.id]
      );
      pytania.push({ id: p.id, odpowiedzi_testowe: odp });
    }

    let poprawne = 0;
    for (const pytanie of pytania) {
      const wybor = odpowiedzi.find(o => String(o.pytanie_id) === String(pytanie.id));
      const poprawnaOdp = pytanie.odpowiedzi_testowe.find(o => o.czy_poprawna);
      if (wybor && poprawnaOdp && String(wybor.odpowiedz_id) === String(poprawnaOdp.id)) {
        poprawne++;
      }
    }

    const wynikProcent = Math.round((poprawne / pytania.length) * 100);
    const zdany = wynikProcent >= 70;

    await db.query(
      `INSERT INTO wyniki_testow (kierowca_id, test_id, wynik_procent, zdany)
       VALUES ($1, $2, $3, $4)`,
      [kierowcaId, testId, wynikProcent, zdany]
    );

    res.json({ wynik_procent: wynikProcent, zdany, poprawne, wszystkie: pytania.length });
  } catch (e) {
    console.error('Błąd:', e.message); res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ── GET /api/szkolenia/postepy/wszystkie ──────────────────
// Historia ukończonych materiałów + wyniki testów + terminy uprawnień
router.get('/postepy/wszystkie', authMW, async (req, res) => {
  const kierowcaId = req.kierowca.id;

  try {
    const { rows: postepyRows } = await db.query(
      `SELECT ps.created_at, m.id AS material_id, m.tytul, m.typ
       FROM postepy_szkolen ps
       JOIN materialy_szkoleniowe m ON m.id = ps.material_id
       WHERE ps.kierowca_id = $1
       ORDER BY ps.created_at DESC`,
      [kierowcaId]
    );
    const postepy = postepyRows.map(r => ({
      created_at: r.created_at,
      materialy_szkoleniowe: { id: r.material_id, tytul: r.tytul, typ: r.typ },
    }));

    const { rows: wynikiRows } = await db.query(
      `SELECT wt.id, wt.wynik_procent, wt.zdany, wt.created_at, t.tytul
       FROM wyniki_testow wt
       JOIN testy t ON t.id = wt.test_id
       WHERE wt.kierowca_id = $1
       ORDER BY wt.created_at DESC`,
      [kierowcaId]
    );
    const wynikiTestow = wynikiRows.map(r => ({
      id: r.id, wynik_procent: r.wynik_procent, zdany: r.zdany, created_at: r.created_at,
      testy: { tytul: r.tytul },
    }));

    const { rows: uprawnienia } = await db.query(
      `SELECT id, nazwa, data_waznosci FROM uprawnienia_kierowcow
       WHERE kierowca_id = $1 ORDER BY data_waznosci`,
      [kierowcaId]
    );

    const dzisiaj = new Date();
    const uprawnieniaZeStatusem = uprawnienia.map(u => {
      const waznosc = new Date(u.data_waznosci);
      const dniDoTerminu = Math.ceil((waznosc - dzisiaj) / (1000 * 60 * 60 * 24));
      return {
        ...u,
        status: dniDoTerminu < 0 ? 'przeterminowane' : dniDoTerminu <= 30 ? 'zblizajace_sie' : 'ok',
        dni_do_terminu: dniDoTerminu,
      };
    });

    res.json({
      ukonczone: postepy,
      testy: wynikiTestow,
      uprawnienia: uprawnieniaZeStatusem,
    });
  } catch (e) {
    console.error('Błąd:', e.message); res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
