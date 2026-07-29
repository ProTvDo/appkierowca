const express = require('express');
const db      = require('../db');
const authMW  = require('../middleware/auth');

const router = express.Router();

// ── GET /api/kontakty ─────────────────────────────────────
router.get('/', authMW, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM kontakty WHERE aktywny = true ORDER BY kolejnosc'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
