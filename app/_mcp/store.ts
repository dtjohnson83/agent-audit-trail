// Minimal in-memory log store for Vercel serverless
import { randomUUID } from "crypto";

export interface PolicyViolation {
  rule_id: string;
  rule_name: string;
  severity: "low" | "medium" | "high" | "critical";
  action_taken: string;
  details: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  agent_id: string;
  agent_name: string;
  tool_name: string;
  tool_action: string;
  parameters: Record<string, unknown>;
  response_summary: string;
  response_status: string;
  data_fields_accessed: string[];
  execution_duration_ms: number;
  token_cost_estimate: number | null;
  policy_violations: PolicyViolation[];
  metadata: Record<string, unknown>;
}

let logs: LogEntry[] = [];

const RULES = [
  { id: "pii-rule", name: "PII Field Access", pattern: "ssn|passport|drivers_license|dob|date_of_birth|address|phone|email", action: "flag", severity: "high" as const },
  { id: "financial-threshold", name: "High-Value Financial Action", pattern: null, threshold: 1000, operator: "greater_than" as const, action: "flag" as const, severity: "high" as const },
  { id: "destructive-db", name: "Destructive Database Operation", pattern: "delete|drop|truncate|destroy", action: "flag", severity: "critical" as const },
];

export function evaluatePolicy(toolName: string, toolAction: string, parameters: Record<string, unknown>, dataFields: string[]): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  for (const rule of RULES) {
    let triggered = false;
    if (rule.pattern) {
      const combined = [...dataFields].join(" ").toLowerCase();
      triggered = new RegExp(rule.pattern, "i").test(combined);
      triggered = triggered || new RegExp(rule.pattern, "i").test(`${toolName} ${toolAction}`);
    } else if ("threshold" in rule && rule.threshold !== null) {
      const vals = Object.values(parameters).map(Number).filter(n => !isNaN(n));
      triggered = vals.some(v => rule.operator === "greater_than" ? v > rule.threshold! : v < rule.threshold!);
    }
    if (triggered) {
      violations.push({
        rule_id: rule.id,
        rule_name: rule.name,
        severity: rule.severity,
        action_taken: rule.action,
        details: `Rule "${rule.name}" triggered.`,
      });
    }
  }
  return violations;
}

export function writeLog(entry: Omit<LogEntry, "id" | "timestamp">): LogEntry {
  const full: LogEntry = { ...entry, id: randomUUID(), timestamp: new Date().toISOString() };
  logs.unshift(full);
  if (logs.length > 10000) logs = logs.slice(0, 10000);
  return full;
}

export function queryLogs(opts: { agent_id?: string; tool_name?: string; has_violations?: boolean; limit?: number }): LogEntry[] {
  let results = [...logs];
  if (opts.agent_id) results = results.filter(l => l.agent_id === opts.agent_id);
  if (opts.tool_name) results = results.filter(l => l.tool_name === opts.tool_name);
  if (opts.has_violations) results = results.filter(l => l.policy_violations.length > 0);
  return results.slice(0, opts.limit || 50);
}

export function getSummary() {
  const total = logs.length;
  const byAgent: Record<string, number> = {};
  const byTool: Record<string, number> = {};
  let violations = 0;
  for (const l of logs) {
    byAgent[l.agent_name] = (byAgent[l.agent_name] || 0) + 1;
    byTool[l.tool_name] = (byTool[l.tool_name] || 0) + 1;
    if (l.policy_violations.length > 0) violations++;
  }
  return { total_logs: total, logs_with_violations: violations, by_agent: byAgent, by_tool: byTool };
}
