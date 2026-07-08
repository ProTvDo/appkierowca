const express  = require('express');
const supabase  = require('../supabaseClient');
const authMW    = require('../middleware/auth');

const router = express.Router();

// ── GET /api/szkolenia ────────────────────────────────────
// Lista aktywnych materiałów + status ukończenia + czy ma test
router.get('/', authMW, async (req, res) => {
  const kierowcaId = req.kierowca.id;

  const { data: materialy, error } = await supabase
    .from('materialy_szkoleniowe')
    .select('id, tytul, typ, opis_skrocony, kolejnosc')
    .eq('aktywny', true)
    .order('kolejnosc');

  if (error) return res.status(500).json({ error: error.message });

  const { data: postepy } = await supabase
    .from('postepy_szkolen')
    .select('material_id')
    .eq('kierowca_id', kierowcaId);

  const { data: testy } = await supabase
    .from('testy')
    .select('id, material_id')
    .eq('aktywny', true);

  const ukonczoneIds = new Set((postepy || []).map(p => p.material_id));
  const testyByMaterial = new Map((testy || []).map(t => [t.material_id, t.id]));

  const wynik = materialy.map(m => ({
    ...m,
    ukonczony: ukonczoneIds.has(m.id),
    test_id: testyByMaterial.get(m.id) || null,
  }));

  res.json(wynik);
});

// ── GET /api/szkolenia/:id ────────────────────────────────
// Szczegóły materiału + pytania powiązanego testu (bez poprawnych odpowiedzi)
router.get('/:id', authMW, async (req, res) => {
  const { id } = req.params;

  const { data: material, error } = await supabase
    .from('materialy_szkoleniowe')
    .select('id, tytul, typ, tresc, wideo_url, opis_skrocony')
    .eq('id', id)
    .single();

  if (error || !material) return res.status(404).json({ error: 'Materiał nie znaleziony' });

  const { data: test } = await supabase
    .from('testy')
    .select('id, tytul, pytania_testowe ( id, tresc, kolejnosc, odpowiedzi_testowe ( id, tresc ) )')
    .eq('material_id', id)
    .eq('aktywny', true)
    .maybeSingle();

  res.json({ ...material, test: test || null });
});

// ── POST /api/szkolenia/:id/ukoncz ────────────────────────
router.post('/:id/ukoncz', authMW, async (req, res) => {
  const { id } = req.params;
  const kierowcaId = req.kierowca.id;

  const { error } = await supabase
    .from('postepy_szkolen')
    .upsert({ kierowca_id: kierowcaId, material_id: id }, { onConflict: 'kierowca_id,material_id' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
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

  const { data: pytania, error: ePytania } = await supabase
    .from('pytania_testowe')
    .select('id, odpowiedzi_testowe ( id, czy_poprawna )')
    .eq('test_id', testId);

  if (ePytania) return res.status(500).json({ error: ePytania.message });
  if (!pytania || pytania.length === 0) return res.status(404).json({ error: 'Test nie znaleziony' });

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

  const { error: eWynik } = await supabase
    .from('wyniki_testow')
    .insert({ kierowca_id: kierowcaId, test_id: testId, wynik_procent: wynikProcent, zdany });

  if (eWynik) return res.status(500).json({ error: eWynik.message });

  res.json({ wynik_procent: wynikProcent, zdany, poprawne, wszystkie: pytania.length });
});

// ── GET /api/szkolenia/postepy ────────────────────────────
// Historia ukończonych materiałów + wyniki testów + terminy uprawnień
router.get('/postepy/wszystkie', authMW, async (req, res) => {
  const kierowcaId = req.kierowca.id;

  const { data: postepy } = await supabase
    .from('postepy_szkolen')
    .select('created_at, materialy_szkoleniowe ( id, tytul, typ )')
    .eq('kierowca_id', kierowcaId)
    .order('created_at', { ascending: false });

  const { data: wynikiTestow } = await supabase
    .from('wyniki_testow')
    .select('id, wynik_procent, zdany, created_at, testy ( tytul )')
    .eq('kierowca_id', kierowcaId)
    .order('created_at', { ascending: false });

  const { data: uprawnienia } = await supabase
    .from('uprawnienia_kierowcow')
    .select('id, nazwa, data_waznosci')
    .eq('kierowca_id', kierowcaId)
    .order('data_waznosci');

  const dzisiaj = new Date();
  const uprawnieniaZeStatusem = (uprawnienia || []).map(u => {
    const waznosc = new Date(u.data_waznosci);
    const dniDoTerminu = Math.ceil((waznosc - dzisiaj) / (1000 * 60 * 60 * 24));
    return {
      ...u,
      status: dniDoTerminu < 0 ? 'przeterminowane' : dniDoTerminu <= 30 ? 'zblizajace_sie' : 'ok',
      dni_do_terminu: dniDoTerminu,
    };
  });

  res.json({
    ukonczone: postepy || [],
    testy: wynikiTestow || [],
    uprawnienia: uprawnieniaZeStatusem,
  });
});

module.exports = router;
