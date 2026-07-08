// Skrypt jednorazowy — dodaje generyczne konta testowe dla firmy na okresie próbnym
// Uruchom: node dodaj-trial-kierowcow.js

require('dotenv').config();
const bcrypt   = require('bcryptjs');
const supabase = require('./supabaseClient');

const kierowcy = [
  { nr_sluzbowy: '8001', imie: 'Kierowca', nazwisko: 'Testowy 1', pin: '1111', zajezdnia_id: 1 },
  { nr_sluzbowy: '8002', imie: 'Kierowca', nazwisko: 'Testowy 2', pin: '2222', zajezdnia_id: 1 },
  { nr_sluzbowy: '8003', imie: 'Kierowca', nazwisko: 'Testowy 3', pin: '3333', zajezdnia_id: 1 },
];

async function main() {
  for (const k of kierowcy) {
    const pin_hash = await bcrypt.hash(k.pin, 10);
    const { error } = await supabase.from('kierowcy').upsert({
      nr_sluzbowy: k.nr_sluzbowy,
      imie:        k.imie,
      nazwisko:    k.nazwisko,
      pin_hash,
      zajezdnia_id: k.zajezdnia_id,
      aktywny:     true
    }, { onConflict: 'nr_sluzbowy' });

    if (error) {
      console.error(`❌ Błąd przy ${k.nr_sluzbowy}:`, error.message);
    } else {
      console.log(`✅ ${k.nr_sluzbowy} / PIN ${k.pin} — ${k.imie} ${k.nazwisko}`);
    }
  }
  console.log('\nGotowe! Konta testowe do przekazania firmie.');
}

main();
