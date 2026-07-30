// Ucieczka znaków przy wstawianiu treści od użytkownika do HTML-owego maila.
//
// Opisy usterek, uszkodzeń i uwagi wpisuje kierowca, a trafiały do szablonu
// wiadomości bez żadnej obróbki. Kierowca mógł więc wpisać własny HTML — łącznie
// z odnośnikiem i tekstem udającym komunikat aplikacji — i biuro dostałoby to
// jako wiadomość od "KierowcaApp". Nie chodzi o skrypty (klienty pocztowe ich
// nie wykonują), a o podszywanie się i mylące treści.

function esc(wartosc) {
  if (wartosc === null || wartosc === undefined) return '';
  return String(wartosc)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Zachowuje podział na wiersze — opisy uszkodzeń bywają wielolinijkowe. */
function escWiersze(wartosc) {
  return esc(wartosc).replace(/\r?\n/g, '<br/>');
}

module.exports = { esc, escWiersze };
