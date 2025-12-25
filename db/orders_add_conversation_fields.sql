-- Ergänzt die orders-Tabelle um Felder, die der aktuelle Bot-Flow benötigt.
-- In Supabase im SQL-Editor ausführen.

alter table public.orders
  add column if not exists language text,
  add column if not exists order_data jsonb default null,
  add column if not exists vehicle_description text,
  add column if not exists part_description text,
  add column if not exists vehicle_document_image_url text,
  alter column status set default 'choose_language';
