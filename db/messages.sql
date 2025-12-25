-- SQL-Schema für die Tabelle "messages" in Supabase.
-- Diese Datei wird NICHT automatisch ausgeführt.
-- Kopiere den Inhalt in den SQL-Editor deines Supabase-Projekts
-- und führe ihn dort aus.

-- create extension if not exists "pgcrypto";

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  order_id uuid,              -- optionale Verknüpfung zu einer Order
  direction text not null,    -- 'incoming' oder 'outgoing'
  channel text not null,      -- z.B. 'whatsapp'
  from_identifier text,       -- z.B. Kunden-Nummer
  to_identifier text,         -- z.B. unsere WhatsApp-Nummer

  content text not null,      -- eigentlicher Nachrichtentext
  raw_payload jsonb           -- optional: kompletter eingehender Payload
);

-- Optional: Index für häufige Abfragen
create index if not exists idx_messages_order_id_created_at
  on public.messages (order_id, created_at);
