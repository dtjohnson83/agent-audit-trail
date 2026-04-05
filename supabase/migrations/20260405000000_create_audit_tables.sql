-- Agent Audit Trail tables for uzoiokxwtovgqsuvipzk

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  total_actions INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_agents_id ON agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

CREATE TABLE IF NOT EXISTS policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('tool_match', 'parameter_match', 'data_field_match', 'threshold')),
  condition_field TEXT,
  condition_operator TEXT NOT NULL CHECK (condition_operator IN ('equals', 'contains', 'greater_than', 'less_than', 'matches_regex')),
  condition_value TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('flag', 'block', 'alert')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_rules_enabled ON policy_rules(enabled);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id TEXT UNIQUE NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  previous_hash TEXT,
  hash TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_action TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  response_summary TEXT DEFAULT '',
  response_status TEXT DEFAULT 'success' CHECK (response_status IN ('success', 'error', 'blocked')),
  data_fields_accessed TEXT[] DEFAULT '{}',
  execution_duration_ms INTEGER DEFAULT 0,
  token_cost_estimate NUMERIC,
  policy_violations JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_agent_id ON audit_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tool_name ON audit_logs(tool_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(response_status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_hash ON audit_logs(hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- RLS
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_read_agents ON agents;
CREATE POLICY anon_read_agents ON agents FOR SELECT USING (true);

DROP POLICY IF EXISTS anon_read_policy_rules ON policy_rules;
CREATE POLICY anon_read_policy_rules ON policy_rules FOR SELECT USING (true);

DROP POLICY IF EXISTS anon_read_audit_logs ON audit_logs;
CREATE POLICY anon_read_audit_logs ON audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS anon_insert_agents ON agents;
CREATE POLICY anon_insert_agents ON agents FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS anon_insert_policy_rules ON policy_rules;
CREATE POLICY anon_insert_policy_rules ON policy_rules FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS anon_insert_audit_logs ON audit_logs;
CREATE POLICY anon_insert_audit_logs ON audit_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS anon_update_agents ON agents;
CREATE POLICY anon_update_agents ON agents FOR UPDATE USING (true);

DROP POLICY IF EXISTS no_delete_audit_logs ON audit_logs;
CREATE POLICY no_delete_audit_logs ON audit_logs FOR DELETE USING (false);

DROP POLICY IF EXISTS no_update_audit_logs ON audit_logs;
CREATE POLICY no_update_audit_logs ON audit_logs FOR UPDATE USING (false);

INSERT INTO policy_rules (rule_id, name, description, condition_type, condition_operator, condition_value, action, severity)
VALUES
  ('pii-field-access', 'PII Field Access', 'Flags access to PII fields', 'data_field_match', 'contains', 'ssn,passport,drivers_license,dob,date_of_birth,email,phone,address,credit_card', 'flag', 'high'),
  ('destructive-db', 'Destructive Database Operation', 'Flags DELETE, DROP, TRUNCATE, or DESTROY', 'tool_match', 'contains', 'delete,drop,truncate,destroy,remove', 'flag', 'critical'),
  ('high-value-financial', 'High-Value Financial Action', 'Flags financial actions over $1,000', 'parameter_match', 'greater_than', '1000', 'flag', 'high')
ON CONFLICT (rule_id) DO NOTHING;

CREATE OR REPLACE FUNCTION upsert_agent_on_log()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO agents (agent_id, name, last_active, total_actions)
  VALUES (NEW.agent_id, NEW.agent_name, NOW(), 1)
  ON CONFLICT (agent_id) DO UPDATE SET
    last_active = NOW(),
    total_actions = agents.total_actions + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_audit_log_insert ON audit_logs;
CREATE TRIGGER on_audit_log_insert
  AFTER INSERT ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION upsert_agent_on_log();
