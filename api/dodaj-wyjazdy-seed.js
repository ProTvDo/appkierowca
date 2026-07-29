// Skrypt jednorazowy — ustawia wersję "turystyka" dla konta demo (9000)
// i dodaje przykładowe wyjazdy do zaprezentowania klientowi z segmentu turystyki.
// Wymaga wcześniejszego uruchomienia sql/wyjazdy-turystyczne-schema.sql w Supabase SQL Editor.
// Uruchom: node dodaj-wyjazdy-seed.js

require('dotenv').config();
const supabase = require('./supabaseClient');

async function main() {
  const { data: demoKierowca, error: eKierowca } = await supabase
    .from('kierowcy')
    .update({ wersja: 'turystyka' })
    .eq('nr_sluzbowy', '9000')
    .select()
    .single();

  if (eKierowca) return console.error('Błąd ustawiania wersji:', eKierowca.message);
  console.log('✅ Konto 9000 ustawione na wersję: turystyka');

  const demoId = demoKierowca.id;
  const dzis = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];
  const jutro = new Date(dzis); jutro.setDate(jutro.getDate() + 1);
  const zaTydzien = new Date(dzis); zaTydzien.setDate(zaTydzien.getDate() + 7);

  await supabase.from('wyjazdy_turystyczne').delete().eq('kierowca_id', demoId);

  const { error: eWyjazdy } = await supabase
    .from('wyjazdy_turystyczne')
    .insert([
      {
        kierowca_id: demoId,
        data: fmt(dzis),
        cel_podrozy: 'Malbork — wycieczka szkolna',
        godz_podstawienia: '06:30',
        godz_wyjazdu: '07:00',
        godz_dojazdu: '10:30',
        kilometry: 180,
        pilot_imie_nazwisko: 'Anna Kowalczyk',
        pilot_telefon: '+48 600 100 200',
        nr_rejestracyjny: 'GD 12345',
        marka_model: 'Setra S 431 DT',
        dodatkowe_info: 'Grupa 45 osób, wyjazd spod szkoły'
      },
      {
        kierowca_id: demoId,
        data: fmt(jutro),
        cel_podrozy: 'Praga — wycieczka wielodniowa (dzień 1)',
        godz_podstawienia: '04:30',
        godz_wyjazdu: '05:00',
        godz_dojazdu: '13:00',
        kilometry: 620,
        pilot_imie_nazwisko: 'Marek Zieliński',
        pilot_telefon: '+48 600 300 400',
        nr_rejestracyjny: 'GD 98765',
        marka_model: 'Mercedes Tourismo',
        dodatkowe_info: 'Przekroczenie granicy — wymagane dokumenty pojazdu'
      },
      {
        kierowca_id: demoId,
        data: fmt(zaTydzien),
        cel_podrozy: 'Trójmiasto — objazd po zabytkach',
        godz_podstawienia: '07:45',
        godz_wyjazdu: '08:00',
        godz_dojazdu: '08:30',
        kilometry: 45,
        pilot_imie_nazwisko: 'Ewa Nowicka',
        pilot_telefon: '+48 600 500 600',
        nr_rejestracyjny: 'GD 12345',
        marka_model: 'Setra S 431 DT',
        dodatkowe_info: null
      }
    ]);

  if (eWyjazdy) return console.error('Błąd wyjazdów:', eWyjazdy.message);
  console.log('✅ Przykładowe wyjazdy dodane (3)');

  console.log('\nGotowe! Zaloguj się kontem 9000/1234 — zobaczysz widok wersji turystycznej.');
}

main();
