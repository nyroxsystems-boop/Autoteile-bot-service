-- Seed data for WAWI tables
-- Creates default stock locations and suppliers

-- Insert default stock locations
INSERT INTO stock_locations (id, name, code, type, description, tenant_id, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'Hauptlager', 'A1', 'main', 'Main warehouse', 'global', CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000000002', 'Wareneingang', 'B1', 'shelf', 'Goods receipt area', 'global', CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000000003', 'Versand', 'C1', 'shelf', 'Shipping area', 'global', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Insert default suppliers (these are the original scrapers, now as suppliers)
INSERT INTO companies (id, name, email, phone, website, is_customer, is_supplier, active, description, notes, tenant_id, created_at) VALUES
('00000000-0000-0000-0001-000000000001', 'Autodoc', 'info@autodoc.de', '', 'https://www.autodoc.de', FALSE, TRUE, TRUE, 'Auto parts scraper supplier', 'Priority: 1, Type: scraper', 'global', CURRENT_TIMESTAMP),
('00000000-0000-0000-0001-000000000002', 'kfzteile24', 'info@kfzteile24.de', '', 'https://www.kfzteile24.de', FALSE, TRUE, TRUE, 'Auto parts scraper supplier', 'Priority: 2, Type: scraper', 'global', CURRENT_TIMESTAMP),
('00000000-0000-0000-0001-000000000003', 'pkwteile.de', 'info@pkwteile.de', '', 'https://www.pkwteile.de', FALSE, TRUE, TRUE, 'Auto parts scraper supplier', 'Priority: 3, Type: scraper', 'global', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
