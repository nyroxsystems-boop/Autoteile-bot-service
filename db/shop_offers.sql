-- SQL-Schema für die Tabelle "shop_offers" in Supabase.
-- Diese Datei wird NICHT automatisch ausgeführt.
-- Kopiere den Inhalt in den SQL-Editor deines Supabase-Projekts
-- und führe ihn dort aus.

-- create extension if not exists "pgcrypto";

create table if not exists public.shop_offers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  order_id uuid not null,              -- Verknüpfung zur Order
  oem_number text not null,            -- OEM, auf deren Basis gesucht wurde
  shop_name text not null,             -- z.B. "Autodoc", "KFZTeile24"
  brand text,                          -- z.B. "ATE", "Brembo"
  price numeric not null,              -- Preis
  currency text not null default 'EUR',
  availability text,                   -- z.B. "In stock"
  delivery_time_days integer,          -- z.B. 2
  product_url text,
  rating numeric,                      -- z.B. 4.7
  is_recommended boolean               -- vom System markiert
);

create index if not exists idx_shop_offers_order_id
  on public.shop_offers (order_id);

create index if not exists idx_shop_offers_oem_number
  on public.shop_offers (oem_number);
