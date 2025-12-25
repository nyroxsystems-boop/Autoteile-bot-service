-- SQL-Schema für die Tabelle "vehicles" in Supabase.
-- Diese Datei wird NICHT automatisch ausgeführt.
-- Kopiere den Inhalt in den SQL-Editor deines Supabase-Projekts
-- und führe ihn dort aus.

-- create extension if not exists "pgcrypto";

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  make text,          -- z.B. BMW
  model text,         -- z.B. 316ti
  year integer,
  engine_code text,   -- optional Motorcode / Kurzbezeichnung
  vin text,
  hsn text,
  tsn text,
  raw_data jsonb      -- optional: TecDoc / Rohdaten
);

create index if not exists idx_vehicles_make_model_year
  on public.vehicles (make, model, year);
