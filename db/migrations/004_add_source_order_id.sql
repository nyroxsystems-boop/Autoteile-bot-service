-- Add source_order_id column to existing invoices table
-- This migration is idempotent (safe to run multiple times)

DO $$
BEGIN
    -- Check if column exists, if not, add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'source_order_id'
    ) THEN
        ALTER TABLE invoices 
        ADD COLUMN source_order_id UUID;
        
        -- Add index for the new column
        CREATE INDEX IF NOT EXISTS idx_invoices_source_order ON invoices(source_order_id);
        
        RAISE NOTICE 'Added source_order_id column to invoices table';
    ELSE
        RAISE NOTICE 'source_order_id column already exists in invoices table';
    END IF;
END $$;
