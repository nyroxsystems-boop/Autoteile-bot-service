-- Migration 007: Force correct invoice_lines schema
-- This migration ensures invoice_lines table has the correct schema without tenant_id

-- First, check if invoice_lines exists and has tenant_id column
DO $$ 
DECLARE
    has_tenant_id BOOLEAN;
BEGIN
    -- Check if tenant_id column exists in invoice_lines
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'invoice_lines' 
        AND column_name = 'tenant_id'
    ) INTO has_tenant_id;

    -- If tenant_id exists, we need to recreate the table
    IF has_tenant_id THEN
        RAISE NOTICE 'Found tenant_id in invoice_lines, recreating table...';
        
        -- Drop the table (this will cascade delete all invoice lines)
        DROP TABLE IF EXISTS invoice_lines CASCADE;
        
        -- Recreate with correct schema (no tenant_id)
        CREATE TABLE invoice_lines (
            id TEXT PRIMARY KEY,
            invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
            description TEXT NOT NULL,
            quantity DECIMAL(10,2) NOT NULL,
            unit_price DECIMAL(12,2) NOT NULL,
            tax_rate INTEGER NOT NULL,
            tax_code VARCHAR(20) NOT NULL,
            line_total DECIMAL(12,2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_invoice_lines_invoice ON invoice_lines(invoice_id);
        CREATE INDEX idx_invoice_lines_tax_code ON invoice_lines(tax_code);
        CREATE INDEX idx_invoice_lines_tax_rate ON invoice_lines(tax_rate);
        
        RAISE NOTICE 'invoice_lines table recreated successfully';
    ELSE
        RAISE NOTICE 'invoice_lines schema is already correct (no tenant_id column)';
    END IF;
END $$;
