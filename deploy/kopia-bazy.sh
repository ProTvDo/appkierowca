#!/bin/bash
# Codzienna kopia bazy AppKierowca.
#
# Do 2026-07-30 nie istniała żadna automatyczna kopia — jedyne zrzuty powstały
# ręcznie przy migracjach i leżały na tym samym dysku co baza, czyli awaria
# dysku albo utrata VPS-a oznaczała utratę danych wszystkich firm razem
# z "kopiami". Ten skrypt uruchamiany z crona to naprawia.
#
# Instalacja (jako ubuntu):
#   sudo cp deploy/kopia-bazy.sh /usr/local/bin/kopia-bazy.sh
#   sudo chmod 750 /usr/local/bin/kopia-bazy.sh
#   crontab -e  ->  17 2 * * * /usr/local/bin/kopia-bazy.sh >> ~/kopie/kopia.log 2>&1

set -euo pipefail

BAZA=kierowcaapp
KATALOG=/home/ubuntu/kopie
ILE_DNI=30

mkdir -p "$KATALOG"
# Zrzuty zawierają skróty PIN-ów i dane osobowe kierowców — nikt poza
# właścicielem nie ma prawa ich czytać.
chmod 700 "$KATALOG"

PLIK="$KATALOG/${BAZA}_$(date +%Y%m%d_%H%M).dump"

# -Fc = format własny pg_restore: kompresja i możliwość odtworzenia wybranych tabel
sudo -u postgres pg_dump -Fc "$BAZA" > "$PLIK".tmp
mv "$PLIK".tmp "$PLIK"
chmod 600 "$PLIK"

# Kopia bez sprawdzenia to nadzieja, nie kopia. pg_restore -l czyta spis treści
# archiwum i wywali się, jeśli plik jest obcięty albo uszkodzony.
if ! pg_restore -l "$PLIK" > /dev/null 2>&1; then
  echo "$(date '+%F %T') BŁĄD: kopia $PLIK jest nieczytelna, usuwam"
  rm -f "$PLIK"
  exit 1
fi

TABEL=$(pg_restore -l "$PLIK" | grep -c "TABLE DATA" || true)
if [ "$TABEL" -lt 10 ]; then
  echo "$(date '+%F %T') BŁĄD: kopia ma tylko $TABEL tabel z danymi — to za mało, usuwam"
  rm -f "$PLIK"
  exit 1
fi

# Starsze niż ILE_DNI usuwamy, żeby dysk nie zapełnił się po cichu — a zapełniony
# dysk zatrzymuje też bazę.
find "$KATALOG" -name "${BAZA}_*.dump" -mtime +$ILE_DNI -delete

echo "$(date '+%F %T') OK: $PLIK ($(du -h "$PLIK" | cut -f1), tabel z danymi: $TABEL)"
