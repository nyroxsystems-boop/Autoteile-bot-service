-- Migration: 012_audit_log.sql
-- Create an immutable audit log table for GoBD compliance (WORM semantics)

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    changes JSONB,
    metadata JSONB,
    ip TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure indexes for fast querying of audit logs
CREATE INDEX IF NOT EXISTS idx_audit_log_merchant ON audit_log(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- GoBD Compliance: Enforce WORM (Write Once, Read Many) at the database engine level via Trigger
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries cannot be modified or deleted (GoBD WORM compliance).';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_modification ON audit_log;
CREATE TRIGGER trg_prevent_audit_modification
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_modification();
