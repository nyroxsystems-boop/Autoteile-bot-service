-- Migration: Add billing_design_settings table
-- Stores custom PDF design settings per tenant (colors, fonts, logos, etc.)

CREATE TABLE IF NOT EXISTS billing_design_settings (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    
    -- Colors
    invoice_color TEXT DEFAULT '#000000',
    accent_color TEXT DEFAULT '#f3f4f6',
    
    -- Typography
    invoice_font TEXT DEFAULT 'helvetica',
    
    -- Layout
    logo_position TEXT DEFAULT 'left' CHECK (logo_position IN ('left', 'center', 'right')),
    number_position TEXT DEFAULT 'right' CHECK (number_position IN ('left', 'right')),
    address_layout TEXT DEFAULT 'two-column' CHECK (address_layout IN ('two-column', 'gestapelt')),
    table_style TEXT DEFAULT 'grid' CHECK (table_style IN ('grid', 'minimal', 'gestreift')),
    
    -- Logo (base64 encoded image)
    logo_base64 TEXT,
    
    -- Company info (optional overrides)
    company_name TEXT,
    company_address TEXT,
    company_city TEXT,
    company_zip TEXT,
    
    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    -- Constraints
    UNIQUE(tenant_id)
);

-- Index for fast tenant lookups
CREATE INDEX IF NOT EXISTS idx_billing_design_tenant ON billing_design_settings(tenant_id);
