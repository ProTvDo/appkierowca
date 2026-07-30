const express = require('express');
const db      = require('../db');
const authMW  = require('../middleware/auth');

const router = express.Router();

function mapWiersz(r) {
  return {
    id: r.id, data: r.data, linia: r.linia, brygada: r.brygada, zmiana: r.zmiana,
    godz_start: r.godz_start, godz_koniec: r.godz_koniec, wolne: r.wolne, uwagi: r.uwagi,
    pojazdy: r.nr_boczny ? { nr_boczny: r.nr_boczny, marka: r.marka, model: r.model } : null,
  };
}

// ── GET /api/grafik?rok=2026&miesiac=6 ───────────────────
// Zwraca grafik zalogowanego kierowcy na dany miesiąc
router.get('/', authMW, async (req, res) => {
  const { rok, miesiac } = req.query;
  const kierowcaId = req.kierowca.id;

  const r = parseInt(rok)     || new Date().getFullYear();
  const m = parseInt(miesiac) || new Date().getMonth() + 1;
  const od  = `${r}-${String(m).padStart(2,'0')}-01`;
  const do_ = `${r}-${String(m).padStart(2,'0')}-31`;

  try {
    const { rows } = await db.query(
      `SELECT g.id, g.data, g.linia, g.brygada, g.zmiana, g.godz_start, g.godz_koniec, g.wolne, g.uwagi,
              p.nr_boczny, p.marka, p.model
       FROM grafiki g
       LEFT JOIN pojazdy p ON p.id = g.pojazd_id
       WHERE g.kierowca_id = $1 AND g.data >= $2 AND g.data <= $3
       ORDER BY g.data`,
      [kierowcaId, od, do_]
    );
    res.json(rows.map(mapWiersz));
  } catch (e) {
    console.error('Błąd:', e.message); res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ── GET /api/grafik/dzisiaj ───────────────────────────────
// Zwraca wpis grafiku na dziś — używany na ekranie głównym
router.get('/dzisiaj', authMW, async (req, res) => {
  const kierowcaId = req.kierowca.id;
  const dzisiaj = new Date().toISOString().split('T')[0];

  try {
    const { rows } = await db.query(
      `SELECT g.id, g.data, g.linia, g.brygada, g.zmiana, g.godz_start, g.godz_koniec, g.wolne, g.uwagi,
              p.nr_boczny, p.marka, p.model
       FROM grafiki g
       LEFT JOIN pojazdy p ON p.id = g.pojazd_id
       WHERE g.kierowca_id = $1 AND g.data = $2`,
      [kierowcaId, dzisiaj]
    );
    if (rows.length === 0) return res.status(200).json(null); // brak wpisu = wolne
    res.json(mapWiersz(rows[0]));
  } catch (e) {
    res.status(200).json(null);
  }
});

module.exports = router;
