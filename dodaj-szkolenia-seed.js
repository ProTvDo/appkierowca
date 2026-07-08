// Skrypt jednorazowy — dodaje przykładowe materiały szkoleniowe + test
// Wymaga wcześniejszego uruchomienia sql/szkolenia-schema.sql w Supabase SQL Editor.
// Uruchom: node dodaj-szkolenia-seed.js

require('dotenv').config();
const supabase = require('./supabaseClient');

async function main() {
  // Skrypt zakłada świeże, puste tabele (dopiero co utworzone) — używamy zwykłego
  // insert z ręcznym sprawdzeniem istnienia, żeby bezpiecznie dało się go uruchomić ponownie.

  // 1. Artykuł
  const { data: istniejacyArtykul } = await supabase
    .from('materialy_szkoleniowe').select('*').eq('tytul', 'Zasady ekojazdy').maybeSingle();

  let artykul = istniejacyArtykul;
  if (!artykul) {
    const { data, error: eArtykul } = await supabase
      .from('materialy_szkoleniowe')
      .insert({
        tytul: 'Zasady ekojazdy',
        typ: 'artykul',
        tresc: 'Ekojazda to styl prowadzenia pojazdu ograniczający zużycie paliwa i emisję spalin. Kluczowe zasady: płynne ruszanie bez gwałtownego przyspieszania, wcześniejsze przewidywanie sytuacji na drodze, jazda na możliwie najwyższym biegu przy niskich obrotach silnika oraz unikanie zbędnego pracy silnika na postoju.',
        opis_skrocony: 'Jak jeździć oszczędnie i płynnie — podstawy ekojazdy dla kierowców autobusów.',
        kolejnosc: 1,
        aktywny: true
      })
      .select()
      .single();

    if (eArtykul) return console.error('Błąd artykułu:', eArtykul.message);
    artykul = data;
  }
  console.log('✅ Artykuł:', artykul.tytul);

  // 2. Wideo
  const { data: istniejaceWideo } = await supabase
    .from('materialy_szkoleniowe').select('*').eq('tytul', 'Jak prawidłowo zabezpieczyć wózek inwalidzki').maybeSingle();

  let wideo = istniejaceWideo;
  if (!wideo) {
    const { data, error: eWideo } = await supabase
      .from('materialy_szkoleniowe')
      .insert({
        tytul: 'Jak prawidłowo zabezpieczyć wózek inwalidzki',
        typ: 'wideo',
        wideo_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        opis_skrocony: 'Instruktaż krok po kroku — mocowanie wózka inwalidzkiego w przestrzeni dla osób z niepełnosprawnością.',
        kolejnosc: 2,
        aktywny: true
      })
      .select()
      .single();

    if (eWideo) return console.error('Błąd wideo:', eWideo.message);
    wideo = data;
  }
  console.log('✅ Wideo:', wideo.tytul, '(podmień wideo_url na docelowy link)');

  // 3. Test powiązany z artykułem o ekojeździe
  const { data: istniejacyTest } = await supabase
    .from('testy').select('*').eq('tytul', 'Test: Zasady ekojazdy').maybeSingle();

  let test = istniejacyTest;
  if (!test) {
    const { data, error: eTest } = await supabase
      .from('testy')
      .insert({ tytul: 'Test: Zasady ekojazdy', material_id: artykul.id, aktywny: true })
      .select()
      .single();

    if (eTest) return console.error('Błąd testu:', eTest.message);
    test = data;
  }
  console.log('✅ Test:', test.tytul);

  // 4. Pytania + odpowiedzi (usuwamy stare pytania tego testu, żeby skrypt był bezpieczny do ponownego uruchomienia)
  await supabase.from('pytania_testowe').delete().eq('test_id', test.id);

  const { data: pytanie1 } = await supabase
    .from('pytania_testowe')
    .insert({ test_id: test.id, tresc: 'Który styl jazdy jest zgodny z zasadami ekojazdy?', kolejnosc: 1 })
    .select()
    .single();

  await supabase.from('odpowiedzi_testowe').insert([
    { pytanie_id: pytanie1.id, tresc: 'Płynne ruszanie i przewidywanie sytuacji na drodze', czy_poprawna: true },
    { pytanie_id: pytanie1.id, tresc: 'Gwałtowne przyspieszanie i hamowanie', czy_poprawna: false },
  ]);

  const { data: pytanie2 } = await supabase
    .from('pytania_testowe')
    .insert({ test_id: test.id, tresc: 'Czy warto zostawiać silnik włączony na długim postoju?', kolejnosc: 2 })
    .select()
    .single();

  await supabase.from('odpowiedzi_testowe').insert([
    { pytanie_id: pytanie2.id, tresc: 'Tak, zawsze', czy_poprawna: false },
    { pytanie_id: pytanie2.id, tresc: 'Nie, warto wyłączać silnik na dłuższym postoju', czy_poprawna: true },
  ]);

  console.log('✅ Pytania i odpowiedzi dodane (2 pytania)');

  // 5. Przykładowe uprawnienie z terminem dla konta demo (nr 9000)
  const { data: demoKierowca } = await supabase
    .from('kierowcy')
    .select('id')
    .eq('nr_sluzbowy', '9000')
    .maybeSingle();

  if (demoKierowca) {
    const za20dni = new Date();
    za20dni.setDate(za20dni.getDate() + 20);

    await supabase.from('uprawnienia_kierowcow').upsert({
      kierowca_id: demoKierowca.id,
      nazwa: 'Badania lekarskie',
      data_waznosci: za20dni.toISOString().split('T')[0],
    });
    console.log('✅ Uprawnienie demo (badania lekarskie, termin za 20 dni)');
  } else {
    console.log('ℹ️  Kierowca demo (9000) nie istnieje — pomijam uprawnienie');
  }

  console.log('\nGotowe! Zaloguj się i wejdź w kafelek "Szkolenia".');
}

main();
