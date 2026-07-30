-- Wersja "turystyka". Uruchom raz: psql -d kierowcaapp -f wyjazdy-turystyczne-schema.sql

alter table kierowcy
  add column if not exists wersja text not null default 'miejski'
  check (wersja in ('miejski', 'turystyka', 'liniowe'));

create table if not exists wyjazdy_turystyczne (
  id                  bigint generated always as identity primary key,
  kierowca_id         bigint not null references kierowcy(id) on delete cascade,
  data                date not null,
  cel_podrozy         text not null,
  godz_wyjazdu        time,
  godz_podstawienia   time,
  godz_dojazdu        time,
  kilometry           int,
  pilot_imie_nazwisko text,
  pilot_telefon       text,
  nr_rejestracyjny    text,
  marka_model         text,
  nr_boczny           text,
  dodatkowe_info      text,
  created_at          timestamptz not null default now()
);
