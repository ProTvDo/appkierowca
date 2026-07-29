-- Firmy jako osobny byt + okres próbny + rozdzielenie danych między firmami.
--
-- Do tej pory nazwa firmy była zwykłym tekstem przy kierowcy i nic po niej nie
-- filtrowało — każdy kierowca widział kontakty, pojazdy i materiały wszystkich
-- firm naraz. Przy jednej firmie testowej niewidoczne, przy drugiej to wyciek.
--
-- Migracja jest idempotentna — można ją puścić drugi raz bez szkody.

begin;

-- ── 1. Firmy ──────────────────────────────────────────────────────────────
create table if not exists firmy (
  id          bigint generated always as identity primary key,
  nazwa       text not null unique,
  -- Kod używany jako subdomena: pks-gdynia.appkierowca.pl. Dzięki niemu
  -- kierowca loguje się samym numerem i PIN-em — firmę rozpoznaje adres,
  -- a numery służbowe nie muszą być unikalne między firmami.
  kod         text unique
              check (kod ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'
                     and kod not in ('app','api','www','demo','mail','ftp','admin','test','panel')),
  -- Branża, w której firma testuje aplikację. Nowi kierowcy dziedziczą tę
  -- wartość; kierowcy.wersja zostaje, bo w danych demo jedna firma ma konta
  -- z różnych branż i migracja nie może tego zgubić.
  wersja      text not null default 'miejski'
              check (wersja in ('miejski', 'turystyka', 'liniowe')),
  -- Koniec okresu próbnego. NULL = bez ograniczenia czasowego (konta własne,
  -- demo pokazowe). Data, nie timestamp — liczy się cały dzień do północy.
  trial_do    date,
  aktywna     boolean not null default true,
  kontakt_osoba   text,
  kontakt_email   text,
  kontakt_telefon text,
  notatki     text,
  created_at  timestamptz not null default now()
);

comment on column firmy.trial_do is
  'Ostatni dzień okresu próbnego włącznie. NULL = bezterminowo.';

-- ── 2. Przypisanie firmy do danych ────────────────────────────────────────
-- Dane firmowe: bez firmy nie mają sensu, po migracji NOT NULL.
alter table kierowcy  add column if not exists firma_id bigint references firmy(id);
alter table pojazdy   add column if not exists firma_id bigint references firmy(id);
alter table kontakty  add column if not exists firma_id bigint references firmy(id);

-- Treści współdzielone: NULL = wspólne dla wszystkich firm (baza wiedzy,
-- standardowe kategorie usterek), wartość = materiał własny firmy.
alter table kategorie_usterek     add column if not exists firma_id bigint references firmy(id);
alter table materialy_szkoleniowe add column if not exists firma_id bigint references firmy(id);
alter table testy                 add column if not exists firma_id bigint references firmy(id);

-- ── 3. Przeniesienie istniejących danych ──────────────────────────────────
-- Firmy z tego, co jest dziś w kolumnie tekstowej kierowcy.firma.
with nazwy as (
  select coalesce(nullif(trim(firma), ''), 'Demo ProTvDo') as nazwa, wersja
    from kierowcy
), wybor as (
  select nazwa, wersja,
         row_number() over (partition by nazwa order by count(*) desc, wersja) as rn
    from nazwy
   group by nazwa, wersja
)
insert into firmy (nazwa, wersja)
select nazwa, wersja from wybor where rn = 1
on conflict (nazwa) do nothing;

-- Kod z nazwy: polskie znaki na łacińskie, resztę na myślniki.
update firmy set kod = trim(both '-' from regexp_replace(
         lower(translate(nazwa, 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzACELNOSZZ')),
         '[^a-z0-9]+', '-', 'g'))
 where kod is null;

update kierowcy k
   set firma_id = f.id
  from firmy f
 where k.firma_id is null
   and f.nazwa = coalesce(nullif(trim(k.firma), ''), 'Demo ProTvDo');

-- Pojazdy i kontakty istniały bez podziału na firmy — trafiają do firmy
-- pierwotnej (najstarszej), żeby nie zniknęły z aplikacji po migracji.
update pojazdy  set firma_id = (select min(id) from firmy) where firma_id is null;
update kontakty set firma_id = (select min(id) from firmy) where firma_id is null;

-- Kategorie usterek zostają wspólne (firma_id NULL) — to standardowa lista,
-- a nie dane należące do konkretnej firmy.

-- ── 4. Domknięcie więzów ──────────────────────────────────────────────────
alter table kierowcy alter column firma_id set not null;
alter table pojazdy  alter column firma_id set not null;
alter table kontakty alter column firma_id set not null;

create index if not exists kierowcy_firma_id_idx  on kierowcy(firma_id);
create index if not exists pojazdy_firma_id_idx   on pojazdy(firma_id);
create index if not exists kontakty_firma_id_idx  on kontakty(firma_id);

-- Numer służbowy był unikalny globalnie — dwie firmy nie mogłyby mieć
-- kierowcy o tym samym numerze, a numery nadaje sobie każda firma sama.
alter table kierowcy drop constraint if exists kierowcy_nr_sluzbowy_key;
create unique index if not exists kierowcy_firma_nr_sluzbowy_key
  on kierowcy(firma_id, nr_sluzbowy);

-- Rola ponad firmami: zakłada firmy, ustawia i przedłuża okresy próbne.
-- 'admin' to dyspozytor po stronie firmy i nie widzi niczego spoza niej.
alter table kierowcy drop constraint if exists kierowcy_rola_check;
alter table kierowcy add constraint kierowcy_rola_check
  check (rola in ('kierowca', 'admin', 'superadmin'));

commit;
