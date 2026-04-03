import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";

const logs: any[] = [];
function evaluate(toolName: string, toolAction: string, params: any, fields: string[]) {
  const violations: any[] = [];
  const text = `${toolName} ${toolAction} ${fields.join(" ")}`.toLowerCase();
  if (/ssn|passport|dob|drivers_license|address|phone|email/i.test(text)) violations.push({ rule_id: "pii-rule", rule_name: "PII Field Access", severity: "high", action_taken: "flag", details: "Triggered" });
  if (/delete|drop|truncate|destroy/i.test(text)) violations.push({ rule_id: "destructive-db", rule_name: "Destructive Database Operation", severity: "critical", action_taken: "flag", details: "Triggered" });
  const vals = Object.values(params).map(Number).filter((n: number) => !isNaN(n));
  if (vals.some((v: number) => v > 1000)) violations.push({ rule_id: "financial-threshold", rule_name: "High-Value Financial Action", severity: "high", action_taken: "flag", details: "Triggered" });
  return violations;
}
function writeLog(entry: any) { const full = { ...entry, id: randomUUID(), timestamp: new Date().toISOString() }; logs.unshift(full); if (logs.length > 10000) logs.splice(0, logs.length - 10000); return full; }

export async function GET(req: NextRequest) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({ start(c) { c.enqueue(enc.encode(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "connected" })}\n\n`)); const hb = setInterval(() => { try { c.enqueue(enc.encode(": heartbeat\n\n")); } catch { clearInterval(hb); } }, 30000); req.signal.addEventListener("abort", () => clearInterval(hb)); } });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
}

export async function POST(req: NextRequest) {
  try {
    const { method, params, id } = await req.json();
    if (method === "tools/call") {
      const { name, "arguments": args = {} } = params;
      if (name === "log_action") {
        const fields = typeof args.data_fields_accessed === "string" ? args.data_fields_accessed.split(",").map((s: string) => s.trim()).filter(Boolean) : Array.isArray(args.data_fields_accessed) ? args.data_fields_accessed : [];
        const entry = { agent_id: args.agent_id||"vercel-agent", agent_name: args.agent_name||"unknown", tool_name: args.tool_name||"unknown", tool_action: args.tool_action||"", parameters: args.parameters||{}, response_summary: "logged", response_status: "success", data_fields_accessed: fields, execution_duration_ms: args.execution_duration_ms||0, token_cost_estimate: args.token_cost_estimate??null, policy_violations: [], metadata: args.metadata||{} };
        const result = writeLog(entry);
        const violations = evaluate(args.tool_name||"unknown", args.tool_action||"", args.parameters||{}, fields);
        return Response.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ log_id: result.id, violations }) }] } });
      }
      if (name === "query_logs") { const r = logs.filter((l: any) => (!args.agent_id || l.agent_id === args.agent_id) && (!args.tool_name || l.tool_name === args.tool_name) && (!args.has_violations || l.policy_violations.length > 0)).slice(0, args.limit||50); return Response.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(r) }] } }); }
      if (name === "get_summary") { const byAgent: any = {}, byTool: any = {}; let v = 0; for (const l of logs) { byAgent[l.agent_name] = (byAgent[l.agent_name]||0)+1; byTool[l.tool_name] = (byTool[l.tool_name]||0)+1; if(l.policy_violations.length>0) v++; } return Response.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ total_logs: logs.length, logs_with_violations: v, by_agent: byAgent, by_tool: byTool }) }] } }); }
      return Response.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${name}` } });
    }
    if (method === "tools/list") return Response.json({ jsonrpc: "2.0", id, result: { tools: [{ name: "log_action", description: "Log an agent action", inputSchema: { type: "object", properties: { agent_name:{type:"string"}, agent_id:{type:"string"}, tool_name:{type:"string"}, tool_action:{type:"string"}, parameters:{type:"object"}, data_fields_accessed:{type:"string"}, metadata:{type:"object"} }, required: ["agent_name","tool_name"] } }, { name: "query_logs", description: "Search audit logs", inputSchema: { type: "object", properties: { agent_id:{type:"string"}, tool_name:{type:"string"}, has_violations:{type:"boolean"}, limit:{type:"number"} } } }, { name: "get_summary", description: "Get dashboard summary", inputSchema: { type: "object", properties: {} } } ]}});
    return Response.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method: ${method}` } });
  } catch(e: any) { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: e.message } }); }
}
