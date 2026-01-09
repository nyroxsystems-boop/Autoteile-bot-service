-- Tax Module Schema
-- Migration 003: Core tax tables for German UStVA compliance

-- Tax Profiles (per tenant)
CREATE TABLE IF NOT EXISTS tax_profiles (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    business_type VARCHAR(50) NOT NULL,  -- 'sole_trader' | 'company'
    tax_number VARCHAR(50),
    vat_id VARCHAR(50),
    tax_method VARCHAR(10) NOT NULL,     -- 'IST' | 'SOLL'
    small_business BOOLEAN DEFAULT FALSE,
    period_type VARCHAR(20) NOT NULL,    -- 'monthly' | 'quarterly'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tax_profiles_tenant ON tax_profiles(tenant_id);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE,
    paid_at TIMESTAMP,
    customer_id TEXT,
    customer_name VARCHAR(255),
    billing_country VARCHAR(2) NOT NULL DEFAULT 'DE',  -- 'DE' | other ISO codes
    net_amount DECIMAL(12,2) NOT NULL,
    vat_amount DECIMAL(12,2) NOT NULL,
    gross_amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',          -- 'draft' | 'issued' | 'paid' | 'canceled'
    notes TEXT,
    source_order_id TEXT,                                  -- Link to order if created from order
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_paid_at ON invoices(paid_at);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);

-- Invoice Lines
CREATE TABLE IF NOT EXISTS invoice_lines (
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

-- Tax Periods (Aggregated)
CREATE TABLE IF NOT EXISTS tax_periods (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    period_type VARCHAR(20) NOT NULL,     -- 'monthly' | 'quarterly'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_net DECIMAL(12,2) DEFAULT 0,
    vat_19 DECIMAL(12,2) DEFAULT 0,
    vat_7 DECIMAL(12,2) DEFAULT 0,
    vat_0 DECIMAL(12,2) DEFAULT 0,
    input_tax DECIMAL(12,2) DEFAULT 0,     -- Vorsteuer
    tax_due DECIMAL(12,2) DEFAULT 0,       -- Zahllast (vat_19 + vat_7 - input_tax)
    status VARCHAR(20) NOT NULL DEFAULT 'open',           -- 'open' | 'calculated' | 'exported'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_tax_periods_tenant ON tax_periods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tax_periods_dates ON tax_periods(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_tax_periods_status ON tax_periods(status);

-- Tax Export Log
CREATE TABLE IF NOT EXISTS tax_export_log (
    id TEXT PRIMARY KEY,
    tax_period_id TEXT NOT NULL REFERENCES tax_periods(id) ON DELETE CASCADE,
    export_type VARCHAR(20) NOT NULL,     -- 'DOWNLOAD' (no ELSTER upload)
    file_path TEXT,
    exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'ready',          -- 'ready' | 'failed'
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_tax_export_period ON tax_export_log(tax_period_id);
CREATE INDEX IF NOT EXISTS idx_tax_export_status ON tax_export_log(status);
