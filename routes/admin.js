const express  = require('express');
const supabase  = require('../supabaseClient');
const authMW    = require('../middleware/auth');

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
  const { data, error } = await supabase
    .from('kierowcy')
    .select('id, imie, nazwisko, nr_sluzbowy')
    .eq('aktywny', true)
    .eq('rola', 'kierowca')
    .order('nazwisko');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── GET /api/admin/pojazdy ────────────────────────────────
router.get('/pojazdy', authMW, wymagajAdmina, async (req, res) => {
  const { data, error } = await supabase
    .from('pojazdy')
    .select('id, nr_boczny, nr_rejestracyjny, marka, model')
    .order('id');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
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

  const { data: pojazd, error: ePojazd } = await supabase
    .from('pojazdy')
    .select('nr_rejestracyjny, marka, model')
    .eq('id', pojazd_id)
    .single();

  if (ePojazd || !pojazd) return res.status(400).json({ error: 'Nie znaleziono pojazdu' });

  const { data: wyjazd, error } = await supabase
    .from('wyjazdy_turystyczne')
    .insert({
      kierowca_id,
      pojazd_id,
      data,
      cel_podrozy,
      godz_wyjazdu:      godz_wyjazdu || null,
      godz_podstawienia: godz_podstawienia || null,
      godz_dojazdu:      godz_dojazdu || null,
      kilometry:         kilometry || null,
      pilot_imie_nazwisko: pilot_imie_nazwisko || null,
      pilot_telefon:       pilot_telefon || null,
      dodatkowe_info:      dodatkowe_info || null,
      nr_rejestracyjny: pojazd.nr_rejestracyjny,
      marka_model:      `${pojazd.marka} ${pojazd.model}`,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(wyjazd);
});

module.exports = router;
