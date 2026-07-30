const express = require('express');
const db      = require('../db');
const authMW  = require('../middleware/auth');

const router = express.Router();

// ── GET /api/kontakty ─────────────────────────────────────
router.get('/', authMW, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM kontakty WHERE aktywny = true AND firma_id = $1 ORDER BY kolejnosc',
      [req.kierowca.firma_id]
    );
    res.json(rows);
  } catch (e) {
    console.error('Błąd:', e.message); res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
