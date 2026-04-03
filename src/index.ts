#!/usr/bin/env node

/**
 * Agent Audit Trail - MCP Server
 * Compliance infrastructure for agentic AI.
 *
 * This MCP server provides tools for:
 * - Logging agent actions into an immutable audit trail
 * - Evaluating actions against configurable policy rules
 * - Querying and exporting audit logs for compliance reporting
 * - Managing policy rules and agent registrations
 *
 * DANZUS Holdings LLC
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { LogStore } from "./log-store.js";
import { PolicyEngine } from "./policy-engine.js";
import * as path from "path";
import * as os from "os";

// Initialize stores
const dataDir = path.join(os.homedir(), ".agent-audit-trail");
const logStore = new LogStore(path.join(dataDir, "audit-logs.json"));
const policyEngine = new PolicyEngine();

// Create the MCP server
const server = new McpServer({
  name: "agent-audit-trail",
  version: "1.0.0",
});

// ============================================================
// TOOL: log_action
// The primary tool. Agents call this to log their actions.
// ============================================================
server.tool(
  "log_action",
  "Log an agent action to the immutable audit trail. Call this before or after your agent performs any tool call to create a compliance record. Returns the log entry ID and any policy violations detected.",
  {
    agent_name: z
      .string()
      .describe("Name or identifier of the agent performing the action"),
    agent_id: z
      .string()
      .optional()
      .describe("Unique agent ID. Auto-generated if not provided."),
    tool_name: z
      .string()
      .describe("Name of the tool being called (e.g., 'database_query', 'send_email', 'stripe_charge')"),
    tool_action: z
      .string()
      .describe("Specific action within the tool (e.g., 'SELECT', 'create_invoice', 'refund')"),
    parameters: z
      .string()
      .describe("JSON string of the parameters passed to the tool call"),
    response_summary: z
      .string()
      .optional()
      .describe("Brief summary of what the tool returned"),
    response_status: z
      .enum(["success", "error", "blocked"])
      .optional()
      .describe("Outcome of the tool call"),
    data_fields_accessed: z
      .string()
      .optional()
      .describe("Comma-separated list of data fields accessed (e.g., 'user.email,user.ssn,order.amount')"),
    execution_duration_ms: z
      .number()
      .optional()
      .describe("How long the tool call took in milliseconds"),
    token_cost_estimate: z
      .number()
      .optional()
      .describe("Estimated token cost of this action in USD"),
    metadata: z
      .string()
      .optional()
      .describe("JSON string of any additional metadata to attach to the log entry"),
  },
  async (args) => {
    let parsedParams: Record<string, unknown> = {};
    try {
      parsedParams = JSON.parse(args.parameters);
    } catch {
      parsedParams = { raw: args.parameters };
    }

    let parsedMetadata: Record<string, unknown> = {};
    if (args.metadata) {
      try {
        parsedMetadata = JSON.parse(args.metadata);
      } catch {
        parsedMetadata = { raw: args.metadata };
      }
    }

    const dataFields = args.data_fields_accessed
      ? args.data_fields_accessed.split(",").map((f) => f.trim())
      : [];

    // Evaluate policy rules
    const violations = policyEngine.evaluate({
      tool_name: args.tool_name,
      tool_action: args.tool_action,
      parameters: parsedParams,
      data_fields_accessed: dataFields,
    });

    const shouldBlock = policyEngine.shouldBlock(violations);
    const status = shouldBlock
      ? "blocked"
      : args.response_status || "success";

    // Write immutable log entry
    const entry = logStore.writeLog({
      agent_id: args.agent_id || `agent_${args.agent_name.toLowerCase().replace(/\s+/g, "_")}`,
      agent_name: args.agent_name,
      tool_name: args.tool_name,
      tool_action: args.tool_action,
      parameters: parsedParams,
      response_summary: args.response_summary || "",
      response_status: status,
      data_fields_accessed: dataFields,
      execution_duration_ms: args.execution_duration_ms || 0,
      token_cost_estimate: args.token_cost_estimate || null,
      policy_violations: violations,
      metadata: parsedMetadata,
    });

    const result: Record<string, unknown> = {
      log_id: entry.id,
      timestamp: entry.timestamp,
      status: entry.response_status,
      violations_count: violations.length,
    };

    if (violations.length > 0) {
      result.violations = violations.map((v) => ({
        rule: v.rule_name,
        severity: v.severity,
        action: v.action_taken,
        details: v.details,
      }));
    }

    if (shouldBlock) {
      result.blocked = true;
      result.block_reason =
        "Action blocked by policy. Review violations for details.";
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ============================================================
// TOOL: query_logs
// Search and filter the audit trail.
// ============================================================
server.tool(
  "query_logs",
  "Search the audit trail with filters. Returns matching log entries sorted newest first.",
  {
    agent_id: z.string().optional().describe("Filter by agent ID"),
    tool_name: z.string().optional().describe("Filter by tool name"),
    status: z
      .enum(["success", "error", "blocked"])
      .optional()
      .describe("Filter by action status"),
    has_violations: z
      .boolean()
      .optional()
      .describe("Only return entries with policy violations"),
    start_date: z
      .string()
      .optional()
      .describe("Filter entries after this ISO date"),
    end_date: z
      .string()
      .optional()
      .describe("Filter entries before this ISO date"),
    limit: z
      .number()
      .optional()
      .describe("Max entries to return (default 20)"),
    offset: z
      .number()
      .optional()
      .describe("Pagination offset"),
  },
  async (args) => {
    const logs = logStore.queryLogs({
      agent_id: args.agent_id,
      tool_name: args.tool_name,
      status: args.status,
      has_violations: args.has_violations,
      start_date: args.start_date,
      end_date: args.end_date,
      limit: args.limit || 20,
      offset: args.offset || 0,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              count: logs.length,
              entries: logs.map((l) => ({
                id: l.id,
                timestamp: l.timestamp,
                agent: l.agent_name,
                tool: `${l.tool_name}.${l.tool_action}`,
                status: l.response_status,
                violations: l.policy_violations.length,
                duration_ms: l.execution_duration_ms,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ============================================================
// TOOL: get_log_detail
// Get full details for a specific log entry.
// ============================================================
server.tool(
  "get_log_detail",
  "Retrieve the complete details of a specific audit log entry by ID.",
  {
    log_id: z.string().describe("The ID of the log entry to retrieve"),
  },
  async (args) => {
    const log = logStore.getLog(args.log_id);
    if (!log) {
      return {
        content: [
          { type: "text" as const, text: `No log entry found with ID: ${args.log_id}` },
        ],
      };
    }
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(log, null, 2) },
      ],
    };
  }
);

// ============================================================
// TOOL: get_summary
// Dashboard-style summary of audit activity.
// ============================================================
server.tool(
  "get_summary",
  "Get a summary of audit trail activity including action counts, violations, active agents, and top tools.",
  {},
  async () => {
    const summary = logStore.getSummary();
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(summary, null, 2) },
      ],
    };
  }
);

// ============================================================
// TOOL: list_agents
// Show all registered agents and their activity.
// ============================================================
server.tool(
  "list_agents",
  "List all agents that have been registered or have logged actions.",
  {},
  async () => {
    const agents = logStore.listAgents();
    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ agents }, null, 2) },
      ],
    };
  }
);

// ============================================================
// TOOL: register_agent
// Explicitly register an agent.
// ============================================================
server.tool(
  "register_agent",
  "Register a new agent in the audit trail system. Agents are also auto-registered on first action.",
  {
    agent_id: z.string().describe("Unique identifier for the agent"),
    agent_name: z.string().describe("Human-readable name for the agent"),
    description: z
      .string()
      .optional()
      .describe("Description of what this agent does"),
  },
  async (args) => {
    const agent = logStore.registerAgent(
      args.agent_id,
      args.agent_name,
      args.description || ""
    );
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ registered: agent }, null, 2),
        },
      ],
    };
  }
);

// ============================================================
// TOOL: list_policy_rules
// Show all configured policy rules.
// ============================================================
server.tool(
  "list_policy_rules",
  "List all policy rules currently configured in the system.",
  {},
  async () => {
    const rules = policyEngine.listRules();
    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ rules }, null, 2) },
      ],
    };
  }
);

// ============================================================
// TOOL: add_policy_rule
// Create a new policy rule.
// ============================================================
server.tool(
  "add_policy_rule",
  "Add a new policy rule that will be evaluated against all future agent actions.",
  {
    name: z.string().describe("Short name for the rule"),
    description: z.string().describe("What this rule checks for"),
    condition_type: z
      .enum(["tool_match", "parameter_match", "data_field_match", "threshold"])
      .describe("Type of condition to evaluate"),
    condition_field: z
      .string()
      .optional()
      .describe("Field path to check (for parameter_match and threshold types)"),
    condition_operator: z
      .enum(["equals", "contains", "greater_than", "less_than", "matches_regex"])
      .describe("Comparison operator"),
    condition_value: z
      .string()
      .describe("Value to compare against"),
    action: z
      .enum(["flag", "block", "alert"])
      .describe("What to do when rule is triggered"),
    severity: z
      .enum(["low", "medium", "high", "critical"])
      .describe("Severity level of the violation"),
  },
  async (args) => {
    const rule = policyEngine.addRule({
      name: args.name,
      description: args.description,
      enabled: true,
      condition: {
        type: args.condition_type,
        field: args.condition_field,
        operator: args.condition_operator,
        value: args.condition_value,
      },
      action: args.action,
      severity: args.severity,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ created: rule }, null, 2),
        },
      ],
    };
  }
);

// ============================================================
// TOOL: toggle_policy_rule
// Enable or disable a rule.
// ============================================================
server.tool(
  "toggle_policy_rule",
  "Enable or disable an existing policy rule.",
  {
    rule_id: z.string().describe("ID of the rule to toggle"),
    enabled: z.boolean().describe("Set to true to enable, false to disable"),
  },
  async (args) => {
    const rule = policyEngine.updateRule(args.rule_id, {
      enabled: args.enabled,
    });
    if (!rule) {
      return {
        content: [
          { type: "text" as const, text: `Rule not found: ${args.rule_id}` },
        ],
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { updated: { id: rule.id, name: rule.name, enabled: rule.enabled } },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ============================================================
// TOOL: export_audit_log
// Export logs for compliance reporting.
// ============================================================
server.tool(
  "export_audit_log",
  "Export audit logs as a JSON compliance report. Use for regulatory submissions, internal audits, or archival.",
  {
    agent_id: z.string().optional().describe("Filter by agent ID"),
    tool_name: z.string().optional().describe("Filter by tool name"),
    start_date: z.string().optional().describe("Export entries after this ISO date"),
    end_date: z.string().optional().describe("Export entries before this ISO date"),
    has_violations: z.boolean().optional().describe("Only export entries with violations"),
  },
  async (args) => {
    const exported = logStore.exportLogs({
      agent_id: args.agent_id,
      tool_name: args.tool_name,
      start_date: args.start_date,
      end_date: args.end_date,
      has_violations: args.has_violations,
    });

    return {
      content: [{ type: "text" as const, text: exported }],
    };
  }
);

// ============================================================
// RESOURCES: Expose audit data as MCP resources
// ============================================================
server.resource(
  "audit-summary",
  "audit://summary",
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(logStore.getSummary(), null, 2),
      },
    ],
  })
);

server.resource(
  "policy-rules",
  "audit://policies",
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({ rules: policyEngine.listRules() }, null, 2),
      },
    ],
  })
);

server.resource(
  "registered-agents",
  "audit://agents",
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({ agents: logStore.listAgents() }, null, 2),
      },
    ],
  })
);

// ============================================================
// START SERVER
// ============================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Agent Audit Trail MCP server running on stdio");
  console.error(`Data directory: ${dataDir}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
