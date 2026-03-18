-- Migration: 011_invoice_sequences.sql
-- Create a sequence tracking table for GoBD compliant invoice numbering

CREATE TABLE IF NOT EXISTS invoice_sequences (
    tenant_id VARCHAR(255) NOT NULL,
    year INT NOT NULL,
    last_value INT NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, year)
);

-- Initialize sequences for any existing invoices to avoid reusing numbers
INSERT INTO invoice_sequences (tenant_id, year, last_value)
SELECT 
    tenant_id, 
    EXTRACT(YEAR FROM issue_date)::int as year,
    MAX(CAST(REGEXP_REPLACE(invoice_number, '^INV-[0-9]{4}-', '') AS INT)) as last_value
FROM invoices
WHERE invoice_number ~ '^INV-[0-9]{4}-[0-9]+$'
GROUP BY tenant_id, EXTRACT(YEAR FROM issue_date)::int
ON CONFLICT (tenant_id, year) DO NOTHING;
