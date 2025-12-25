-- Migration: create merchant_settings table
-- Adds per-merchant configuration for selected supplier shops and margin percent
-- Safe to run multiple times (creates table only if not exists)

CREATE TABLE IF NOT EXISTS merchant_settings (
  merchant_id TEXT PRIMARY KEY,
  selected_shops JSONB DEFAULT '[]'::jsonb,
  margin_percent NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to update updated_at on modifications
CREATE OR REPLACE FUNCTION merchant_settings_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_merchant_settings_updated_at ON merchant_settings;
CREATE TRIGGER trg_merchant_settings_updated_at
BEFORE UPDATE ON merchant_settings
FOR EACH ROW EXECUTE FUNCTION merchant_settings_set_updated_at();

-- Optional: grant minimal privileges if using a separate role (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE ON merchant_settings TO your_role;

-- Rollback: drop table
-- DROP TABLE IF EXISTS merchant_settings;
