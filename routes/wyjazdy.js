const express  = require('express');
const supabase  = require('../supabaseClient');
const authMW    = require('../middleware/auth');

const router = express.Router();

const POLA = 'id, data, cel_podrozy, godz_wyjazdu, godz_podstawienia, godz_dojazdu, kilometry, pilot_imie_nazwisko, pilot_telefon, nr_rejestracyjny, marka_model, nr_boczny, dodatkowe_info';

// ── GET /api/wyjazdy ──────────────────────────────────────
// Lista wyjazdów zalogowanego kierowcy, najbliższe na górze
router.get('/', authMW, async (req, res) => {
  const kierowcaId = req.kierowca.id;

  const { data, error } = await supabase
    .from('wyjazdy_turystyczne')
    .select(POLA)
    .eq('kierowca_id', kierowcaId)
    .order('data', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── GET /api/wyjazdy/najblizszy ───────────────────────────
// Najbliższy nadchodzący wyjazd — używane na ekranie głównym
router.get('/najblizszy', authMW, async (req, res) => {
  const kierowcaId = req.kierowca.id;
  const dzisiaj = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('wyjazdy_turystyczne')
    .select(POLA)
    .eq('kierowca_id', kierowcaId)
    .gte('data', dzisiaj)
    .order('data', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
