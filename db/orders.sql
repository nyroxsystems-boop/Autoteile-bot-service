-- SQL-Schema für die Tabelle "orders" in Supabase.
-- Diese Datei wird NICHT automatisch ausgeführt.
-- Kopiere den Inhalt in den SQL-Editor deines Supabase-Projekts
-- und führe ihn dort aus.

-- Erweiterung für gen_random_uuid() (falls noch nicht aktiv)
-- In vielen Supabase-Projekten ist sie bereits aktiviert.
-- create extension if not exists "pgcrypto";

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  customer_name text,
  customer_contact text,             -- z.B. WhatsApp-Nummer oder Name
  vehicle_id uuid,                   -- spätere Verknüpfung zu einer vehicles-Tabelle

  requested_part_name text not null, -- z.B. "Bremssattel vorne links"
  oem_number text,                   -- erkannte OEM-Nummer
  status text not null default 'choose_language', -- Conversation/Order-Status
  match_confidence numeric,          -- 0–1, wie sicher ist das Matching

  -- Dialog-/Kontext-Daten
  language text,
  order_data jsonb default null,
  vehicle_description text,
  part_description text,
  vehicle_document_image_url text
);

-- Trigger-Funktion, um updated_at automatisch zu setzen
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger auf der orders-Tabelle
drop trigger if exists set_orders_updated_at on public.orders;

create trigger set_orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();
