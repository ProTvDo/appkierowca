-- Nazwa firmy per konto kierowcy. Uruchom raz: psql -d kierowcaapp -f firma-schema.sql

alter table kierowcy
  add column if not exists firma text;
