import { NextRequest, NextResponse } from "next/server";
import { LogStore } from "../../lib/log-store.js";
import { PolicyEngine } from "../../lib/policy-engine.js";
import { AuditLogEntry } from "../../lib/types.js";

const LOG_STORE_PATH = "/tmp/audit-logs.json";

let logStore: LogStore;
let policyEngine: PolicyEngine;

function getStores() {
  if (!logStore) {
    logStore = new LogStore(LOG_STORE_PATH);
    policyEngine = new PolicyEngine();
  }
  return { logStore, policyEngine };
}

function createAuditEntry(body: any): Omit<AuditLogEntry, "id" | "timestamp"> {
  const dataFields = typeof body.data_fields_accessed === "string"
    ? body.data_fields_accessed.split(",").map((s: string) => s.trim()).filter(Boolean)
    : Array.isArray(body.data_fields_accessed) ? body.data_fields_accessed : [];

  return {
    agent_id: body.agent_id || "vercel-agent",
    agent_name: body.agent_name || "unknown",
    tool_name: body.tool_name || "unknown",
    tool_action: body.tool_action || "",
    parameters: body.parameters || {},
    response_summary: body.response_summary || "",
    response_status: body.response_status || "success",
    data_fields_accessed: dataFields,
    execution_duration_ms: body.execution_duration_ms || 0,
    token_cost_estimate: body.token_cost_estimate ?? null,
    policy_violations: body.policy_violations || [],
    metadata: body.metadata || {},
  };
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") || "stateless";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "connected" })}\n\n`));
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);
      req.signal.addEventListener("abort", () => clearInterval(heartbeat));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "MCP-Session-Id": sessionId,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { method, params, id } = body;
    const { logStore: ls, policyEngine: pe } = getStores();

    if (method === "tools/call") {
      const { name, arguments: args } = params || {};

      if (name === "log_action") {
        const entry = createAuditEntry(args);
        const result = ls.writeLog(entry);
        const violations = pe.evaluate({
          tool_name: args?.tool_name || "unknown",
          tool_action: args?.tool_action || "",
          parameters: args?.parameters || {},
          data_fields_accessed: entry.data_fields_accessed,
        });
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify({ log_id: result.id, violations }) }],
          },
        });
      }

      if (name === "query_logs") {
        const results = ls.queryLogs({
          agent_id: args?.agent_id,
          tool_name: args?.tool_name,
          has_violations: args?.has_violations,
          limit: args?.limit || 50,
        });
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(results) }] },
        });
      }

      if (name === "get_summary") {
        const summary = ls.getSummary();
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(summary) }] },
        });
      }

      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Unknown tool: ${name}` },
      });
    }

    if (method === "tools/list") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "log_action",
              description: "Log an agent action to the immutable audit trail",
              inputSchema: {
                type: "object",
                properties: {
                  agent_name: { type: "string" },
                  agent_id: { type: "string" },
                  tool_name: { type: "string" },
                  tool_action: { type: "string" },
                  parameters: { type: "object" },
                  data_fields_accessed: { type: "string" },
                  metadata: { type: "object" },
                },
                required: ["agent_name", "tool_name"],
              },
            },
            {
              name: "query_logs",
              description: "Search and filter audit log entries",
              inputSchema: {
                type: "object",
                properties: {
                  agent_id: { type: "string" },
                  tool_name: { type: "string" },
                  has_violations: { type: "boolean" },
                  limit: { type: "number" },
                },
              },
            },
            {
              name: "get_summary",
              description: "Get a dashboard summary of audit activity",
              inputSchema: { type: "object", properties: {} },
            },
          ],
        },
      });
    }

    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Unknown method: ${method}` },
    });
  } catch (err: any) {
    console.error("MCP error:", err);
    return NextResponse.json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message: err.message },
    });
  }
}
