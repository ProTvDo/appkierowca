// Skrypt jednorazowy — dodaje kierowców testowych do bazy
// Uruchom: node dodaj-kierowcow.js

require('dotenv').config();
const bcrypt   = require('bcryptjs');
const supabase = require('./supabaseClient');

const kierowcy = [
  { nr_sluzbowy: '2669', imie: 'Marek',  nazwisko: 'Wiśniewski', pin: '1234', zajezdnia_id: 1 },
  { nr_sluzbowy: '1100', imie: 'Anna',   nazwisko: 'Kowalska',   pin: '0000', zajezdnia_id: 2 },
  { nr_sluzbowy: '3301', imie: 'Tomasz', nazwisko: 'Nowak',      pin: '9999', zajezdnia_id: 1 },
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
      console.error(`Błąd przy ${k.nr_sluzbowy}:`, error.message);
    } else {
      console.log(`✅ Dodano: ${k.nr_sluzbowy} — ${k.imie} ${k.nazwisko}`);
    }
  }
  console.log('\nGotowe! Możesz teraz testować logowanie.');
}

main();
