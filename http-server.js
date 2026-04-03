/**
 * Agent Audit Trail - HTTP Server for Smithery deployment
 */

import { createServer } from "http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js";
import { randomUUID } from "crypto";
import { LogStore } from "./dist/log-store.js";
import { PolicyEngine } from "./dist/policy-engine.js";
import * as path from "path";
import * as os from "os";
import { AuditLogEntry } from "./dist/types.js";

const PORT = Number(process.env.PORT || 3000);
const dataDir = process.env.AUDIT_DATA_DIR || path.join(os.homedir(), ".agent-audit-trail");
const logStore = new LogStore(path.join(dataDir, "audit-logs.json"));
const policyEngine = new PolicyEngine();

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

const server = new (await import("@modelcontextprotocol/sdk/dist/esm/server/mcp.js")).McpServer({
  name: "agent-audit-trail",
  version: "1.0.0",
});

// Re-implement key tools for HTTP mode
server.tool(
  "log_action",
  "Log an agent action to the immutable audit trail",
  {
    agent_name: { type: "string" },
    agent_id: { type: "string" },
    tool_name: { type: "string" },
    tool_action: { type: "string" },
    parameters: { type: "object" },
    data_fields_accessed: { type: "string" },
    metadata: { type: "object" },
  },
  async ({ agent_name, agent_id, tool_name, tool_action, parameters, data_fields_accessed, metadata }) => {
    const dataFields = typeof data_fields_accessed === "string"
      ? data_fields_accessed.split(",").map(s => s.trim()).filter(Boolean)
      : [];
    const entry: Omit<AuditLogEntry, "id" | "timestamp"> = {
      agent_id: agent_id || "http-agent",
      agent_name,
      tool_name,
      tool_action: tool_action || "",
      parameters: parameters || {},
      response_summary: "logged via HTTP",
      response_status: "success",
      data_fields_accessed: dataFields,
      execution_duration_ms: 0,
      token_cost_estimate: null,
      policy_violations: [],
      metadata: metadata || {},
    };
    const result = logStore.writeLog(entry);
    const violations = policyEngine.evaluate({
      tool_name,
      tool_action: tool_action || "",
      parameters: parameters || {},
      data_fields_accessed: dataFields,
    });
    return { content: [{ type: "text", text: JSON.stringify({ log_id: result.id, violations }) }] };
  }
);

server.tool(
  "query_logs",
  "Search and filter audit log entries",
  {
    agent_id: { type: "string" },
    tool_name: { type: "string" },
    has_violations: { type: "boolean" },
    limit: { type: "number" },
  },
  async (args) => {
    const results = logStore.queryLogs({
      agent_id: args.agent_id,
      tool_name: args.tool_name,
      has_violations: args.has_violations,
      limit: args.limit || 50,
    });
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  }
);

server.tool(
  "get_summary",
  "Get a dashboard summary of audit activity",
  {},
  async () => {
    const summary = logStore.getSummary();
    return { content: [{ type: "text", text: JSON.stringify(summary) }] };
  }
);

server.connect(transport);

const httpServer = createServer((req, res) => {
  transport.handleRequest(req, res, undefined);
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Agent Audit Trail MCP HTTP server running on port ${PORT}`);
});
