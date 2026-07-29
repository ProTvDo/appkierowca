const express = require('express');
const db      = require('../db');
const authMW  = require('../middleware/auth');

const router = express.Router();

function wymagajAdmina(req, res, next) {
  if (req.kierowca.rola !== 'admin') {
    return res.status(403).json({ error: 'Brak uprawnień administratora' });
  }
  next();
}

// ── GET /api/admin/kierowcy ───────────────────────────────
// Lista kierowców (do listy rozwijanej przy przypisywaniu wyjazdu)
router.get('/kierowcy', authMW, wymagajAdmina, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, imie, nazwisko, nr_sluzbowy FROM kierowcy
       WHERE aktywny = true AND rola = 'kierowca'
       ORDER BY nazwisko`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/admin/pojazdy ────────────────────────────────
router.get('/pojazdy', authMW, wymagajAdmina, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, nr_boczny, nr_rejestracyjny, marka, model FROM pojazdy ORDER BY id`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/admin/wyjazdy ───────────────────────────────
// Body: { kierowca_id, pojazd_id, data, cel_podrozy, godz_wyjazdu, godz_podstawienia,
//         godz_dojazdu, kilometry, pilot_imie_nazwisko, pilot_telefon, dodatkowe_info }
router.post('/wyjazdy', authMW, wymagajAdmina, async (req, res) => {
  const {
    kierowca_id, pojazd_id, data, cel_podrozy, godz_wyjazdu, godz_podstawienia,
    godz_dojazdu, kilometry, pilot_imie_nazwisko, pilot_telefon, dodatkowe_info
  } = req.body;

  if (!kierowca_id || !pojazd_id || !data || !cel_podrozy) {
    return res.status(400).json({ error: 'Podaj kierowcę, pojazd, datę i cel podróży' });
  }

  try {
    const { rows: pojazdRows } = await db.query(
      `SELECT nr_rejestracyjny, marka, model FROM pojazdy WHERE id = $1`,
      [pojazd_id]
    );
    const pojazd = pojazdRows[0];
    if (!pojazd) return res.status(400).json({ error: 'Nie znaleziono pojazdu' });

    const { rows } = await db.query(
      `INSERT INTO wyjazdy_turystyczne
        (kierowca_id, pojazd_id, data, cel_podrozy, godz_wyjazdu, godz_podstawienia,
         godz_dojazdu, kilometry, pilot_imie_nazwisko, pilot_telefon, dodatkowe_info,
         nr_rejestracyjny, marka_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        kierowca_id, pojazd_id, data, cel_podrozy,
        godz_wyjazdu || null, godz_podstawienia || null, godz_dojazdu || null,
        kilometry || null, pilot_imie_nazwisko || null, pilot_telefon || null,
        dodatkowe_info || null, pojazd.nr_rejestracyjny, `${pojazd.marka} ${pojazd.model}`,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
