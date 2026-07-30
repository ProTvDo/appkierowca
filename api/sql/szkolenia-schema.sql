-- Moduł szkoleniowy. Uruchom raz: psql -d kierowcaapp -f szkolenia-schema.sql

create table if not exists materialy_szkoleniowe (
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

create table if not exists testy (
  id          bigint generated always as identity primary key,
  tytul       text not null,
  material_id bigint references materialy_szkoleniowe(id) on delete set null,
  aktywny     boolean not null default true
);

create table if not exists pytania_testowe (
  id        bigint generated always as identity primary key,
  test_id   bigint not null references testy(id) on delete cascade,
  tresc     text not null,
  kolejnosc int not null default 0
);

create table if not exists odpowiedzi_testowe (
  id            bigint generated always as identity primary key,
  pytanie_id    bigint not null references pytania_testowe(id) on delete cascade,
  tresc         text not null,
  czy_poprawna  boolean not null default false
);

create table if not exists wyniki_testow (
  id            bigint generated always as identity primary key,
  kierowca_id   bigint not null references kierowcy(id) on delete cascade,
  test_id       bigint not null references testy(id) on delete cascade,
  wynik_procent int not null,
  zdany         boolean not null,
  created_at    timestamptz not null default now()
);

create table if not exists postepy_szkolen (
  id          bigint generated always as identity primary key,
  kierowca_id bigint not null references kierowcy(id) on delete cascade,
  material_id bigint not null references materialy_szkoleniowe(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (kierowca_id, material_id)
);

create table if not exists uprawnienia_kierowcow (
  id            bigint generated always as identity primary key,
  kierowca_id   bigint not null references kierowcy(id) on delete cascade,
  nazwa         text not null,
  data_waznosci date not null
);
