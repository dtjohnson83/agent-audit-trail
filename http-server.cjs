/**
 * Agent Audit Trail - Minimal MCP HTTP Server
 * Implements MCP JSON-RPC 2.0 over HTTP (Streamable HTTP profile)
 * With cryptographic hash chaining for tamper-evident logging.
 */
"use strict";

const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const { randomUUID, createHash } = require("crypto");

// ============================================================
// Hash chaining for immutability
// ============================================================
const GENESIS_HASH = "genesis";
const logs = [];
const AUDIT_FILE = path.join(process.env.AUDIT_DATA_DIR || "/app/data", "audit-logs.json");
const WAITLIST_FILE = path.join(process.env.AUDIT_DATA_DIR || "/app/data", "waitlist.json");

function computeEntryHash(previousHash, entry) {
  const payload = [
    previousHash ?? GENESIS_HASH,
    entry.id,
    entry.timestamp,
    entry.agent_id,
    entry.agent_name,
    entry.tool_name,
    entry.tool_action,
    JSON.stringify(entry.parameters ?? {}),
    entry.response_summary ?? "",
    entry.response_status ?? "success",
    JSON.stringify(entry.data_fields_accessed ?? []),
    String(entry.execution_duration_ms ?? 0),
    String(entry.token_cost_estimate ?? ""),
    JSON.stringify(entry.policy_violations ?? []),
    JSON.stringify(entry.metadata ?? {}),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

function verifyChain() {
  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];
    const expectedPrev = i === 0 ? null : logs[i - 1].hash;
    if (entry.previous_hash !== expectedPrev) {
      return { valid: false, at: entry.id, reason: "previous_hash broken", entries_checked: i };
    }
    const recomputed = computeEntryHash(entry.previous_hash, entry);
    if (recomputed !== entry.hash) {
      return { valid: false, at: entry.id, reason: "hash mismatch - entry tampered", entries_checked: i };
    }
  }
  return { valid: true, entries_checked: logs.length };
}

function persistLogs() {
  try {
    const dir = path.dirname(AUDIT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs, null, 2));
  } catch { /* silent */ }
}

function loadLogs() {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return;
    const data = JSON.parse(fs.readFileSync(AUDIT_FILE, "utf8"));
    if (Array.isArray(data)) logs.push(...data);
  } catch { /* start fresh */ }
}

function readWaitlist() {
  try {
    if (!fs.existsSync(WAITLIST_FILE)) return [];
    return JSON.parse(fs.readFileSync(WAITLIST_FILE, "utf8"));
  } catch { return []; }
}

