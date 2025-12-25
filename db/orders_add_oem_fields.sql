-- Neue Spalten für OEM-Fortschritt
alter table public.orders
  add column if not exists oem_status text default null,        -- z.B. "pending", "resolved", "failed"
  add column if not exists oem_error text default null,         -- Fehlermeldung falls nötig
  add column if not exists oem_data jsonb default null;         -- OEM + zusätzliche Infos
