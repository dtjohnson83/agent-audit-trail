/**
 * Agent Audit Trail MCP Server — Supabase Edge Function
 * Handles MCP JSON-RPC 2.0 over HTTP
 * Hash chain stored in Supabase audit_logs table
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, mcptools, mcpheaders, mcpprotocolversion",
  "Access-Control-Expose-Headers": "mcpheaders, mcptools, mcpprotocolversion",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const GENESIS_HASH = "genesis";

// ============================================================
// Hash utilities
// ============================================================
function sortedJSON(obj: unknown): string {
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return "{}";
    }
  }
  if (Array.isArray(obj)) {
    return JSON.stringify(
      obj.map((item) =>
        typeof item === "object" && item !== null ? sortedJSON(item) : item
      )
    );
  }
  if (typeof obj === "object" && obj !== null) {
    const keys = Object.keys(obj).sort();
    const result: Record<string, unknown> = {};
    for (const k of keys) {
      const v = (obj as Record<string, unknown>)[k];
      if (typeof v === "object" && v !== null) {
        result[k] = Array.isArray(v)
          ? v.map((vi) =>
              typeof vi === "object" && vi !== null
                ? sortedJSON(vi)
                : vi
            )
          : sortedJSON(v);
      } else {
        result[k] = v;
      }
    }
    return JSON.stringify(result);
  }
  return JSON.stringify(obj);
}

async function computeEntryHash(
  previousHash: string | null,
  entry: Record<string, unknown>
): Promise<string> {
  const params = entry.parameters;
  const meta = entry.metadata;
  const pv = entry.policy_violations;
  const dfa = Array.isArray(entry.data_fields_accessed)
    ? (entry.data_fields_accessed as unknown[]).slice().sort()
    : [];

  const payload = [
    previousHash ?? GENESIS_HASH,
    String(entry.entry_id || entry.id || ""),
    String(entry.timestamp || ""),
    String(entry.agent_id || ""),
    String(entry.agent_name || ""),
    String(entry.tool_name || ""),
    String(entry.tool_action || ""),
    sortedJSON(params ?? {}),
    String(entry.response_summary ?? ""),
    String(entry.response_status ?? "success"),
    JSON.stringify(dfa),
    String(entry.execution_duration_ms ?? 0),
    String(entry.token_cost_estimate ?? ""),
    sortedJSON(pv ?? []),
    sortedJSON(meta ?? {}),
  ].join("|");

  // DEBUG LOG
  console.error("[hash] params_type=" + typeof params + " params=" + JSON.stringify(params));
  console.error("[hash] payload=" + payload);

  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================
// JSONB normalization (Supabase JSONB can be string or object)
// ============================================================
function normalizeJSONB(val: unknown): unknown {
  if (typeof val === "undefined" || val === null) return null;
  if (typeof val === "object") {
    if (Array.isArray(val)) {
      return val.map((item) => {
        if (typeof item === "string") {
          try {
            return JSON.parse(item);
          } catch {
            return item;
          }
        }
        return item;
      });
    }
    return val;
  }
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

// ============================================================
// Policy evaluation
// ============================================================
type PolicyViolation = {
  rule_id: string;
  rule_name: string;
  severity: string;
  action_taken: string;
  details: string;
  enforcement_mode: string;
};

type PolicyResult = {
  allowed: boolean;
  violations: PolicyViolation[];
};

async function evaluatePolicy(
  supabase: ReturnType<typeof createClient>,
  toolName: string,
  toolAction: string,
  parameters: Record<string, unknown>,
  dataFields: string[]
): Promise<PolicyResult> {
  // Fetch all enabled rules from the database
  const { data: rules } = await supabase
    .from("policy_rules")
    .select("*")
    .eq("enabled", true);

  const violations: PolicyViolation[] = [];
  const toolText = `${toolName} ${toolAction}`.toLowerCase();
  const dataText = (dataFields || []).join(" ").toLowerCase();

  if (rules && rules.length > 0) {
    for (const rule of rules) {
      let triggered = false;

      switch (rule.condition_type) {
        case "tool_match":
          // Match against tool_name + tool_action — split on spaces or commas
          triggered = rule.condition_value.split(/[\s,]+/).some((val: string) =>
            toolText.includes(val.trim().toLowerCase())
          );
          break;
        case "data_field_match":
          // Match against data_fields_accessed — split on spaces or commas
          triggered = rule.condition_value.split(/[\s,]+/).some((val: string) =>
            dataText.includes(val.trim().toLowerCase())
          );
          break;
        case "parameter_match":
          // Match against parameter values — split on spaces or commas
          triggered = rule.condition_value.split(/[\s,]+/).some((val: string) => {
            const paramStr = JSON.stringify(parameters).toLowerCase();
            return paramStr.includes(val.trim().toLowerCase());
          });
          break;
        case "threshold":
          // Numeric threshold check
          if (rule.condition_operator === "greater_than") {
            const threshold = parseFloat(rule.condition_value);
            const vals = Object.values(parameters || {}).map(Number).filter((n) => !isNaN(n));
            triggered = vals.some((v) => v > threshold);
          }
          break;
        case "matches_regex":
          try {
            const regex = new RegExp(rule.condition_value, "i");
            triggered = regex.test(`${toolName} ${toolAction} ${dataText}`);
          } catch {
            triggered = false;
          }
          break;
      }

      if (triggered) {
        violations.push({
          rule_id: rule.rule_id,
          rule_name: rule.name,
          severity: rule.severity,
          action_taken: rule.enforcement_mode || rule.action,
          enforcement_mode: rule.enforcement_mode || rule.action,
          details: `Rule "${rule.name}" triggered (${rule.condition_type} match).`,
        });
      }
    }
  }

  // Determine if action is allowed: block if ANY rule has enforcement_mode = "block"
  const hasBlock = violations.some((v) => v.enforcement_mode === "block");

  return {
    allowed: !hasBlock,
    violations,
  };
}

// ============================================================
// Database operations
// ============================================================
async function getLatestHash(
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  const { data } = await supabase
    .from("audit_logs")
    .select("hash")
    .order("created_at", { ascending: false })
    .limit(1);
  if (data && data.length > 0) {
    return data[0].hash as string;
  }
  return null;
}

async function writeLog(
  supabase: ReturnType<typeof createClient>,
  entry: Record<string, unknown>,
  maxRetries = 3
): Promise<{ log_id: string; timestamp: string; hash: string; previous_hash: string | null; violations: PolicyViolation[] }> {
  const nonNull = (v: unknown, fallback: unknown): unknown => v === null ? fallback : v;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const previousHash = await getLatestHash(supabase);
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const entryData = {
      ...entry,
      entry_id: id,
      timestamp,
      previous_hash: previousHash,
    };

    const hash = await computeEntryHash(previousHash, entryData as Record<string, unknown>);

    const full: Record<string, unknown> = {
      ...entryData,
      hash,
      parameters: nonNull(entry.parameters, {}),
      data_fields_accessed: nonNull(entry.data_fields_accessed, []),
      policy_violations: nonNull(entry.policy_violations, []),
      metadata: nonNull(entry.metadata, {}),
    };

    const { data, error } = await supabase
      .from("audit_logs")
      .insert(full as Record<string, unknown>)
      .select()
      .single();

    if (!error && data) {
      return {
        log_id: data.entry_id,
        timestamp: data.timestamp,
        hash: data.hash,
        previous_hash: data.previous_hash,
        violations: [],
      };
    }

    // Check if it's a hash chain conflict error
    const errMsg = error?.message || "";
    if (
      errMsg.includes("Chain broken") ||
      errMsg.includes("previous_hash") ||
      attempt < maxRetries - 1
    ) {
      // Conflict — another write happened first. Re-fetch latest and retry.
      continue;
    }

    throw new Error("Failed to write log: " + (error?.message || "unknown"));
  }

  throw new Error("Failed to write log after " + maxRetries + " attempts due to concurrent writes");
}

async function queryLogs(
  supabase: ReturnType<typeof createClient>,
  opts: {
    agent_id?: string;
    tool_name?: string;
    status?: string;
    has_violations?: boolean;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const limit = opts.limit || 20;
  const offset = opts.offset || 0;

  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.agent_id) query = query.eq("agent_id", opts.agent_id);
  if (opts.tool_name) query = query.eq("tool_name", opts.tool_name);
  if (opts.status) query = query.eq("response_status", opts.status);
  if (opts.has_violations)
    query = query.not("policy_violations", "is", null);
  if (opts.start_date) query = query.gte("timestamp", opts.start_date);
  if (opts.end_date) query = query.lte("timestamp", opts.end_date);

  const { data, error } = await query;
  if (error) {
    console.error("[supabase] query error:", error);
    return [];
  }

  return (data || []).map((l) => ({
    ...l,
    parameters: normalizeJSONB(l.parameters),
    data_fields_accessed: Array.isArray(l.data_fields_accessed)
      ? l.data_fields_accessed
      : [],
    policy_violations: normalizeJSONB(l.policy_violations),
    metadata: normalizeJSONB(l.metadata),
  }));
}

async function getLogById(
  supabase: ReturnType<typeof createClient>,
  entryId: string
) {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entry_id", entryId)
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    parameters: normalizeJSONB(data.parameters),
    data_fields_accessed: Array.isArray(data.data_fields_accessed)
      ? data.data_fields_accessed
      : [],
    policy_violations: normalizeJSONB(data.policy_violations),
    metadata: normalizeJSONB(data.metadata),
  };
}

async function getAllLogs(
  supabase: ReturnType<typeof createClient>
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(10000);

  if (error) {
    console.error("[supabase] getAllLogs error:", error);
    return [];
  }

  return (data || []).map((l) => ({
    ...l,
    parameters: normalizeJSONB(l.parameters),
    data_fields_accessed: Array.isArray(l.data_fields_accessed)
      ? l.data_fields_accessed
      : [],
    policy_violations: normalizeJSONB(l.policy_violations),
    metadata: normalizeJSONB(l.metadata),
  }));
}

async function verifyChain(
  supabase: ReturnType<typeof createClient>
): Promise<{
  valid: boolean;
  at: string | null;
  reason: string;
  entries_checked: number;
}> {
  const logs = await getAllLogs(supabase);

  if (logs.length === 0) {
    return { valid: true, entries_checked: 0, at: null, reason: "" };
  }

  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];
    const expectedPrev = i === 0 ? null : (logs[i - 1] as Record<string, unknown>).hash as string;

    if (String(entry.previous_hash ?? null) !== String(expectedPrev)) {
      return {
        valid: false,
        at: entry.entry_id as string,
        reason: `previous_hash mismatch at entry ${i}`,
        entries_checked: i,
      };
    }

    // DEBUG: compute the payload we use for hash
    const debugPayload = [
      entry.previous_hash ?? GENESIS_HASH,
      String(entry.entry_id || entry.id || ""),
      String(entry.timestamp || ""),
      String(entry.agent_id || ""),
      String(entry.agent_name || ""),
      String(entry.tool_name || ""),
      String(entry.tool_action || ""),
      sortedJSON((entry.parameters as Record<string, unknown>) ?? {}),
      String(entry.response_summary ?? ""),
      String(entry.response_status ?? "success"),
      JSON.stringify(Array.isArray(entry.data_fields_accessed) ? (entry.data_fields_accessed as unknown[]).slice().sort() : []),
      String(entry.execution_duration_ms ?? 0),
      String(entry.token_cost_estimate ?? ""),
      sortedJSON((entry.policy_violations as unknown) ?? []),
      sortedJSON((entry.metadata as Record<string, unknown>) ?? {}),
    ].join("|");
    console.error("[verify] entry_id=" + String(entry.entry_id) + " payload=" + debugPayload);

    const recomputed = await computeEntryHash(
      entry.previous_hash as string | null,
      entry as Record<string, unknown>
    );

    if (recomputed !== entry.hash) {
      return {
        valid: false,
        at: entry.entry_id as string,
        reason: `hash mismatch at entry ${i}: computed ${recomputed.slice(0, 16)}... != stored ${(entry.hash as string).slice(0, 16)}...`,
        entries_checked: i,
        debug_payload: debugPayload,
        debug_entry: entry,
      };
    }
  }

  return { valid: true, entries_checked: logs.length, at: null, reason: "" };
}

async function getSummary(
  supabase: ReturnType<typeof createClient>
): Promise<{
  total_logs: number;
  logs_with_violations: number;
  by_agent: Record<string, number>;
  by_tool: Record<string, number>;
}> {
  const logs = await getAllLogs(supabase);
  const byAgent: Record<string, number> = {};
  const byTool: Record<string, number> = {};
  let violations = 0;

  for (const l of logs) {
    const agentName = String(l.agent_name || "unknown");
    const toolName = String(l.tool_name || "unknown");
    byAgent[agentName] = (byAgent[agentName] || 0) + 1;
    byTool[toolName] = (byTool[toolName] || 0) + 1;
    const pvs = normalizeJSONB(l.policy_violations);
    if (Array.isArray(pvs) && pvs.length > 0) violations++;
  }

  return {
    total_logs: logs.length,
    logs_with_violations: violations,
    by_agent: byAgent,
    by_tool: byTool,
  };
}

// ============================================================
// List agents
// ============================================================
async function listAgents(
  supabase: ReturnType<typeof createClient>
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("last_active", { ascending: false });
  if (error) return [];
  return data || [];
}

async function registerAgent(
  supabase: ReturnType<typeof createClient>,
  agentId: string,
  name: string,
  description?: string
) {
  const { data, error } = await supabase
    .from("agents")
    .upsert(
      { agent_id: agentId, name, description: description || "", last_active: new Date().toISOString() },
      { onConflict: "agent_id" }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to register agent: ${error.message}`);
  return data;
}

// ============================================================
// MCP request handler
// ============================================================
type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: unknown;
  method: string;
  params?: Record<string, unknown>;
};

async function handleMCPRequest(
  supabase: ReturnType<typeof createClient>,
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (method) {
    case "initialize": {
      return {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "agent-audit-trail", version: "1.0.0" },
      };
    }

    case "tools/list": {
      return {
        tools: [
          {
            name: "log_action",
            description:
              "Log an agent action to the immutable audit trail. Returns the log entry ID, cryptographic hash, and any policy violations detected.",
            inputSchema: {
              type: "object",
              properties: {
                agent_name: {
                  type: "string",
                  description: "Name of the agent",
                },
                agent_id: {
                  type: "string",
                  description: "Unique agent ID",
                },
                tool_name: {
                  type: "string",
                  description: "Name of the tool called",
                },
                tool_action: {
                  type: "string",
                  description: "Specific action (e.g., SELECT)",
                },
                parameters: {
                  type: "object",
                  additionalProperties: true,
                },
                response_summary: { type: "string" },
                response_status: {
                  type: "string",
                  enum: ["success", "error", "blocked"],
                },
                data_fields_accessed: {
                  type: "array",
                  items: { type: "string" },
                },
                execution_duration_ms: { type: "number" },
                token_cost_estimate: { type: "number" },
                metadata: {
                  type: "object",
                  additionalProperties: true,
                },
              },
              required: ["agent_name", "tool_name"],
            },
          },
          {
            name: "query_logs",
            description: "Search the audit trail with filters.",
            inputSchema: {
              type: "object",
              properties: {
                agent_id: { type: "string" },
                tool_name: { type: "string" },
                status: {
                  type: "string",
                  enum: ["success", "error", "blocked"],
                },
                has_violations: { type: "boolean" },
                start_date: { type: "string" },
                end_date: { type: "string" },
                limit: { type: "number", default: 20 },
                offset: { type: "number", default: 0 },
              },
            },
          },
          {
            name: "get_log_detail",
            description: "Get full details for a specific audit log entry.",
            inputSchema: {
              type: "object",
              properties: { log_id: { type: "string" } },
              required: ["log_id"],
            },
          },
          {
            name: "get_summary",
            description: "Get a dashboard summary of audit trail activity.",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "verify_chain",
            description:
              "Verify the cryptographic integrity of the entire audit trail chain.",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "list_agents",
            description: "List all registered agents.",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "register_agent",
            description: "Register a new agent or update an existing one.",
            inputSchema: {
              type: "object",
              properties: {
                agent_id: { type: "string" },
                name: { type: "string" },
                description: { type: "string" },
              },
              required: ["agent_id", "name"],
            },
          },
          {
            name: "list_policy_rules",
            description: "List all policy rules.",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "add_policy_rule",
            description: "Add a new policy rule.",
            inputSchema: {
              type: "object",
              properties: {
                rule_id: { type: "string" },
                name: { type: "string" },
                description: { type: "string" },
                condition_type: {
                  type: "string",
                  enum: ["tool_match", "parameter_match", "data_field_match", "threshold"],
                },
                condition_operator: {
                  type: "string",
                  enum: ["equals", "contains", "greater_than", "less_than", "matches_regex"],
                },
                condition_value: { type: "string" },
                action: { type: "string", enum: ["flag", "block", "alert"] },
                severity: {
                  type: "string",
                  enum: ["low", "medium", "high", "critical"],
                },
              },
              required: ["rule_id", "name", "description", "condition_type", "condition_operator", "condition_value", "action", "severity"],
            },
          },
          {
            name: "toggle_policy_rule",
            description: "Enable or disable a policy rule.",
            inputSchema: {
              type: "object",
              properties: {
                rule_id: { type: "string" },
                enabled: { type: "boolean" },
              },
              required: ["rule_id", "enabled"],
            },
          },
          {
            name: "export_audit_log",
            description: "Export audit logs as a JSON compliance report.",
            inputSchema: {
              type: "object",
              properties: {
                agent_id: { type: "string" },
                tool_name: { type: "string" },
                start_date: { type: "string" },
                end_date: { type: "string" },
                has_violations: { type: "boolean" },
              },
            },
          },
        ],
      };
    }

    case "tools/call": {
      const { name, arguments: args = {} } = params as {
        name: string;
        arguments?: Record<string, unknown>;
      };

      if (name === "log_action") {
        const dataFields = Array.isArray(args.data_fields_accessed)
          ? (args.data_fields_accessed as string[])
          : [];
        const policyResult = await evaluatePolicy(
          supabase,
          String(args.tool_name || ""),
          String(args.tool_action || ""),
          (args.parameters as Record<string, unknown>) || {},
          dataFields
        );

        // If blocked by policy, log with blocked status and return error
        if (!policyResult.allowed) {
          const blockedEntry = await writeLog(supabase, {
            agent_id: String(args.agent_id || `agent_${(String(args.agent_name || "unknown")).toLowerCase().replace(/\s+/g, "_")}`),
            agent_name: String(args.agent_name || "unknown"),
            tool_name: String(args.tool_name || "unknown"),
            tool_action: String(args.tool_action || ""),
            parameters: (args.parameters as Record<string, unknown>) || {},
            response_summary: `BLOCKED by policy: ${policyResult.violations.map(v => v.rule_name).join(", ")}`,
            response_status: "blocked",
            data_fields_accessed: dataFields,
            execution_duration_ms: Number(args.execution_duration_ms) || 0,
            token_cost_estimate: args.token_cost_estimate ?? null,
            policy_violations: policyResult.violations,
            metadata: (args.metadata as Record<string, unknown>) || {},
          });

          throw new Error(
            `Action blocked by policy: ${policyResult.violations.map(v => `${v.rule_name} (${v.severity})`).join("; ")}`
          );
        }

        const entry = await writeLog(supabase, {
          agent_id: String(args.agent_id || `agent_${(String(args.agent_name || "unknown")).toLowerCase().replace(/\s+/g, "_")}`),
          agent_name: String(args.agent_name || "unknown"),
          tool_name: String(args.tool_name || "unknown"),
          tool_action: String(args.tool_action || ""),
          parameters: (args.parameters as Record<string, unknown>) || {},
          response_summary: String(args.response_summary || ""),
          response_status: String(args.response_status || "success"),
          data_fields_accessed: dataFields,
          execution_duration_ms: Number(args.execution_duration_ms) || 0,
          token_cost_estimate: args.token_cost_estimate ?? null,
          policy_violations: policyResult.violations,
          metadata: (args.metadata as Record<string, unknown>) || {},
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                log_id: entry.log_id || entry.id,
                timestamp: entry.timestamp,
                hash: entry.hash,
                previous_hash: entry.previous_hash,
                violations: policyResult.violations,
              }),
            },
          ],
        };
      }

      if (name === "query_logs") {
        const results = await queryLogs(supabase, {
          agent_id: args.agent_id as string | undefined,
          tool_name: args.tool_name as string | undefined,
          status: args.status as string | undefined,
          has_violations: args.has_violations as boolean | undefined,
          start_date: args.start_date as string | undefined,
          end_date: args.end_date as string | undefined,
          limit: (args.limit as number) || 20,
          offset: (args.offset as number) || 0,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                count: results.length,
                entries: results.map((l) => ({
                  id: l.entry_id || l.id,
                  timestamp: l.timestamp,
                  agent: l.agent_name,
                  tool: `${l.tool_name}.${l.tool_action}`,
                  status: l.response_status,
                  violations: Array.isArray(l.policy_violations)
                    ? l.policy_violations.length
                    : 0,
                  hash: l.hash,
                  previous_hash: l.previous_hash,
                })),
              }),
            },
          ],
        };
      }

      if (name === "get_log_detail") {
        const entry = await getLogById(supabase, String(args.log_id));
        if (!entry) {
          return {
            content: [
              {
                type: "text",
                text: `No log entry found with ID: ${args.log_id}`,
              },
            ],
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(entry, null, 2) }],
        };
      }

      if (name === "get_summary") {
        const summary = await getSummary(supabase);
        return {
          content: [
            { type: "text", text: JSON.stringify(summary, null, 2) },
          ],
        };
      }

      if (name === "verify_chain") {
        const result = await verifyChain(supabase);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  chain_intact: result.valid,
                  entries_verified: result.entries_checked,
                  broken_at: result.at ?? "none",
                  detail: result.valid
                    ? `All ${result.entries_checked} entries verified. Chain is intact.`
                    : result.reason,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (name === "list_agents") {
        const agents = await listAgents(supabase);
        return {
          content: [
            { type: "text", text: JSON.stringify({ agents }, null, 2) },
          ],
        };
      }

      if (name === "register_agent") {
        const agent = await registerAgent(
          supabase,
          String(args.agent_id),
          String(args.name),
          args.description as string | undefined
        );
        return {
          content: [
            { type: "text", text: JSON.stringify({ agent }, null, 2) },
          ],
        };
      }

      if (name === "list_policy_rules") {
        const { data } = await supabase
          .from("policy_rules")
          .select("*")
          .order("created_at", { ascending: false });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ rules: data || [] }, null, 2),
            },
          ],
        };
      }

      if (name === "add_policy_rule") {
        const { data, error } = await supabase
          .from("policy_rules")
          .insert({
            rule_id: String(args.rule_id),
            name: String(args.name),
            description: String(args.description),
            condition_type: String(args.condition_type),
            condition_operator: String(args.condition_operator),
            condition_value: String(args.condition_value),
            action: String(args.action),
            severity: String(args.severity),
            enabled: true,
          } as Record<string, unknown>)
          .select()
          .single();

        if (error)
          throw new Error(`Failed to add policy rule: ${error.message}`);
        return {
          content: [
            { type: "text", text: JSON.stringify({ rule: data }, null, 2) },
          ],
        };
      }

      if (name === "toggle_policy_rule") {
        const { data, error } = await supabase
          .from("policy_rules")
          .update({ enabled: Boolean(args.enabled) })
          .eq("rule_id", String(args.rule_id))
          .select()
          .single();

        if (error)
          throw new Error(
            `Failed to toggle policy rule: ${error.message}`
          );
        return {
          content: [
            { type: "text", text: JSON.stringify({ rule: data }, null, 2) },
          ],
        };
      }

      if (name === "export_audit_log") {
        const chainStatus = await verifyChain(supabase);
        const results = await queryLogs(supabase, {
          agent_id: args.agent_id as string | undefined,
          tool_name: args.tool_name as string | undefined,
          start_date: args.start_date as string | undefined,
          end_date: args.end_date as string | undefined,
          has_violations: args.has_violations as boolean | undefined,
          limit: 999999,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  export_timestamp: new Date().toISOString(),
                  export_version: "1.0",
                  chain_verification: chainStatus,
                  total_entries: results.length,
                  entries: results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    }

    case "ping": {
      return null;
    }

    case "debug_compute": {
      // Directly test computeEntryHash
      const args = params?.arguments || params || {};
      const prevHash = args.previous_hash as string | null;
      const testEntry: Record<string, unknown> = {
        entry_id: args.entry_id || "test-id",
        timestamp: args.timestamp || new Date().toISOString(),
        agent_id: args.agent_id || args.agent_name ? `agent_${(String(args.agent_name || "unknown")).toLowerCase().replace(/\s+/g, "_")}` : "",
        agent_name: args.agent_name || "",
        tool_name: args.tool_name || "",
        tool_action: args.tool_action || "",
        parameters: args.parameters || {},
        response_summary: args.response_summary || "",
        response_status: args.response_status || "success",
        data_fields_accessed: args.data_fields_accessed || [],
        execution_duration_ms: args.execution_duration_ms ?? 0,
        token_cost_estimate: args.token_cost_estimate || "",
        policy_violations: args.policy_violations || [],
        metadata: args.metadata || {},
      };
      const hash = await computeEntryHash(prevHash, testEntry);
      const payload_for_hash = [
        prevHash ? prevHash : GENESIS_HASH,
        String(testEntry.entry_id),
        String(testEntry.timestamp),
        String(testEntry.agent_id),
        String(testEntry.agent_name),
        String(testEntry.tool_name),
        String(testEntry.tool_action),
        sortedJSON(testEntry.parameters),
        String(testEntry.response_summary),
        String(testEntry.response_status),
        JSON.stringify(Array.isArray(testEntry.data_fields_accessed) ? (testEntry.data_fields_accessed as unknown[]).slice().sort() : []),
        String(testEntry.execution_duration_ms),
        String(testEntry.token_cost_estimate),
        sortedJSON(testEntry.policy_violations),
        sortedJSON(testEntry.metadata),
      ].join("|");
      return { hash, payload: payload_for_hash, entry: testEntry };
    }

    case "debug_verify_detail": {
      // Same logic as verifyChain but expose computed hash
      const { data: logs } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: true });

      if (!logs || logs.length === 0) return { valid: true, entries: 0 };

      for (let i = 0; i < logs.length; i++) {
        const entry = logs[i];
        const expectedPrev = i === 0 ? null : (logs[i - 1] as Record<string, unknown>).hash as string;
        const normalizedEntry = {
          ...entry,
          parameters: normalizeJSONB(entry.parameters),
          metadata: normalizeJSONB(entry.metadata),
          policy_violations: normalizeJSONB(entry.policy_violations),
          data_fields_accessed: entry.data_fields_accessed || [],
        };
        const recomputed = await computeEntryHash(
          entry.previous_hash as string | null,
          normalizedEntry as Record<string, unknown>
        );
        return {
          entry_idx: i,
          entry_id: entry.entry_id,
          stored_hash: entry.hash,
          computed_hash: recomputed,
          match: entry.hash === recomputed,
          prev_hash_used: expectedPrev,
          raw_params: entry.parameters,
          norm_params: normalizedEntry.parameters,
          raw_pv: entry.policy_violations,
        };
      }
    }

    case "debug_compare": {
      // Compare stored hash vs recomputed hash for a given log_id
      const logId = (params?.arguments || params || {}).log_id as string;
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("entry_id", logId)
        .single();
      if (!data) return { error: "not found" };

      // Build entry exactly as in verifyChain
      const entryForHash: Record<string, unknown> = {
        entry_id: data.entry_id,
        timestamp: data.timestamp,
        previous_hash: data.previous_hash,
        agent_id: data.agent_id,
        agent_name: data.agent_name,
        tool_name: data.tool_name,
        tool_action: data.tool_action,
        parameters: normalizeJSONB(data.parameters),
        response_summary: data.response_summary ?? "",
        response_status: data.response_status ?? "success",
        data_fields_accessed: Array.isArray(data.data_fields_accessed) ? data.data_fields_accessed : [],
        execution_duration_ms: data.execution_duration_ms ?? 0,
        token_cost_estimate: data.token_cost_estimate ?? "",
        policy_violations: normalizeJSONB(data.policy_violations),
        metadata: normalizeJSONB(data.metadata),
      };

      // Compute the payload manually for debugging
      const normParams = normalizeJSONB(data.parameters);
      const normMeta = normalizeJSONB(data.metadata);
      const normPV = normalizeJSONB(data.policy_violations);
      const dfa = Array.isArray(data.data_fields_accessed) ? data.data_fields_accessed.slice().sort() : [];
      const prevHash = data.previous_hash ?? GENESIS_HASH;
      const paramsSorted = sortedJSON(normParams as Record<string, unknown> ?? {});
      const metaSorted = sortedJSON(normMeta as Record<string, unknown> ?? {});
      const pvSorted = sortedJSON(normPV ?? []);
      const manualPayload = [
        prevHash,
        String(data.entry_id || ""),
        String(data.timestamp || ""),
        String(data.agent_id || ""),
        String(data.agent_name || ""),
        String(data.tool_name || ""),
        String(data.tool_action || ""),
        paramsSorted,
        String(data.response_summary ?? ""),
        String(data.response_status ?? "success"),
        JSON.stringify(dfa),
        String(data.execution_duration_ms ?? 0),
        String(data.token_cost_estimate ?? ""),
        pvSorted,
        metaSorted,
      ].join("|");
      console.error("[debug_compare] raw_params=" + JSON.stringify(data.parameters) + " normParams=" + JSON.stringify(normParams) + " paramsSorted=" + paramsSorted);

      const recomputedHash = await computeEntryHash(
        data.previous_hash as string | null,
        entryForHash
      );

      return {
        stored_hash: data.hash,
        recomputed_hash: recomputedHash,
        match: data.hash === recomputedHash,
        manual_payload: manualPayload,
        entry_types: {
          parameters: typeof data.parameters,
          metadata: typeof data.metadata,
          policy_violations: typeof data.policy_violations,
          data_fields_accessed: typeof data.data_fields_accessed,
          execution_duration_ms: typeof data.execution_duration_ms + "=" + String(data.execution_duration_ms),
          token_cost_estimate: typeof data.token_cost_estimate + "=" + String(data.token_cost_estimate),
        },
        entry: entryForHash,
      };
    }

    case "debug_entry": {
      // Get raw entry data
      const logId = (params?.arguments || params || {}).log_id;
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("entry_id", logId)
        .single();
      if (!data) return { error: "not found" };
      return { raw: data, types: {
        parameters: typeof data.parameters,
        metadata: typeof data.metadata,
        policy_violations: typeof data.policy_violations,
        data_fields_accessed: typeof data.data_fields_accessed,
      }};
    }

    case "debug_hash": {
      // Temporary debug method — returns intermediate values
      const args = params?.arguments || params || {};
      const prevHash = args.previous_hash || null;
      const p = [
        prevHash ?? GENESIS_HASH,
        String(args.entry_id || ""),
        String(args.timestamp || ""),
        String(args.agent_id || ""),
        String(args.agent_name || ""),
        String(args.tool_name || ""),
        String(args.tool_action || ""),
        sortedJSON(args.parameters ?? {}),
        String(args.response_summary ?? ""),
        String(args.response_status ?? "success"),
        JSON.stringify(Array.isArray(args.data_fields_accessed) ? (args.data_fields_accessed as unknown[]).slice().sort() : []),
        String(args.execution_duration_ms ?? 0),
        String(args.token_cost_estimate ?? ""),
        sortedJSON(args.policy_violations ?? []),
        sortedJSON(args.metadata ?? {}),
      ].join("|");
      console.error("[debug_hash] payload: " + p);
      const hash = await computeEntryHash(prevHash, args as Record<string, unknown>);
      return { computed_hash: hash, payload: p, args_summary: {
        entry_id: args.entry_id,
        agent_id: args.agent_id,
        tool_name: args.tool_name,
        parameters_type: typeof args.parameters,
        parameters_repr: String(args.parameters),
        dfa_type: typeof args.data_fields_accessed,
        dfa_repr: String(args.data_fields_accessed),
      }};
    }

    case "reset_chain": {
      // Admin-only: delete all entries to start fresh
      const { error } = await supabase.from("audit_logs").delete().neq("entry_id", "00000000-0000-0000-0000-000000000000");
      if (error) throw new Error("Failed to reset: " + error.message);
      return { success: true, message: "All audit log entries deleted" };
    }

    default: {
      throw new Error(`Unknown method: ${method}`);
    }
  }
}

// ============================================================
// Main handler
// ============================================================
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const supabaseUrl = Deno.env.get("AUDIT_SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("AUDIT_SERVICE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32603, message: "Missing Supabase environment variables" },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const url = new URL(req.url);

  // Extract the base path (strip /mcp suffix if present)
  const basePath = url.pathname.endsWith("/mcp")
    ? url.pathname.replace(/\/mcp$/, "")
    : url.pathname;
  const isMcpPost =
    (url.pathname.endsWith("/mcp") || url.pathname === basePath) &&
    req.method === "POST";
  const isMcpGet = url.pathname === basePath && req.method === "GET";
  const isHealth = url.pathname.endsWith("/health") && req.method === "GET";

  // Health endpoint
  if (isHealth) {
    const chainStatus = await verifyChain(supabase);
    const { count } = await supabase
      .from("audit_logs")
      .select("*", { count: "exact", head: true });

    return new Response(
      JSON.stringify({
        status: "ok",
        backend: "supabase",
        chain_intact: chainStatus.valid,
        entries: count ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Server info (GET /mcp or GET base)
  if (isMcpGet) {
    return new Response(
      JSON.stringify({
        name: "agent-audit-trail",
        version: "1.0.0",
        capabilities: { tools: { listChanged: false } },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // MCP POST endpoint
  if (isMcpPost) {
    let body: string;
    try {
      body = await req.text();
    } catch {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error" },
          id: null,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let rpcRequest: JsonRpcRequest;
    try {
      rpcRequest = JSON.parse(body) as JsonRpcRequest;
    } catch {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error" },
          id: null,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { id, method, params = {} } = rpcRequest;

    try {
      const result = await handleMCPRequest(supabase, method, params);

      // SSE support (accept header check)
      const accept = req.headers.get("accept") || "";
      if (accept.includes("text/event-stream")) {
        const sseBody = `data: ${JSON.stringify({ jsonrpc: "2.0", id, result })}\n\ndata: [DONE]\n\n`;
        return new Response(sseBody, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-MCP-protocol-version": "2024-11-05",
          },
        });
      }

      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id, result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: { code: -32603, message },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  // Not found
  return new Response("Not found", {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "text/plain" },
  });
});
