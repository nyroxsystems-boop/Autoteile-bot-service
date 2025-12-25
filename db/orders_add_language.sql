-- Erweiterung der orders-Tabelle um ein language-Feld.

alter table public.orders
  add column if not exists language text;
