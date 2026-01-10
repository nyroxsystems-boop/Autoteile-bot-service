-- Add generated_invoice_id column to orders table
-- This migration is idempotent (safe to run multiple times)

DO $$
BEGIN
    -- Check if column exists, if not, add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'generated_invoice_id'
    ) THEN
        ALTER TABLE orders 
        ADD COLUMN generated_invoice_id TEXT;
        
        -- Add index for the new column
        CREATE INDEX IF NOT EXISTS idx_orders_generated_invoice ON orders(generated_invoice_id);
        
        RAISE NOTICE 'Added generated_invoice_id column to orders table';
    ELSE
        RAISE NOTICE 'generated_invoice_id column already exists in orders table';
    END IF;
END $$;
