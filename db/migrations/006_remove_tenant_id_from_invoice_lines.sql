-- Migration 006: Safely remove tenant_id from invoice_lines if it exists
-- This is a safer alternative to migration 005 (which drops the entire table)

-- Remove tenant_id column if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'invoice_lines' 
        AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE invoice_lines DROP COLUMN tenant_id;
    END IF;
END $$;
