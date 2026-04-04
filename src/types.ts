/**
 * Agent Audit Trail - Core Types
 * DANZUS Holdings LLC
 */

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  // Hash chaining for immutability
  previous_hash: string | null;  // null for genesis entry
  hash: string;                  // SHA-256 of previous_hash + entry contents
  // Core fields
  agent_id: string;
  agent_name: string;
  tool_name: string;
  tool_action: string;
  parameters: Record<string, unknown>;
  response_summary: string;
  response_status: "success" | "error" | "blocked";
  data_fields_accessed: string[];
  execution_duration_ms: number;
  token_cost_estimate: number | null;
  policy_violations: PolicyViolation[];
  metadata: Record<string, unknown>;
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  condition: PolicyCondition;
  action: "flag" | "block" | "alert";
  severity: "low" | "medium" | "high" | "critical";
  created_at: string;
}

export interface PolicyCondition {
  type: "tool_match" | "parameter_match" | "data_field_match" | "threshold";
  field?: string;
  operator: "equals" | "contains" | "greater_than" | "less_than" | "matches_regex";
  value: string | number;
}

export interface PolicyViolation {
  rule_id: string;
  rule_name: string;
  severity: "low" | "medium" | "high" | "critical";
  action_taken: "flagged" | "blocked" | "alerted";
  details: string;
}

export interface AgentRegistration {
  id: string;
  name: string;
  description: string;
  registered_at: string;
  last_active: string;
  total_actions: number;
  status: "active" | "suspended" | "inactive";
}

export interface AuditSummary {
  total_actions: number;
  actions_today: number;
  policy_violations_today: number;
  blocked_actions_today: number;
  active_agents: number;
  top_tools: { tool_name: string; count: number }[];
  recent_violations: PolicyViolation[];
}

export interface AuditQueryOptions {
  agent_id?: string;
  tool_name?: string;
  status?: "success" | "error" | "blocked";
  start_date?: string;
  end_date?: string;
  has_violations?: boolean;
  limit?: number;
  offset?: number;
}

export interface AlertConfig {
  id: string;
  type: "email" | "webhook" | "slack";
  destination: string;
  min_severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
}

export interface ChainVerificationResult {
  valid: boolean;
  entries_checked: number;
  broken_at: string | null;  // ID of first tampered entry, null if valid
  error: string | null;
}
