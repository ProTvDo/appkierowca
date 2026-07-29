// Skrypt jednorazowy — dodaje konto testowe dyspozytora (rola=admin)
// Wymaga wcześniejszego uruchomienia sql/panel-i-rozliczenie-schema.sql w Supabase SQL Editor.
// Uruchom: node dodaj-admin-seed.js

require('dotenv').config();
const bcrypt   = require('bcryptjs');
const supabase = require('./supabaseClient');

async function main() {
  const pin_hash = await bcrypt.hash('9999', 10);
  const { data: admin, error: eAdmin } = await supabase
    .from('kierowcy')
    .upsert({
      nr_sluzbowy: '7000',
      imie: 'Dyspozytor',
      nazwisko: 'Testowy',
      pin_hash,
      zajezdnia_id: 1,
      aktywny: true,
      rola: 'admin',
      wersja: 'turystyka',
      firma: 'Nazwa firmy',
    }, { onConflict: 'nr_sluzbowy' })
    .select()
    .single();

  if (eAdmin) return console.error('Błąd dyspozytora:', eAdmin.message);
  console.log('✅ Dyspozytor: nr 7000 / PIN 9999');

  const { data: pojazd, error: ePojazd } = await supabase
    .from('pojazdy')
    .upsert({ nr_boczny: 'DEMO-01', nr_rejestracyjny: 'GD 12345', marka: 'Setra', model: 'S 431 DT' }, { onConflict: 'nr_boczny' })
    .select()
    .single();

  if (ePojazd) return console.error('Błąd pojazdu:', ePojazd.message);
  console.log('✅ Pojazd z nr rejestracyjnym:', pojazd.nr_rejestracyjny);

  console.log('\nGotowe! Zaloguj się kontem 7000/9999, żeby zobaczyć panel dyspozytora.');
}

main();
