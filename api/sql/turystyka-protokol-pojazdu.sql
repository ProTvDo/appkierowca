-- Protokół zdawczo-odbiorczy autokaru — check-lista przed i po wyjeździe.
--
-- Dla firmy turystycznej to nie formalność: autokar wraca z rysą albo brakującą
-- gaśnicą i bez protokołu nie da się ustalić, czy stało się to na tym wyjeździe.
-- Kierowca wypełnia to samo zestawienie dwa razy — przy odbiorze i przy zdaniu
-- pojazdu — więc rodzaj rozróżnia te dwa przebiegi.

begin;

create table if not exists protokoly_pojazdu (
  id          bigint generated always as identity primary key,
  wyjazd_id   bigint not null references wyjazdy_turystyczne(id) on delete cascade,
  kierowca_id bigint not null references kierowcy(id) on delete cascade,
  firma_id    bigint not null references firmy(id),

  -- 'odbior' = przed wyjazdem, 'zdanie' = po powrocie
  rodzaj      text not null check (rodzaj in ('odbior', 'zdanie')),

  -- Pozycje check-listy. Osobne kolumny, nie JSON: lista jest stała, a po
  -- kolumnach da się później zapytać "ile razy zgłoszono braki w oponach".
  swiatla     boolean,
  opony       boolean,
  plyny       boolean,
  hamulce     boolean,
  gasnica     boolean,
  apteczka    boolean,
  czystosc_wnetrza boolean,
  klimatyzacja     boolean,

  stan_paliwa text,     -- np. "pełny", "3/4", "40 l"
  licznik_km  integer,
  uszkodzenia text,     -- opis słowny; zdjęcia to osobny etap
  uwagi       text,

  -- Wypełnienie protokołu z brakami musi być widoczne dla biura bez czytania
  -- każdego pola po kolei.
  wszystko_ok boolean not null default true,

  created_at  timestamptz not null default now(),

  -- Jeden protokół odbioru i jeden zdania na wyjazd — powtórne wysłanie
  -- ma poprawiać istniejący, nie mnożyć wpisy.
  unique (wyjazd_id, rodzaj)
);

create index if not exists protokoly_pojazdu_firma_idx  on protokoly_pojazdu(firma_id);
create index if not exists protokoly_pojazdu_wyjazd_idx on protokoly_pojazdu(wyjazd_id);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'kierowcaapp_user') then
    grant all privileges on all tables    in schema public to kierowcaapp_user;
    grant all privileges on all sequences in schema public to kierowcaapp_user;
  end if;
end $$;

commit;
