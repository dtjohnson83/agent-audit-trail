/**
 * Agent Audit Trail - Vercel API Route
 * MCP over Streamable HTTP
 */
import { randomUUID } from "crypto";

const LOG_STORE_PATH = "/tmp/audit-logs.json";

// Simple in-memory log store for serverless
let logStore = null;
let policyEngine = null;

async function getStores() {
  if (!logStore) {
    const { LogStore } = await import("../dist/log-store.js");
    const { PolicyEngine } = await import("../dist/policy-engine.js");
    logStore = new LogStore(LOG_STORE_PATH);
    policyEngine = new PolicyEngine();
  }
  return { logStore, policyEngine };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, MCP-Procedure-Name");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { searchParams } = new URL(req.url, `https://${req.headers.host}`);
  const sessionId = searchParams.get("sessionId");

  // GET = SSE stream for responses (MCP streaming mode)
  if (req.method === "GET") {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("MCP-Session-Id", sessionId || "stateless");

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "connected" })}\n\n`);

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30000);

    req.on("close", () => {
      clearInterval(heartbeat);
    });

    return;
  }

  // POST = JSON-RPC request/response
  if (req.method === "POST") {
    try {
      const body = req.body;
      const { method, params, id } = body;

      const { logStore: ls, policyEngine: pe } = await getStores();

      // Handle JSON-RPC methods
      if (method === "tools/call") {
        const { name, arguments: args } = params || {};

        if (name === "log_action") {
          const dataFields = typeof args?.data_fields_accessed === "string"
            ? args.data_fields_accessed.split(",").map(s => s.trim()).filter(Boolean)
            : Array.isArray(args?.data_fields_accessed) ? args.data_fields_accessed : [];

          const entry = {
            agent_id: args?.agent_id || "vercel-agent",
            agent_name: args?.agent_name || "unknown",
            tool_name: args?.tool_name || "unknown",
            tool_action: args?.tool_action || "",
            parameters: args?.parameters || {},
            response_summary: "logged via Vercel API",
            response_status: "success",
            data_fields_accessed: dataFields,
            execution_duration_ms: 0,
            token_cost_estimate: null,
            policy_violations: [],
            metadata: args?.metadata || {},
          };

          const result = ls.writeLog(entry);
          const violations = pe.evaluate({
            tool_name: args?.tool_name || "unknown",
            tool_action: args?.tool_action || "",
            parameters: args?.parameters || {},
            data_fields_accessed: dataFields,
          });

          return res.status(200).json({
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
          return res.status(200).json({
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: JSON.stringify(results) }] },
          });
        }

        if (name === "get_summary") {
          const summary = ls.getSummary();
          return res.status(200).json({
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: JSON.stringify(summary) }] },
          });
        }

        return res.status(200).json({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown tool: ${name}` },
        });
      }

      if (method === "tools/list") {
        return res.status(200).json({
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

      return res.status(200).json({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Unknown method: ${method}` },
      });
    } catch (err) {
      console.error("MCP error:", err);
      return res.status(500).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32603, message: err.message },
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
