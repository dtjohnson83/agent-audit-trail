import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

// ============================================================
// Inline log store + policy engine
// ============================================================
interface PolicyViolation {
  rule_id: string;
  rule_name: string;
  severity: "low" | "medium" | "high" | "critical";
  action_taken: string;
  details: string;
}

interface LogEntry {
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

interface PatternRule { id: string; name: string; pattern: string; action: string; severity: "low" | "medium" | "high" | "critical"; }
interface ThresholdRule { id: string; name: string; threshold: number; operator: "greater_than" | "less_than"; action: string; severity: "low" | "medium" | "high" | "critical"; }

const PATTERN_RULES: PatternRule[] = [
  { id: "pii-rule", name: "PII Field Access", pattern: "ssn|passport|drivers_license|dob|date_of_birth|address|phone|email", action: "flag", severity: "high" },
  { id: "destructive-db", name: "Destructive Database Operation", pattern: "delete|drop|truncate|destroy", action: "flag", severity: "critical" },
];
const THRESHOLD_RULES: ThresholdRule[] = [
  { id: "financial-threshold", name: "High-Value Financial Action", threshold: 1000, operator: "greater_than", action: "flag", severity: "high" },
];

function evaluatePolicy(toolName: string, toolAction: string, parameters: Record<string, unknown>, dataFields: string[]): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  const text = `${toolName} ${toolAction} ${dataFields.join(" ")}`.toLowerCase();
  for (const rule of PATTERN_RULES) {
    if (new RegExp(rule.pattern, "i").test(text)) {
      violations.push({ rule_id: rule.id, rule_name: rule.name, severity: rule.severity, action_taken: rule.action, details: `Rule "${rule.name}" triggered.` });
    }
  }
  for (const rule of THRESHOLD_RULES) {
    const vals = Object.values(parameters).map(Number).filter(n => !isNaN(n));
    const triggered = vals.some(v => rule.operator === "greater_than" ? v > rule.threshold : v < rule.threshold);
    if (triggered) {
      violations.push({ rule_id: rule.id, rule_name: rule.name, severity: rule.severity, action_taken: rule.action, details: `Rule "${rule.name}" triggered.` });
    }
  }
  return violations;
}

function writeLog(entry: Omit<LogEntry, "id" | "timestamp">): LogEntry {
  const full: LogEntry = { ...entry, id: randomUUID(), timestamp: new Date().toISOString() };
  logs.unshift(full);
  if (logs.length > 10000) logs = logs.slice(0, 10000);
  return full;
}

function queryLogs(opts: { agent_id?: string; tool_name?: string; has_violations?: boolean; limit?: number }): LogEntry[] {
  let r = [...logs];
  if (opts.agent_id) r = r.filter(l => l.agent_id === opts.agent_id);
  if (opts.tool_name) r = r.filter(l => l.tool_name === opts.tool_name);
  if (opts.has_violations) r = r.filter(l => l.policy_violations.length > 0);
  return r.slice(0, opts.limit || 50);
}

function getSummary() {
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

// ============================================================
// MCP HTTP Handler
// ============================================================
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") || "stateless";
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "connected" })}\n\n`));
      const heartbeat = setInterval(() => { try { controller.enqueue(encoder.encode(`: heartbeat\n\n`)); } catch { clearInterval(heartbeat); } }, 30000);
      req.signal.addEventListener("abort", () => clearInterval(heartbeat));
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "MCP-Session-Id": sessionId } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { method, params, id } = body;

    if (method === "tools/call") {
      const { name, arguments: args } = params || {};

      if (name === "log_action") {
        const dataFields = typeof args?.data_fields_accessed === "string"
          ? args.data_fields_accessed.split(",").map((s: string) => s.trim()).filter(Boolean)
          : Array.isArray(args?.data_fields_accessed) ? args.data_fields_accessed : [];
        const entry: Omit<LogEntry, "id" | "timestamp"> = {
          agent_id: args?.agent_id || "vercel-agent", agent_name: args?.agent_name || "unknown",
          tool_name: args?.tool_name || "unknown", tool_action: args?.tool_action || "",
          parameters: args?.parameters || {}, response_summary: "logged", response_status: "success",
          data_fields_accessed: dataFields, execution_duration_ms: args?.execution_duration_ms || 0,
          token_cost_estimate: args?.token_cost_estimate ?? null, policy_violations: [], metadata: args?.metadata || {},
        };
        const result = writeLog(entry);
        const violations = evaluatePolicy(args?.tool_name || "unknown", args?.tool_action || "", args?.parameters || {}, dataFields);
        return NextResponse.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ log_id: result.id, violations }) }] } });
      }

      if (name === "query_logs") {
        return NextResponse.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(queryLogs({ agent_id: args?.agent_id, tool_name: args?.tool_name, has_violations: args?.has_violations, limit: args?.limit })) }] } });
      }

      if (name === "get_summary") {
        return NextResponse.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(getSummary()) }] } });
      }

      return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${name}` } });
    }

    if (method === "tools/list") {
      return NextResponse.json({
        jsonrpc: "2.0", id, result: {
          tools: [
            { name: "log_action", description: "Log an agent action to the immutable audit trail", inputSchema: { type: "object", properties: { agent_name: { type: "string" }, agent_id: { type: "string" }, tool_name: { type: "string" }, tool_action: { type: "string" }, parameters: { type: "object" }, data_fields_accessed: { type: "string" }, metadata: { type: "object" } }, required: ["agent_name", "tool_name"] } },
            { name: "query_logs", description: "Search and filter audit log entries", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, tool_name: { type: "string" }, has_violations: { type: "boolean" }, limit: { type: "number" } } } },
            { name: "get_summary", description: "Get a dashboard summary of audit activity", inputSchema: { type: "object", properties: {} } },
          ],
        },
      });
    }

    return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method: ${method}` } });
  } catch (err: unknown) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: err instanceof Error ? err.message : String(err) } });
  }
}
