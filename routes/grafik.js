const express  = require('express');
const supabase  = require('../supabaseClient');
const authMW    = require('../middleware/auth');

const router = express.Router();

// ── GET /api/grafik?rok=2026&miesiac=6 ───────────────────
// Zwraca grafik zalogowanego kierowcy na dany miesiąc
router.get('/', authMW, async (req, res) => {
  const { rok, miesiac } = req.query;
  const kierowcaId = req.kierowca.id;

  // zakres dat
  const r = parseInt(rok)     || new Date().getFullYear();
  const m = parseInt(miesiac) || new Date().getMonth() + 1;
  const od  = `${r}-${String(m).padStart(2,'0')}-01`;
  const do_ = `${r}-${String(m).padStart(2,'0')}-31`;

  const { data, error } = await supabase
    .from('grafiki')
    .select(`
      id, data, linia, brygada, zmiana,
      godz_start, godz_koniec, wolne, uwagi,
      pojazdy ( nr_boczny, marka, model )
    `)
    .eq('kierowca_id', kierowcaId)
    .gte('data', od)
    .lte('data', do_)
    .order('data');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── GET /api/grafik/dzisiaj ───────────────────────────────
// Zwraca wpis grafiku na dziś — używany na ekranie głównym
router.get('/dzisiaj', authMW, async (req, res) => {
  const kierowcaId = req.kierowca.id;
  const dzisiaj = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('grafiki')
    .select(`
      id, data, linia, brygada, zmiana,
      godz_start, godz_koniec, wolne, uwagi,
      pojazdy ( nr_boczny, marka, model )
    `)
    .eq('kierowca_id', kierowcaId)
    .eq('data', dzisiaj)
    .single();

  if (error) return res.status(200).json(null); // brak wpisu = wolne
  res.json(data);
});

module.exports = router;
