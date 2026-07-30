// Ograniczanie liczby prób logowania.
//
// PIN ma cztery cyfry, czyli 10 000 kombinacji. Bez żadnego ogranicznika pomiar
// na produkcji dał 7,3 próby na sekundę — cały zakres w 23 minuty szeregowo,
// a przy kilku równoległych połączeniach w dwie. Numery służbowe są przy tym
// łatwe do zgadnięcia: dyspozytor to zawsze 1000, a importowani kierowcy
// dostają kolejne numery od 1001. Bez tego pliku wystarczyło znać adres firmy.
//
// Licznik trzymamy w pamięci procesu. Aplikacja chodzi w jednej instancji pod
// PM2, więc to wystarcza; przy wielu instancjach trzeba by przenieść stan do
// bazy albo Redisa, inaczej limit rozjedzie się na tyle części, ile procesów.

const PROG_OPOZNIENIA = 3;      // po tylu nieudanych próbach zaczynamy zwalniać
const PROG_BLOKADY    = 10;     // po tylu blokujemy konto na chwilę
const BLOKADA_MS      = 15 * 60 * 1000;
const OKNO_MS         = 15 * 60 * 1000;  // po tym czasie bezczynności licznik gaśnie

const proby = new Map();   // klucz -> { ile, do_kiedy, ostatnia }

// Sprzątanie, żeby mapa nie rosła bez końca przy skanowaniu losowych numerów.
setInterval(() => {
  const teraz = Date.now();
  for (const [k, v] of proby) {
    if (teraz - v.ostatnia > OKNO_MS && (!v.do_kiedy || v.do_kiedy < teraz)) proby.delete(k);
  }
}, 5 * 60 * 1000).unref();

function klucz(req, identyfikator) {
  // Adres klienta bierzemy z nagłówka Cloudflare — bez tego wszyscy użytkownicy
  // wyglądaliby jak jeden adres (serwer widzi tylko IP Cloudflare) i jeden
  // kierowca z błędnym PIN-em blokowałby całą firmę.
  const ip = req.headers['cf-connecting-ip'] || req.ip || 'nieznany';
  return `${ip}|${identyfikator}`;
}

/**
 * Czy wolno podjąć kolejną próbę. Zwraca { wolno, sekundy } — sekundy to czas
 * pozostały do końca blokady, do pokazania użytkownikowi.
 */
function sprawdzLimit(req, identyfikator) {
  const k = klucz(req, identyfikator);
  const v = proby.get(k);
  if (!v) return { wolno: true };

  if (v.do_kiedy && v.do_kiedy > Date.now()) {
    return { wolno: false, sekundy: Math.ceil((v.do_kiedy - Date.now()) / 1000) };
  }
  return { wolno: true };
}

/** Opóźnienie rosnące z liczbą nieudanych prób — spowalnia zgadywanie. */
async function przytrzymaj(req, identyfikator) {
  const v = proby.get(klucz(req, identyfikator));
  if (!v || v.ile < PROG_OPOZNIENIA) return;
  const ms = Math.min(2000, (v.ile - PROG_OPOZNIENIA + 1) * 400);
  await new Promise(r => setTimeout(r, ms));
}

function zapiszNieudana(req, identyfikator) {
  const k = klucz(req, identyfikator);
  const v = proby.get(k) || { ile: 0, do_kiedy: null, ostatnia: 0 };
  v.ile += 1;
  v.ostatnia = Date.now();
  if (v.ile >= PROG_BLOKADY) {
    v.do_kiedy = Date.now() + BLOKADA_MS;
    v.ile = 0;               // po odblokowaniu liczymy od nowa
  }
  proby.set(k, v);
}

function wyczysc(req, identyfikator) {
  proby.delete(klucz(req, identyfikator));
}

module.exports = { sprawdzLimit, przytrzymaj, zapiszNieudana, wyczysc, BLOKADA_MS };
