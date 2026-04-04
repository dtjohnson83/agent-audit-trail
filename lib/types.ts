export interface AuditLog {
  id: string
  entry_id: string
  timestamp: string
  previous_hash: string | null
  hash: string
  agent_id: string
  agent_name: string
  tool_name: string
  tool_action: string
  parameters: Record<string, any>
  response_summary: string
  response_status: 'success' | 'error' | 'flagged' | 'blocked'
  data_fields_accessed: string[]
  execution_duration_ms: number
  token_cost_estimate: number | null
  policy_violations: PolicyViolation[]
  metadata: Record<string, any>
  review_status: 'new' | 'reviewed' | 'escalated' | 'false_positive'
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
}

export interface PolicyViolation {
  rule_id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  message: string
}

export interface Agent {
  id: string
  agent_id: string
  name: string
  description: string
  status: 'active' | 'inactive' | 'suspended'
  total_actions: number
  last_active: string | null
  registered_at: string
}

export interface PolicyRule {
  id: string
  rule_id: string
  name: string
  description: string
  enabled: boolean
  condition_type: string
  condition_operator: string
  condition_value: string
  action: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  enforcement_mode: 'flag' | 'block'
  created_at: string
}

export interface AgentPermission {
  id: string
  agent_id: string
  permission_type: 'allow' | 'deny'
  resource_type: 'tool' | 'table' | 'action'
  resource_name: string
}