function writeWaitlist(emails) {
  try {
    const dir = path.dirname(WAITLIST_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(WAITLIST_FILE, JSON.stringify(emails, null, 2));
  } catch (err) {
    console.error("[waitlist] Write error:", err.message);
  }
}

// Load persisted logs on startup
loadLogs();

// ============================================================
// Policy engine
// ============================================================
function evaluatePolicy(toolName, toolAction, parameters, dataFields) {
  const violations = [];
  const text = `${toolName} ${toolAction} ${dataFields.join(" ")}`.toLowerCase();
  const patternRules = [
    { id: "pii-rule", name: "PII Field Access", pattern: /ssn|passport|drivers_license|dob|date_of_birth|address|phone|email/i, severity: "high" },
    { id: "destructive-db", name: "Destructive Database Operation", pattern: /delete|drop|truncate|destroy/i, severity: "critical" },
  ];
  for (const rule of patternRules) {
    if (rule.pattern.test(text)) {
      violations.push({ rule_id: rule.id, rule_name: rule.name, severity: rule.severity, action_taken: "flag", details: `Rule "${rule.name}" triggered.` });
    }
  }
  const vals = Object.values(parameters || {}).map(Number).filter(n => !isNaN(n));
  if (vals.some(v => v > 1000)) {
    violations.push({ rule_id: "financial-threshold", rule_name: "High-Value Financial Action", severity: "high", action_taken: "flag", details: "Rule 'High-Value Financial Action' triggered." });
  }
  return violations;
}

// ============================================================
// Log store with hash chaining
// ============================================================
function writeLog(entry) {
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const previousHash = logs.length > 0 ? logs[logs.length - 1].hash : null;
  const entryData = {
    ...entry,
    id,
    timestamp,
    previous_hash: previousHash,
  };
  const hash = computeEntryHash(previousHash, entryData);
  const full = { ...entryData, hash };
  logs.unshift(full);
  if (logs.length > 10000) logs.splice(0, logs.length - 10000);
  persistLogs();
  return full;
}

function queryLogs(opts) {
  let r = [...logs];
  if (opts.agent_id) r = r.filter(l => l.agent_id === opts.agent_id);
  if (opts.tool_name) r = r.filter(l => l.tool_name === opts.tool_name);
  if (opts.has_violations) r = r.filter(l => l.policy_violations.length > 0);
  return r.slice(0, opts.limit || 50);
}

function getSummary() {
  const byAgent = {}, byTool = {};
  let violations = 0;
  for (const l of logs) {
    byAgent[l.agent_name] = (byAgent[l.agent_name] || 0) + 1;
    byTool[l.tool_name] = (byTool[l.tool_name] || 0) + 1;
    if (l.policy_violations.length > 0) violations++;
  }
  return { total_logs: logs.length, logs_with_violations: violations, by_agent: byAgent, by_tool: byTool };
}

function getLogById(id) {
  return logs.find(l => l.id === id);
}

// ============================================================
// MCP JSON-RPC request handler
// ============================================================
function handleMCPRequest(method, params) {
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
            description: "Log an agent action to the immutable audit trail. Returns the log entry ID, cryptographic hash, and any policy violations detected.",
            inputSchema: {
              type: "object",
              properties: {
                agent_name: { type: "string", description: "Name of the agent performing the action" },
                agent_id: { type: "string", description: "Unique agent ID (auto-generated if not provided)" },
                tool_name: { type: "string", description: "Name of the tool being called (e.g., 'database_query')" },
                tool_action: { type: "string", description: "Specific action (e.g., 'SELECT', 'INSERT')" },
                parameters: { type: "object", additionalProperties: true, description: "Tool parameters as key-value pairs" },
                response_summary: { type: "string", description: "Brief summary of what the tool returned" },
                response_status: { type: "string", enum: ["success", "error", "blocked"], description: "Outcome of the tool call" },
                data_fields_accessed: { type: "array", items: { type: "string" }, description: "Data fields accessed by this action" },
                execution_duration_ms: { type: "number", description: "Tool call duration in milliseconds" },
                token_cost_estimate: { type: "number", description: "Estimated token cost in USD" },
                metadata: { type: "object", additionalProperties: true },
              },
              required: ["agent_name", "tool_name"],
            },
          },
          {
            name: "query_logs",
            description: "Search the audit trail with filters. Returns log entries sorted newest first.",
            inputSchema: {
              type: "object",
              properties: {
                agent_id: { type: "string" },
                tool_name: { type: "string" },
                status: { type: "string", enum: ["success", "error", "blocked"] },
                has_violations: { type: "boolean" },
                start_date: { type: "string", description: "ISO date string" },
                end_date: { type: "string", description: "ISO date string" },
                limit: { type: "number", default: 20 },
                offset: { type: "number", default: 0 },
              },
            },
          },
          {
            name: "get_log_detail",
            description: "Get full details for a specific audit log entry by ID.",
            inputSchema: {
              type: "object",
              properties: {
                log_id: { type: "string" },
              },
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
            description: "Verify the cryptographic integrity of the entire audit trail chain. Detects any modification or deletion of log entries. Returns which entry (if any) first failed verification.",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "export_audit_log",
            description: "Export audit logs as a JSON compliance report. Includes chain verification result.",
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
      const { name, arguments: args = {} } = params;

      if (name === "log_action") {
        const dataFields = Array.isArray(args.data_fields_accessed) ? args.data_fields_accessed : [];
        const violations = evaluatePolicy(args.tool_name || "", args.tool_action || "", args.parameters || {}, dataFields);
        const entry = writeLog({
          agent_id: args.agent_id || `agent_${(args.agent_name || "unknown").toLowerCase().replace(/\s+/g, "_")}`,
          agent_name: args.agent_name || "unknown",
          tool_name: args.tool_name || "unknown",
          tool_action: args.tool_action || "",
          parameters: args.parameters || {},
          response_summary: args.response_summary || "",
          response_status: args.response_status || "success",
          data_fields_accessed: dataFields,
          execution_duration_ms: args.execution_duration_ms || 0,
          token_cost_estimate: args.token_cost_estimate ?? null,
          policy_violations: violations,
          metadata: args.metadata || {},
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              log_id: entry.id,
              timestamp: entry.timestamp,
              hash: entry.hash,
              previous_hash: entry.previous_hash,
              violations,
            }),
          }],
        };
      }

      if (name === "query_logs") {
        const results = queryLogs({
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
          content: [{
            type: "text",
            text: JSON.stringify({
              count: results.length,
              entries: results.map(l => ({
                id: l.id,
                timestamp: l.timestamp,
                agent: l.agent_name,
                tool: `${l.tool_name}.${l.tool_action}`,
                status: l.response_status,
                violations: l.policy_violations.length,
                hash: l.hash,
                previous_hash: l.previous_hash,
              })),
            }),
          }],
        };
      }

      if (name === "get_log_detail") {
        const entry = getLogById(args.log_id);
        if (!entry) {
          return { content: [{ type: "text", text: `No log entry found with ID: ${args.log_id}` }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(entry, null, 2) }] };
      }

      if (name === "get_summary") {
        return { content: [{ type: "text", text: JSON.stringify(getSummary(), null, 2) }] };
      }

      if (name === "verify_chain") {
        const result = verifyChain();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              chain_intact: result.valid,
              entries_verified: result.entries_checked,
              broken_at: result.at ?? "none",
              detail: result.valid
                ? `All ${result.entries_checked} entries verified. Chain is intact.`
                : result.reason,
            }, null, 2),
          }],
        };
      }

      if (name === "export_audit_log") {
        const chainStatus = verifyChain();
        const results = queryLogs({
          agent_id: args.agent_id,
          tool_name: args.tool_name,
          start_date: args.start_date,
          end_date: args.end_date,
          has_violations: args.has_violations,
          limit: 999999,
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              export_timestamp: new Date().toISOString(),
              export_version: "1.0",
              chain_verification: chainStatus,
              total_entries: results.length,
              entries: results,
            }, null, 2),
          }],
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    }

    case "ping":
      return null;

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

