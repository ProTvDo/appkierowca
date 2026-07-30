-- Adresaci powiadomień osobno dla każdej firmy.
--
-- Do tej pory adresat był jeden dla całej aplikacji (EMAIL_BIURO/EMAIL_MISTRZ
-- w konfiguracji serwera), więc po uruchomieniu poczty każda firma wysyłałaby
-- podsumowania wyjazdów i zgłoszenia usterek na skrzynkę ProTvDo, a jej własne
-- biuro nie dostawałoby nic. Konto nadawcze (SMTP) zostaje wspólne — to tylko
-- tożsamość nadawcy — ale adresat musi należeć do firmy.
--
-- Oba pola są opcjonalne: firma z jedną skrzynką wpisuje sam adres biura,
-- firma z osobnym warsztatem wpisuje dwa. Kolejność zastępowania jest
-- rozstrzygana w kodzie (lib/adresaci.js).

begin;

alter table firmy
  add column if not exists email_biuro  text,
  add column if not exists email_serwis text;

comment on column firmy.email_biuro is
  'Podsumowania zakończonych wyjazdów i protokoły z uwagami. Brak → kontakt_email.';
comment on column firmy.email_serwis is
  'Zgłoszenia usterek. Brak → email_biuro, dalej kontakt_email.';

-- Firmy dodane przed tą zmianą mają wpisany tylko kontakt_email — przenosimy
-- go na biuro, żeby powiadomienia od razu trafiały we właściwe miejsce.
update firmy
   set email_biuro = kontakt_email
 where email_biuro is null
   and kontakt_email is not null
   and kontakt_email <> '';

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'kierowcaapp_user') then
    grant all privileges on all tables    in schema public to kierowcaapp_user;
    grant all privileges on all sequences in schema public to kierowcaapp_user;
  end if;
end $$;

commit;
