-- Uzupełnienie karty zlecenia dla wersji turystycznej.
--
-- Kierowca autokaru przed wyjazdem musi wiedzieć rzeczy, których dotąd nie było
-- gdzie zapisać: gdzie są planowane postoje, czy ma opłacony nocleg, kto płaci
-- za winiety i autostrady, jakie są ograniczenia tonażowe na trasie i ile osób
-- jedzie. Bez tego dyspozytor dogaduje to telefonicznie i nic nie zostaje w apce.
--
-- Migracja jest idempotentna.

begin;

alter table wyjazdy_turystyczne
  -- Postoje jako tekst, nie osobna tabela: to lista dla kierowcy do przeczytania,
  -- a nie dane do przetwarzania. Osobna tabela dołożyłaby ekranów bez zysku.
  add column if not exists punkty_postojowe   text,
  add column if not exists nocleg             text,
  add column if not exists wyzywienie         text,
  add column if not exists oplaty_drogowe     text,
  add column if not exists winiety_oplacone   boolean,
  add column if not exists ograniczenia_trasy text,
  add column if not exists wielkosc_grupy     integer;

-- Pojemność autokaru — przy zleceniu na 45 osób dyspozytor musi widzieć, czy
-- podstawia wystarczająco duży pojazd.
alter table pojazdy
  add column if not exists liczba_miejsc integer;

comment on column wyjazdy_turystyczne.winiety_oplacone is
  'Czy biuro opłaciło już winiety/przejazdy. NULL = nie ustalono.';
comment on column wyjazdy_turystyczne.oplaty_drogowe is
  'Kto i jak płaci za autostrady i winiety — np. "karta flotowa", "kierowca, rozliczenie po zjeździe".';
comment on column wyjazdy_turystyczne.ograniczenia_trasy is
  'Ograniczenia tonażowe, wysokości i wjazdu na trasie — np. "most w Tczewie do 12 t".';

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'kierowcaapp_user') then
    grant all privileges on all tables    in schema public to kierowcaapp_user;
    grant all privileges on all sequences in schema public to kierowcaapp_user;
  end if;
end $$;

commit;
