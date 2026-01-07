-- Tax & Invoice Database Schema
-- Add to existing PostgreSQL database

-- Tax Profiles table
CREATE TABLE IF NOT EXISTS tax_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL UNIQUE,
    business_type VARCHAR(50) NOT NULL, -- 'sole_trader' or 'company'
    tax_method VARCHAR(10) NOT NULL, -- 'IST' or 'SOLL'
    period_type VARCHAR(20) NOT NULL, -- 'monthly' or 'quarterly'
    tax_number VARCHAR(100),
    vat_id VARCHAR(50),
    small_business BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tax_profiles_tenant ON tax_profiles(tenant_id);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE,
    paid_at TIMESTAMP,
    customer_id UUID,
    customer_name VARCHAR(255),
    billing_country VARCHAR(10) DEFAULT 'DE',
    net_amount DECIMAL(12, 2) NOT NULL,
    vat_amount DECIMAL(12, 2) NOT NULL,
    gross_amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'issued', 'paid', 'canceled'
    notes TEXT,
    source_order_id UUID, -- Link to orders table (for auto-generated invoices)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_source_order ON invoices(source_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_tenant_number ON invoices(tenant_id, invoice_number);

-- Invoice Lines table
CREATE TABLE IF NOT EXISTS invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    tax_rate INTEGER NOT NULL, -- 0, 7, or 19
    tax_code VARCHAR(20) DEFAULT 'STANDARD', -- 'STANDARD', 'REVERSE', 'EU', 'TAX_FREE'
    line_total DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);

-- Tax Periods table
CREATE TABLE IF NOT EXISTS tax_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_net DECIMAL(12, 2) DEFAULT 0,
    vat_19 DECIMAL(12, 2) DEFAULT 0,
    vat_7 DECIMAL(12, 2) DEFAULT 0,
    vat_0 DECIMAL(12, 2) DEFAULT 0,
    tax_due DECIMAL(12, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'calculated', 'exported', 'finalized'
    exported_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tax_periods_tenant ON tax_periods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tax_periods_dates ON tax_periods(period_start, period_end);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_periods_tenant_dates ON tax_periods(tenant_id, period_start, period_end);
