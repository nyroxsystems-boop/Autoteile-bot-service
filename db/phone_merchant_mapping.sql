-- Phone to Merchant Mapping Table
-- Maps WhatsApp phone numbers to merchant accounts
-- This allows automatic assignment of incoming messages to the correct merchant/user

CREATE TABLE IF NOT EXISTS phone_merchant_mapping (
  phone_number TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  user_email TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by merchant
CREATE INDEX IF NOT EXISTS idx_phone_merchant_merchant_id ON phone_merchant_mapping(merchant_id);
CREATE INDEX IF NOT EXISTS idx_phone_merchant_email ON phone_merchant_mapping(user_email);

-- Trigger to update updated_at on modifications
CREATE OR REPLACE FUNCTION phone_merchant_mapping_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_phone_merchant_mapping_updated_at ON phone_merchant_mapping;
CREATE TRIGGER trg_phone_merchant_mapping_updated_at
BEFORE UPDATE ON phone_merchant_mapping
FOR EACH ROW EXECUTE FUNCTION phone_merchant_mapping_set_updated_at();

-- Insert test mapping
INSERT INTO phone_merchant_mapping (phone_number, merchant_id, user_email, notes)
VALUES ('whatsapp:+14155238886', 'admin', 'nyroxsystem@gmail.com', 'Test number for development')
ON CONFLICT (phone_number) DO UPDATE 
SET merchant_id = EXCLUDED.merchant_id,
    user_email = EXCLUDED.user_email,
    notes = EXCLUDED.notes;
