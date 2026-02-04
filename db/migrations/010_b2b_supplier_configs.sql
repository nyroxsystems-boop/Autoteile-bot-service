-- B2B Supplier Integration
-- Migration: 010_b2b_supplier_configs.sql

-- B2B Supplier Configurations (per tenant)
CREATE TABLE IF NOT EXISTS b2b_supplier_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,  -- 'inter_cars', 'moto_profil', 'auto_partner', 'gordon'
  enabled INTEGER DEFAULT 0,    -- SQLite boolean
  
  -- API Credentials (should be encrypted in production)
  api_key TEXT,
  api_secret TEXT,
  account_number TEXT,
  username TEXT,
  password_hash TEXT,
  
  -- Pricing Configuration
  price_tier TEXT DEFAULT 'basic',  -- 'basic', 'silver', 'gold', 'platinum'
  margin_type TEXT DEFAULT 'percentage',  -- 'percentage' or 'fixed'
  margin_value REAL DEFAULT 15.0,   -- e.g., 15 for 15%
  minimum_margin REAL DEFAULT 5.0,  -- Never go below this
  rounding_strategy TEXT DEFAULT 'up',  -- 'up', 'down', 'nearest'
  round_to REAL DEFAULT 0.99,       -- Round to nearest X (e.g., 0.99, 0.50)
  
  -- Priority (lower = higher priority)
  priority INTEGER DEFAULT 100,
  
  -- Metadata
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  UNIQUE(tenant_id, supplier_name)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_b2b_configs_tenant ON b2b_supplier_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_b2b_configs_enabled ON b2b_supplier_configs(tenant_id, enabled);

-- B2B Orders tracking
CREATE TABLE IF NOT EXISTS b2b_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_order_id TEXT,           -- Order ID from supplier
  customer_order_id TEXT,           -- Our internal order ID
  
  -- Part Details
  oem_number TEXT,
  part_name TEXT,
  quantity INTEGER DEFAULT 1,
  
  -- Pricing
  purchase_price REAL,              -- What we pay to supplier
  selling_price REAL,               -- What customer pays
  margin_applied REAL,              -- Actual margin amount
  margin_percent REAL,              -- Margin as percentage
  
  -- Status
  status TEXT DEFAULT 'pending',    -- 'pending', 'ordered', 'shipped', 'delivered', 'cancelled'
  supplier_status TEXT,             -- Status from supplier API
  tracking_number TEXT,
  
  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  ordered_at TEXT,
  delivered_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_b2b_orders_tenant ON b2b_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_customer ON b2b_orders(customer_order_id);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_status ON b2b_orders(tenant_id, status);

-- Insert default supplier configs (disabled by default)
INSERT OR IGNORE INTO b2b_supplier_configs (id, tenant_id, supplier_name, enabled, priority)
VALUES 
  ('default_inter_cars', 'default', 'inter_cars', 0, 10),
  ('default_moto_profil', 'default', 'moto_profil', 0, 20),
  ('default_auto_partner', 'default', 'auto_partner', 0, 30),
  ('default_gordon', 'default', 'gordon', 0, 40);
