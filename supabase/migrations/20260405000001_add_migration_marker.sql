-- Add migration marker columns to audit_logs
ALTER TABLE IF EXISTS audit_logs
  ADD COLUMN IF NOT EXISTS migrated_from_nodejs BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMPTZ;

-- Also update the index to include migrated_from_nodejs for fast filtering
