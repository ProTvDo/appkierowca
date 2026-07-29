-- Pełny schemat KierowcaApp dla zwykłego PostgreSQL (odtworzenie ze schematu Supabase)

create table kierowcy (
  id            bigint generated always as identity primary key,
  nr_sluzbowy   text not null unique,
  imie          text not null,
  nazwisko      text not null,
  pin_hash      text not null,
  aktywny       boolean not null default true,
  zajezdnia_id  int,
  wersja        text not null default 'miejski' check (wersja in ('miejski', 'turystyka', 'liniowe')),
  firma         text,
  rola          text not null default 'kierowca' check (rola in ('kierowca', 'admin'))
);

create table pojazdy (
  id                bigint generated always as identity primary key,
  nr_boczny         text unique,
  marka             text,
  model             text,
  nr_rejestracyjny  text
);

create table kontakty (
  id         bigint generated always as identity primary key,
  nazwa      text not null,
  telefon    text,
  aktywny    boolean not null default true,
  kolejnosc  int not null default 0
);

create table grafiki (
  id           bigint generated always as identity primary key,
  kierowca_id  bigint not null references kierowcy(id) on delete cascade,
  data         date not null,
  linia        text,
  brygada      text,
  zmiana       text,
  godz_start   time,
  godz_koniec  time,
  wolne        boolean not null default false,
  uwagi        text,
  pojazd_id    bigint references pojazdy(id),
  unique (kierowca_id, data)
);

create table kategorie_usterek (
  id     bigint generated always as identity primary key,
  nazwa  text not null unique,
  ikona  text
);

create table usterki (
  id             bigint generated always as identity primary key,
  kierowca_id    bigint not null references kierowcy(id) on delete cascade,
  pojazd_id      bigint references pojazdy(id),
  kategoria_id   bigint references kategorie_usterek(id),
  opis           text,
  lokalizacja    text,
  status         text not null default 'nowa',
  zdjecie_url    text,
  email_wyslany  boolean not null default false,
  created_at     timestamptz not null default now()
);

create table wyjazdy_turystyczne (
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
  zaliczka            numeric,
  zakonczony          boolean not null default false,
  pojazd_id           bigint references pojazdy(id),
  created_at          timestamptz not null default now()
);

create table tankowania (
  id          bigint generated always as identity primary key,
  wyjazd_id   bigint not null references wyjazdy_turystyczne(id) on delete cascade,
  litry       numeric not null,
  koszt       numeric not null,
  created_at  timestamptz not null default now()
);

create table materialy_szkoleniowe (
  id             bigint generated always as identity primary key,
  tytul          text not null,
  typ            text not null check (typ in ('artykul', 'wideo')),
  tresc          text,
  wideo_url      text,
  opis_skrocony  text,
  kolejnosc      int not null default 0,
  aktywny        boolean not null default true,
  created_at     timestamptz not null default now()
);

create table testy (
  id          bigint generated always as identity primary key,
  tytul       text not null,
  material_id bigint references materialy_szkoleniowe(id) on delete set null,
  aktywny     boolean not null default true
);

create table pytania_testowe (
  id        bigint generated always as identity primary key,
  test_id   bigint not null references testy(id) on delete cascade,
  tresc     text not null,
  kolejnosc int not null default 0
);

create table odpowiedzi_testowe (
  id            bigint generated always as identity primary key,
  pytanie_id    bigint not null references pytania_testowe(id) on delete cascade,
  tresc         text not null,
  czy_poprawna  boolean not null default false
);

create table wyniki_testow (
  id            bigint generated always as identity primary key,
  kierowca_id   bigint not null references kierowcy(id) on delete cascade,
  test_id       bigint not null references testy(id) on delete cascade,
  wynik_procent int not null,
  zdany         boolean not null,
  created_at    timestamptz not null default now()
);

create table postepy_szkolen (
  id          bigint generated always as identity primary key,
  kierowca_id bigint not null references kierowcy(id) on delete cascade,
  material_id bigint not null references materialy_szkoleniowe(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (kierowca_id, material_id)
);

create table uprawnienia_kierowcow (
  id            bigint generated always as identity primary key,
  kierowca_id   bigint not null references kierowcy(id) on delete cascade,
  nazwa         text not null,
  data_waznosci date not null
);
