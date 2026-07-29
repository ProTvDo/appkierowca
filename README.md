# AppKierowca

Aplikacja dla kierowców i firm transportowych — grafik pracy, wyjazdy, usterki,
kontakty i moduł szkoleniowy. Całość projektu w jednym repozytorium.

## Struktura

| Katalog | Co to jest | Stack |
|---|---|---|
| `api/` | Backend — REST API | Node.js, Express 5, PostgreSQL (`pg`), JWT |
| `pwa/` | Aplikacja dla kierowcy i panel dyspozytora | React 19, Vite, axios |
| `www/` | Strona marketingowa appkierowca.pl | HTML, CSS, JS, PHP (formularz kontaktowy) |
| `demo/` | Klikalne demo aplikacji (jeden plik HTML) | HTML |

`api/` i `pwa/` zostały wciągnięte przez `git subtree` z osobnych repozytoriów
`ProTvDo/kierowca-api` i `ProTvDo/kierowca-pwa` wraz z pełną historią commitów.

## Uruchomienie lokalne

Backend — wymaga działającego PostgreSQL i pliku `api/.env`:

```bash
cd api && npm install && node server.js
```

Domyślnie nasłuchuje na porcie 3001. Schemat bazy do postawienia od zera:
`api/sql/schemat-pelny-postgres.sql`, migracje pomocnicze w pozostałych plikach
w `api/sql/`.

Frontend — wymaga pliku `pwa/.env` ze wskazaniem adresu API:

```bash
cd pwa && npm install && npm run dev
```

Vite podnosi się na porcie 5173 (lub 5174); oba adresy są dopuszczone w CORS
backendu.

Strona i demo to statyczne pliki — wystarczy dowolny serwer HTTP. `www/wyslij.php`
wymaga PHP z obsługą `mail()`.

## Konfiguracja

Pliki `.env` nie trafiają do repozytorium. Backend czyta:
`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `PORT`
oraz dane SMTP dla nodemailera.
