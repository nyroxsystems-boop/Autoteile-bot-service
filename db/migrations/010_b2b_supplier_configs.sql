-- Flexible B2B Supplier System
-- Migration: 010_b2b_supplier_configs.sql
-- PostgreSQL compatible

CREATE TABLE IF NOT EXISTS b2b_supplier_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  supplier_key TEXT NOT NULL,  -- 'inter_cars', 'moto_profil', etc.
  enabled BOOLEAN DEFAULT FALSE,
  
  -- JSON storage for credentials and settings
  credentials TEXT DEFAULT '{}',
  settings TEXT DEFAULT '{}',
  
  -- Status
  status TEXT DEFAULT 'disconnected',
  last_sync TIMESTAMP,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(tenant_id, supplier_key)
);

CREATE INDEX IF NOT EXISTS idx_supplier_configs_tenant ON b2b_supplier_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_configs_enabled ON b2b_supplier_configs(tenant_id, enabled);
