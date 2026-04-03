/**
 * Agent Audit Trail - HTTP Server
 * MCP server via streamable HTTP transport
 */

import { createServer } from "http";
import { StreamableHttpServer } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { LogStore } from "./log-store.js";
import { PolicyEngine } from "./policy-engine.js";
import { z } from "zod";
import { AuditLogEntry, PolicyRule, PolicyViolation } from "./types.js";

const logStore = new LogStore(process.env.AUDIT_DATA_DIR || undefined);
const policyEngine = new PolicyEngine();

// Create audit log entry from request
function createAuditEntry(body: any): Omit<AuditLogEntry, "id" | "timestamp"> {
  const dataFields = typeof body.data_fields_accessed === "string"
    ? body.data_fields_accessed.split(",").map((s: string) => s.trim()).filter(Boolean)
    : Array.isArray(body.data_fields_accessed) ? body.data_fields_accessed : [];

  return {
    agent_id: body.agent_id || "http-agent",
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

const server = new StreamableHttpServer({
  port: Number(process.env.PORT || 3000),
  streamableHttpServerOptions: {
    jsonSchema: {
      log_action: {
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
    },
  },
  onValidateAuth: async (authHeader: string) => {
    // Simple API key validation
    const validKey = process.env.MCP_API_KEY || "dev-key";
    return authHeader === `Bearer ${validKey}`;
  },
});

server.tool("log_action", {
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
  } as any,
}, async (args: any) => {
  const entry = createAuditEntry(args);
  const result = logStore.writeLog(entry);
  const violations = policyEngine.evaluate({
    tool_name: args.tool_name,
    tool_action: args.tool_action || "",
    parameters: args.parameters || {},
    data_fields_accessed: entry.data_fields_accessed,
  });
  return { content: [{ type: "text", text: JSON.stringify({ log_id: result.id, violations }) }] };
});

server.tool("query_logs", {
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
  } as any,
}, async (args: any) => {
  const results = logStore.queryLogs({
    agent_id: args.agent_id,
    tool_name: args.tool_name,
    has_violations: args.has_violations,
    limit: args.limit || 50,
  });
  return { content: [{ type: "text", text: JSON.stringify(results) }] };
});

server.tool("get_summary", {
  name: "get_summary",
  description: "Get a dashboard summary of audit activity",
  inputSchema: { type: "object", properties: {} } as any,
}, async () => {
  const summary = logStore.getSummary();
  return { content: [{ type: "text", text: JSON.stringify(summary) }] };
});

server.start();
console.log("Agent Audit Trail HTTP server running on port", Number(process.env.PORT || 3000));
