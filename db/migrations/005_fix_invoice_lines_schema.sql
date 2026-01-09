-- Migration 005: Fix invoice_lines schema
-- Remove tenant_id column if it exists (should not be in invoice_lines)

-- Drop and recreate invoice_lines table with correct schema
DROP TABLE IF EXISTS invoice_lines CASCADE;

CREATE TABLE invoice_lines (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    tax_rate INTEGER NOT NULL,            -- 0 | 7 | 19
    tax_code VARCHAR(20) NOT NULL,        -- 'STANDARD' | 'REVERSE' | 'EU' | 'TAX_FREE'
    line_total DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_tax_code ON invoice_lines(tax_code);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_tax_rate ON invoice_lines(tax_rate);
