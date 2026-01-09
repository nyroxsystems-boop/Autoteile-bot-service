-- Migration 008: Fix source_order_id column type from UUID to TEXT
-- The column was incorrectly created as UUID on Railway, but should be TEXT to match order IDs

-- Check if source_order_id exists and is UUID type
DO $$
BEGIN
    -- Drop the column if it exists as UUID
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'source_order_id'
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE invoices DROP COLUMN source_order_id;
        RAISE NOTICE 'Dropped UUID source_order_id column';
    END IF;
    
    -- Add it back as TEXT if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'source_order_id'
    ) THEN
        ALTER TABLE invoices ADD COLUMN source_order_id TEXT;
        RAISE NOTICE 'Added TEXT source_order_id column';
    END IF;
END $$;
