// Firmę rozpoznajemy po subdomenie: pks-gdynia.appkierowca.pl → "pks-gdynia".
// Dzięki temu kierowca wpisuje tylko numer i PIN, a numery służbowe nie muszą
// być unikalne między firmami.

// Adresy techniczne — nie są nazwami firm.
const ZAREZERWOWANE = ['app', 'api', 'www', 'demo', 'mail', 'ftp', 'admin', 'test', 'panel']

export function kodFirmyZAdresu(hostname = window.location.hostname) {
  const czesci = hostname.split('.')

  // Do działania potrzebna jest subdomena nad domeną właściwą, czyli co
  // najmniej trzy człony (firma.appkierowca.pl). Samo appkierowca.pl,
  // localhost czy adres IP nie wskazują żadnej firmy.
  if (czesci.length < 3) return null

  const kod = czesci[0].toLowerCase()
  if (ZAREZERWOWANE.includes(kod)) return null
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(kod)) return null

  return kod
}
