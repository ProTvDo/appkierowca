# Wdrożenie na VPS

Serwer docelowy: **51.83.130.44**, Ubuntu, nginx 1.28, SSH na porcie 22.
Domeny idą przez Cloudflare, więc origin nigdy nie jest odpytywany wprost
z internetu — certyfikaty i tak wystawiamy na serwerze (tryb Full/strict).

Stan wyjściowy: `www/` (appkierowca.pl) jest już na tym serwerze. Do wdrożenia
zostają `api/` i `pwa/`.

## Docelowy układ

| Adres | Co obsługuje |
|---|---|
| appkierowca.pl | `www/` — strona marketingowa (już działa) |
| app.appkierowca.pl | `pwa/dist` — aplikacja, plus `/api` przekazywane do backendu |
| api.appkierowca.pl | backend bezpośrednio — diagnostyka i klienci spoza przeglądarki |

Backend nasłuchuje wyłącznie na `127.0.0.1:3001`. Na świat wystawia go nginx.
PostgreSQL nasłuchuje wyłącznie lokalnie — port 5432 nie może być otwarty na zewnątrz.

## 1. Użytkownik systemowy i katalog

```bash
sudo adduser --system --group --home /var/www/appkierowca appkierowca
sudo mkdir -p /var/www/appkierowca && sudo chown appkierowca:appkierowca /var/www/appkierowca
```

## 2. Kod z GitHuba

Repozytorium jest prywatne, więc serwer potrzebuje własnego klucza deploy
(read-only, dodawanego w ustawieniach repo → Deploy keys):

```bash
sudo -u appkierowca ssh-keygen -t ed25519 -f /var/www/appkierowca/.ssh/id_ed25519 -N ""
sudo -u appkierowca cat /var/www/appkierowca/.ssh/id_ed25519.pub
sudo -u appkierowca git clone git@github.com:ProTvDo/appkierowca.git /var/www/appkierowca
```

## 3. Baza danych

```bash
sudo apt install -y postgresql
sudo -u postgres createuser kierowcaapp_user --pwprompt
sudo -u postgres createdb kierowcaapp -O kierowcaapp_user
sudo -u postgres psql -d kierowcaapp -f /var/www/appkierowca/api/sql/schemat-pelny-postgres.sql
```

Jeśli dane mają przyjechać ze starego serwera, zamiast ładowania schematu:

```bash
# na starym VPS
pg_dump -Fc kierowcaapp > kierowcaapp.dump
# po przeniesieniu pliku, na nowym
pg_restore -d kierowcaapp --no-owner --role=kierowcaapp_user kierowcaapp.dump
```

## 4. Backend

```bash
cd /var/www/appkierowca/api
sudo -u appkierowca cp .env.przyklad .env   # i uzupełnić hasło DB oraz JWT_SECRET
sudo -u appkierowca npm ci --omit=dev
sudo cp /var/www/appkierowca/deploy/appkierowca-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now appkierowca-api
systemctl status appkierowca-api
```

Kontrola: `curl http://127.0.0.1:3001/api/ping` ma zwrócić `{"ok":true,...}`.

## 5. Frontend

```bash
cd /var/www/appkierowca/pwa
sudo -u appkierowca npm ci
sudo -u appkierowca npm run build      # powstaje pwa/dist
```

`pwa/.env` musi zawierać `VITE_API_URL=/api` — adres względny sprawia, że
aplikacja woła API po tym samym origin i nie dotyka jej CORS.

## 6. nginx i certyfikaty

```bash
sudo cp /var/www/appkierowca/deploy/nginx/*.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/app.appkierowca.pl.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api.appkierowca.pl.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.appkierowca.pl -d api.appkierowca.pl
```

W Cloudflare obie subdomeny potrzebują rekordu A na 51.83.130.44, a tryb SSL
musi być **Full (strict)** — przy "Flexible" logowanie wpadnie w pętlę przekierowań.

## Aktualizacja po zmianach w kodzie

```bash
cd /var/www/appkierowca && sudo -u appkierowca git pull
cd api && sudo -u appkierowca npm ci --omit=dev && sudo systemctl restart appkierowca-api
cd ../pwa && sudo -u appkierowca npm ci && sudo -u appkierowca npm run build
```
