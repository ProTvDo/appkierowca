-- Panel dyspozytora + rozliczenie wyjazdu — uruchom raz w Supabase SQL Editor

alter table kierowcy
  add column if not exists rola text not null default 'kierowca'
  check (rola in ('kierowca', 'admin'));

alter table pojazdy
  add column if not exists nr_rejestracyjny text;

alter table wyjazdy_turystyczne
  add column if not exists zaliczka numeric,
  add column if not exists zakonczony boolean not null default false,
  add column if not exists pojazd_id bigint references pojazdy(id);

create table if not exists tankowania (
  id         bigint generated always as identity primary key,
  wyjazd_id  bigint not null references wyjazdy_turystyczne(id) on delete cascade,
  litry      numeric not null,
  koszt      numeric not null,
  created_at timestamptz not null default now()
);
