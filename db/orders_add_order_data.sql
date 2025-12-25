-- Erweiterung der orders-Tabelle um ein JSON-Feld für Dialog-/Order-Status-Daten.

alter table public.orders
  add column if not exists order_data jsonb default null;
