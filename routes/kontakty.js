const express  = require('express');
const supabase  = require('../supabaseClient');
const authMW    = require('../middleware/auth');

const router = express.Router();

// ── GET /api/kontakty ─────────────────────────────────────
router.get('/', authMW, async (req, res) => {
  const { data, error } = await supabase
    .from('kontakty')
    .select('*')
    .eq('aktywny', true)
    .order('kolejnosc');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
