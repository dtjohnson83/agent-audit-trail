-- Migration marker columns for tracking Node.js to Deno migration
ALTER TABLE IF EXISTS audit_logs
  ADD COLUMN IF NOT EXISTS migrated_from_nodejs BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS audit_logs
  ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMPTZ;
