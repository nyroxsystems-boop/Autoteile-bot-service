-- Adds OEM- and scraping-related columns to the orders table.
-- Run this in your Supabase SQL editor or psql.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS oem_status text,
  ADD COLUMN IF NOT EXISTS oem_error text,
  ADD COLUMN IF NOT EXISTS oem_data jsonb,
  ADD COLUMN IF NOT EXISTS oem_number text,
  ADD COLUMN IF NOT EXISTS scrape_status text,
  ADD COLUMN IF NOT EXISTS scrape_result jsonb;
