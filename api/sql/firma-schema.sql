-- Nazwa firmy per konto kierowcy — uruchom raz w Supabase SQL Editor

alter table kierowcy
  add column if not exists firma text;
