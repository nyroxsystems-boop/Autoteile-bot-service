-- WAWI (Warehouse Management) Tables Migration
-- Creates tables for stock locations, purchase orders, and related entities
-- NOTE: companies.id is TEXT in existing schema, not UUID!

-- Stock Locations Table
CREATE TABLE IF NOT EXISTS stock_locations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(50) DEFAULT 'shelf', -- main, shelf, returns, quarantine
    description TEXT,
    capacity INTEGER,
    current_stock INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_locations_tenant ON stock_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_locations_code ON stock_locations(code);
CREATE INDEX IF NOT EXISTS idx_stock_locations_type ON stock_locations(type);

-- Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_number VARCHAR(100) UNIQUE NOT NULL,
    supplier_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    status VARCHAR(50) DEFAULT 'draft', -- draft, sent, confirmed, received, cancelled
    order_date TIMESTAMP NOT NULL,
    expected_delivery TIMESTAMP,
    received_date TIMESTAMP,
    total_amount DECIMAL(12, 2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'EUR',
    notes TEXT,
    tenant_id VARCHAR(100) NOT NULL,
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date ON purchase_orders(order_date);

-- Purchase Order Items Table
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    part_id TEXT REFERENCES parts(id),
    part_name VARCHAR(255) NOT NULL,
    part_ipn VARCHAR(100),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    received_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_part ON purchase_order_items(part_id);

-- Stock Movements Table
CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    part_id TEXT REFERENCES parts(id),
    type VARCHAR(50) NOT NULL, -- IN, OUT, TRANSFER, CORRECTION
    quantity INTEGER NOT NULL,
    from_location_id TEXT REFERENCES stock_locations(id),
    to_location_id TEXT REFERENCES stock_locations(id),
    reference VARCHAR(255), -- e.g., PO number, order number
    notes TEXT,
    tenant_id VARCHAR(100) NOT NULL,
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_part ON stock_movements(part_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_from_location ON stock_movements(from_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_to_location ON stock_movements(to_location_id);

-- Part Stock by Location (materialized view or table for quick lookups)
CREATE TABLE IF NOT EXISTS part_stock_locations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 0,
    tenant_id VARCHAR(100) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(part_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_part_stock_locations_part ON part_stock_locations(part_id);
CREATE INDEX IF NOT EXISTS idx_part_stock_locations_location ON part_stock_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_part_stock_locations_tenant ON part_stock_locations(tenant_id);

-- Add missing columns to existing tables if needed
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_is_supplier ON companies(is_supplier);
