// Skrypt jednorazowy — dodaje konto demo + minimalne dane referencyjne
// (pojazdy, kategorie usterek, kontakty), których w bazie jeszcze nie było.
// Uruchom: node dodaj-demo.js

require('dotenv').config();
const bcrypt   = require('bcryptjs');
const supabase = require('./supabaseClient');

async function main() {
  // 1. Kierowca demo
  const pin_hash = await bcrypt.hash('1234', 10);
  const { data: demoKierowca, error: eKierowca } = await supabase
    .from('kierowcy')
    .upsert({
      nr_sluzbowy: '9000',
      imie: 'Konto',
      nazwisko: 'Demo',
      pin_hash,
      zajezdnia_id: 1,
      aktywny: true
    }, { onConflict: 'nr_sluzbowy' })
    .select()
    .single();

  if (eKierowca) return console.error('Błąd kierowcy demo:', eKierowca.message);
  console.log('✅ Kierowca demo:', demoKierowca.id, '— nr 9000 / PIN 1234');

  // 2. Pojazdy
  const { data: pojazdy, error: ePojazdy } = await supabase
    .from('pojazdy')
    .upsert([
      { nr_boczny: 'DEMO-01', marka: 'Mercedes', model: 'Citaro' },
      { nr_boczny: 'DEMO-02', marka: 'Solaris',  model: 'Urbino' }
    ], { onConflict: 'nr_boczny' })
    .select();

  if (ePojazdy) return console.error('Błąd pojazdów:', ePojazdy.message);
  console.log('✅ Pojazdy demo:', pojazdy.map(p => p.nr_boczny).join(', '));

  // 3. Kategorie usterek (tabela nie ma unikalnego klucza na "nazwa" — sprawdzamy ręcznie, żeby nie duplikować przy ponownym uruchomieniu)
  const { data: istniejaceKategorie } = await supabase.from('kategorie_usterek').select('id, nazwa');
  let kategorie = istniejaceKategorie || [];

  if (kategorie.length === 0) {
    const { data: noweKategorie, error: eKategorie } = await supabase
      .from('kategorie_usterek')
      .insert([
        { nazwa: 'Silnik',                     ikona: '⚙️' },
        { nazwa: 'Hamulce',                    ikona: '🛑' },
        { nazwa: 'Klimatyzacja / ogrzewanie',  ikona: '🌡️' },
        { nazwa: 'Kasownik / kasa fiskalna',   ikona: '💳' },
        { nazwa: 'Nadwozie / drzwi',           ikona: '🚪' },
        { nazwa: 'Oświetlenie',                ikona: '💡' }
      ])
      .select();

    if (eKategorie) return console.error('Błąd kategorii usterek:', eKategorie.message);
    kategorie = noweKategorie;
  }

  console.log('✅ Kategorie usterek:', kategorie.map(k => k.nazwa).join(', '));

  // 4. Kontakty (ten sam problem — brak unikalnego klucza na "nazwa")
  const { data: istniejaceKontakty } = await supabase.from('kontakty').select('id');
  if (istniejaceKontakty && istniejaceKontakty.length > 0) {
    console.log('ℹ️  Kontakty już istnieją — pomijam');
  } else {
    const { error: eKontakty } = await supabase
      .from('kontakty')
      .insert([
        { nazwa: 'Dyspozytornia', telefon: '+48 58 000 00 01', aktywny: true, kolejnosc: 1 },
        { nazwa: 'Warsztat / mechanik', telefon: '+48 58 000 00 02', aktywny: true, kolejnosc: 2 },
        { nazwa: 'Biuro', telefon: '+48 58 000 00 03', aktywny: true, kolejnosc: 3 }
      ]);

    if (eKontakty) console.error('Błąd kontaktów (pomijam):', eKontakty.message);
    else console.log('✅ Kontakty dodane');
  }

  // 5. Grafik demo (dziś + 2 kolejne dni) — bez unikalnego klucza na (kierowca_id,data), więc usuwamy stare wpisy demo przed wstawieniem
  const demoId = demoKierowca.id;
  const pojazdDemo = pojazdy.find(p => p.nr_boczny === 'DEMO-01').id;
  const dzis = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];
  const jutro = new Date(dzis); jutro.setDate(jutro.getDate() + 1);
  const pojutrze = new Date(dzis); pojutrze.setDate(pojutrze.getDate() + 2);

  await supabase.from('grafiki').delete().eq('kierowca_id', demoId);

  const { error: eGrafik } = await supabase
    .from('grafiki')
    .insert([
      { kierowca_id: demoId, data: fmt(dzis), linia: '145', brygada: '3', zmiana: 'I', godz_start: '06:00', godz_koniec: '14:00', wolne: false, uwagi: 'Zmiennik: Jan K.', pojazd_id: pojazdDemo },
      { kierowca_id: demoId, data: fmt(jutro), linia: '145', brygada: '3', zmiana: 'II', godz_start: '14:00', godz_koniec: '22:00', wolne: false, uwagi: null, pojazd_id: pojazdDemo },
      { kierowca_id: demoId, data: fmt(pojutrze), linia: null, brygada: null, zmiana: null, godz_start: null, godz_koniec: null, wolne: true, uwagi: 'Dzień wolny', pojazd_id: null }
    ]);

  if (eGrafik) console.error('Błąd grafiku (pomijam):', eGrafik.message);
  else console.log('✅ Grafik demo dodany (3 dni)');

  // 6. Przykładowe usterki (bierzemy dwie pierwsze dostępne kategorie, niezależnie od ich nazw)
  const { data: istniejaceUsterki } = await supabase.from('usterki').select('id').eq('kierowca_id', demoId);

  if (istniejaceUsterki && istniejaceUsterki.length > 0) {
    console.log('ℹ️  Usterki demo już istnieją — pomijam');
  } else if (kategorie.length >= 2) {
    const { error: eUsterki } = await supabase
      .from('usterki')
      .insert([
        { kierowca_id: demoId, pojazd_id: pojazdDemo, kategoria_id: kategorie[0].id, opis: 'Nie świeci lewy kierunkowskaz z przodu', lokalizacja: 'Zajezdnia', status: 'naprawiona' },
        { kierowca_id: demoId, pojazd_id: pojazdDemo, kategoria_id: kategorie[1].id, opis: 'Dziwny dźwięk przy rozruchu silnika', lokalizacja: 'Pętla Chylonia', status: 'nowa' }
      ]);

    if (eUsterki) console.error('Błąd usterek (pomijam):', eUsterki.message);
    else console.log('✅ Przykładowe usterki dodane (2)');
  }

  console.log('\nGotowe! Zaloguj się w apce: numer służbowy 9000, PIN 1234');
}

main();