// ============================================================
// HTTP server
// ============================================================
const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, mcptools, mcpheaders, mcpprotocolversion",
      "Access-Control-Expose-Headers": "mcpheaders, mcptools, mcpprotocolversion",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  // Health check
  if (parsedUrl.pathname === "/health" && req.method === "GET") {
    const chainStatus = verifyChain();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", chain_intact: chainStatus.valid, entries: logs.length }));
    return;
  }

  // MCP POST endpoint
  if (parsedUrl.pathname === "/mcp" && req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();

    let id = null;
    let method = null;
    let params = null;

    try {
      const json = JSON.parse(body);
      id = json.id;
      method = json.method;
      params = json.params || {};
    } catch {
      res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }));
      return;
    }

    const accept = req.headers["accept"] || "";

    try {
      const result = handleMCPRequest(method, params);

      if (accept.includes("text/event-stream")) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "X-MCP-protocol-version": "2024-11-05",
        });
        res.write(`data: ${JSON.stringify({ jsonrpc: "2.0", id, result })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      } else {
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
      }
    } catch (err) {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32603, message: err.message } }));
    }
    return;
  }

  // Waitlist POST
  if (parsedUrl.pathname === "/waitlist" && req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    let email;
    try { ({ email } = JSON.parse(body)); } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }
    if (!email || !email.includes("@")) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid email" }));
      return;
    }
    const normalized = email.toLowerCase().trim();
    const emails = readWaitlist();
    if (emails.includes(normalized)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, duplicate: true }));
      return;
    }
    emails.push(normalized);
    writeWaitlist(emails);
    console.error(`[waitlist] New signup: ${normalized} (total: ${emails.length})`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // Waitlist GET
  if (parsedUrl.pathname === "/waitlist" && req.method === "GET") {
    const emails = readWaitlist();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ count: emails.length }));
    return;
  }

  // MCP GET
  if (parsedUrl.pathname === "/mcp" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({
      name: "agent-audit-trail",
      version: "1.0.0",
      capabilities: { tools: { listChanged: false } },
    }));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, HOST, () => {
  console.error(`Agent Audit Trail MCP server running on HTTP port ${PORT}`);
});

server.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});
