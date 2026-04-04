/**
 * Agent Audit Trail - Minimal MCP HTTP Server with Supabase backend
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
// Supabase client (uses REST API via fetch)
// ============================================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

async function supabaseFetch(table, options = {}) {
  if (!USE_SUPABASE) return null;
  const { method = "GET", body, params = {} } = options;
  const queryStr = Object.keys(params).length > 0
    ? "?" + new URLSearchParams(params).toString()
    : "";
  const init = {
    method,
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=representation" : "",
    },
  };
  if (body) init.body = JSON.stringify(body);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${queryStr}`, init);
    const data = await res.json();
    if (!res.ok) {
      console.error(`[supabase] ${method} ${table} failed: ${res.status} ${JSON.stringify(data)}`);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`[supabase] ${method} ${table} error:`, err.message);
    return null;
  }
}

// ============================================================
// Hash chaining for immutability
// ============================================================
const GENESIS_HASH = "genesis";
const AUDIT_FILE = path.join(process.env.AUDIT_DATA_DIR || "/app/data", "audit-logs.json");
const WAITLIST_FILE = path.join(process.env.AUDIT_DATA_DIR || "/app/data", "waitlist.json");

/**
 * Sort keys in a JSON object for deterministic serialization.
 * Handles nested objects and arrays of objects.
 */
function sortedJSON(obj) {
  if (typeof obj === "string") {
    try { obj = JSON.parse(obj); } catch { return "{}"; }
  }
  if (Array.isArray(obj)) {
    return JSON.stringify(obj.map(item => {
      if (typeof item === "object" && item !== null) return sortedJSON(item);
      return item;
    }));
  }
  const keys = Object.keys(obj).sort();
  const result = {};
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "object" && v !== null) {
      result[k] = Array.isArray(v)
        ? v.map(vi => (typeof vi === "object" && vi !== null) ? sortedJSON(vi) : vi)
        : sortedJSON(v);
    } else {
      result[k] = v;
    }
  }
  return JSON.stringify(result);
}

function computeEntryHash(previousHash, entry) {
  const payload = [
    previousHash ?? GENESIS_HASH,
    entry.id || entry.entry_id,
    entry.timestamp,
    entry.agent_id,
    entry.agent_name,
    entry.tool_name,
    entry.tool_action,
    sortedJSON(entry.parameters ?? {}),
    entry.response_summary ?? "",
    entry.response_status ?? "success",
    JSON.stringify((entry.data_fields_accessed ?? []).slice().sort()),
    String(entry.execution_duration_ms ?? 0),
    String(entry.token_cost_estimate ?? ""),
    sortedJSON(entry.policy_violations ?? []),
    sortedJSON(entry.metadata ?? {}),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Normalize a value from Supabase JSONB for consistent handling.
 * Handles: objects, arrays of objects, strings, numbers, etc.
 */
function normalizeJSONB(val) {
  if (typeof val === "undefined" || val === null) return null;
  if (typeof val === "object") {
    if (Array.isArray(val)) {
      return val.map(item => {
        if (typeof item === "string") {
          try { return JSON.parse(item); } catch { return item; }
        }
        return item;
      });
    }
    return val;
  }
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

async function verifyChain() {
  let logs;
  if (USE_SUPABASE) {
    logs = await supabaseFetch("audit_logs?select=*&order=entry_id.asc&limit=10000");
    if (!logs) return { valid: false, at: null, reason: "Supabase unavailable", entries_checked: 0 };
  } else {
    logs = loadLocalLogs();
  }
  if (!logs || logs.length === 0) {
    return { valid: true, entries_checked: 0, at: null };
  }
  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];
    const expectedPrev = i === 0 ? null : logs[i - 1].hash;
    if (String(entry.previous_hash ?? null) !== String(expectedPrev)) {
      return { valid: false, at: entry.entry_id, reason: `previous_hash mismatch at entry ${i}`, entries_checked: i };
    }
    // Normalize JSONB fields before hash comparison
    const norm = normalizeJSONB(entry.parameters ?? {});
    const normMeta = normalizeJSONB(entry.metadata ?? {});
    const normPV = normalizeJSONB(entry.policy_violations ?? []);
    const normDfa = Array.isArray(entry.data_fields_accessed) ? entry.data_fields_accessed : [];
    const entryForHash = {
      ...entry,
      parameters: norm,
      data_fields_accessed: normDfa,
      policy_violations: normPV,
      metadata: normMeta,
    };
    const recomputed = computeEntryHash(entryForHash.previous_hash, entryForHash);
    if (recomputed !== entry.hash) {
      return { valid: false, at: entry.entry_id, reason: `hash mismatch at entry ${i}: computed ${recomputed.slice(0,16)}... != stored ${entry.hash.slice(0,16)}...`, entries_checked: i };
    }
  }
  return { valid: true, entries_checked: logs.length, at: null };
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

function loadLocalLogs() {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(AUDIT_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function saveLocalLogs(logs) {
  try {
    const dir = path.dirname(AUDIT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs, null, 2));
  } catch { /* silent */ }
}

// ============================================================
// Policy engine
// ============================================================
function evaluatePolicy(toolName, toolAction, parameters, dataFields) {
  const violations = [];
  const text = `${toolName} ${toolAction} ${(dataFields || []).join(" ")}`.toLowerCase();
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
// Log store — Supabase backend with local fallback
// ============================================================
async function writeLog(entry) {
  let previousHash = null;
  if (USE_SUPABASE) {
    const latest = await supabaseFetch("audit_logs?select=hash&order=entry_id.desc&limit=1");
    if (latest && latest.length > 0) previousHash = latest[0].hash;
  } else {
    const localLogs = loadLocalLogs();
    if (localLogs.length > 0) previousHash = localLogs[0].hash; // front = newest (unshift)
  }

  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const entryData = {
    ...entry,
    entry_id: id,
    timestamp,
    previous_hash: previousHash,
  };
  const hash = computeEntryHash(previousHash, entryData);

  const full = {
    ...entryData,
    hash,
    // Store as sorted JSON strings for determinism
    parameters: sortedJSON(entry.parameters ?? {}),
    data_fields_accessed: entry.data_fields_accessed || [],
    policy_violations: sortedJSON(entry.policy_violations || []),
    metadata: sortedJSON(entry.metadata || {}),
  };

  if (USE_SUPABASE) {
    const result = await supabaseFetch("audit_logs", { method: "POST", body: full });
    if (result && result.length > 0) {
      const saved = result[0];
      return {
        ...saved,
        parameters: normalizeJSONB(saved.parameters),
        data_fields_accessed: Array.isArray(saved.data_fields_accessed) ? saved.data_fields_accessed : [],
        policy_violations: normalizeJSONB(saved.policy_violations),
        metadata: normalizeJSONB(saved.metadata),
      };
    }
    console.error("[supabase] insert failed, using local fallback");
  }

  // Local fallback
  const localLogs = loadLocalLogs();
  const localEntry = {
    ...entryData,
    hash,
    parameters: entry.parameters ?? {},
    data_fields_accessed: entry.data_fields_accessed || [],
    policy_violations: entry.policy_violations || [],
    metadata: entry.metadata || {},
  };
  localLogs.unshift(localEntry);
  if (localLogs.length > 10000) localLogs.splice(0, localLogs.length - 10000);
  saveLocalLogs(localLogs);
  return localEntry;
}

async function queryLogs(opts = {}) {
  const limit = opts.limit || 20;
  const offset = opts.offset || 0;
  if (USE_SUPABASE) {
    let query = `audit_logs?select=*&order=entry_id.desc&limit=${limit}&offset=${offset}`;
    if (opts.agent_id) query += `&agent_id=eq.${encodeURIComponent(opts.agent_id)}`;
    if (opts.tool_name) query += `&tool_name=eq.${encodeURIComponent(opts.tool_name)}`;
    if (opts.status) query += `&response_status=eq.${encodeURIComponent(opts.status)}`;
    if (opts.has_violations) query += `&policy_violations=not.is.null`;
    if (opts.start_date) query += `&timestamp=gte.${encodeURIComponent(opts.start_date)}`;
    if (opts.end_date) query += `&timestamp=lte.${encodeURIComponent(opts.end_date)}`;
    const logs = await supabaseFetch(query);
    if (logs) {
      return logs.map(l => ({
        ...l,
        parameters: normalizeJSONB(l.parameters),
        data_fields_accessed: Array.isArray(l.data_fields_accessed) ? l.data_fields_accessed : [],
        policy_violations: normalizeJSONB(l.policy_violations),
        metadata: normalizeJSONB(l.metadata),
      }));
    }
  }
  let logs = loadLocalLogs();
  if (opts.agent_id) logs = logs.filter(l => l.agent_id === opts.agent_id);
  if (opts.tool_name) logs = logs.filter(l => l.tool_name === opts.tool_name);
  if (opts.status) logs = logs.filter(l => l.response_status === opts.status);
  if (opts.has_violations) logs = logs.filter(l => l.policy_violations?.length > 0);
  if (opts.start_date) logs = logs.filter(l => l.timestamp >= opts.start_date);
  if (opts.end_date) logs = logs.filter(l => l.timestamp <= opts.end_date);
  return logs.slice(offset, offset + limit);
}

async function getLogById(entryId) {
  if (USE_SUPABASE) {
    const logs = await supabaseFetch(`audit_logs?entry_id=eq.${encodeURIComponent(entryId)}&limit=1`);
    if (logs && logs.length > 0) {
      const l = logs[0];
      return {
        ...l,
        parameters: normalizeJSONB(l.parameters),
        data_fields_accessed: Array.isArray(l.data_fields_accessed) ? l.data_fields_accessed : [],
        policy_violations: normalizeJSONB(l.policy_violations),
        metadata: normalizeJSONB(l.metadata),
      };
    }
    return null;
  }
  const logs = loadLocalLogs();
  return logs.find(l => l.entry_id === entryId) || null;
}

async function getSummary() {
  let logs;
  if (USE_SUPABASE) {
    logs = await supabaseFetch("audit_logs?select=agent_name,tool_name,policy_violations,response_status&order=entry_id.desc&limit=10000");
    if (!logs) logs = [];
  } else {
    logs = loadLocalLogs();
  }
  const byAgent = {}, byTool = {};
  let violations = 0;
  for (const l of logs) {
    byAgent[l.agent_name] = (byAgent[l.agent_name] || 0) + 1;
    byTool[l.tool_name] = (byTool[l.tool_name] || 0) + 1;
    const pvs = normalizeJSONB(l.policy_violations);
    if (Array.isArray(pvs) && pvs.length > 0) violations++;
  }
  return { total_logs: logs.length, logs_with_violations: violations, by_agent: byAgent, by_tool: byTool };
}

// ============================================================
// MCP JSON-RPC request handler
// ============================================================
async function handleMCPRequest(method, params) {
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
                agent_name: { type: "string", description: "Name of the agent" },
                agent_id: { type: "string", description: "Unique agent ID" },
                tool_name: { type: "string", description: "Name of the tool called" },
                tool_action: { type: "string", description: "Specific action (e.g., SELECT)" },
                parameters: { type: "object", additionalProperties: true },
                response_summary: { type: "string" },
                response_status: { type: "string", enum: ["success", "error", "blocked"] },
                data_fields_accessed: { type: "array", items: { type: "string" } },
                execution_duration_ms: { type: "number" },
                token_cost_estimate: { type: "number" },
                metadata: { type: "object", additionalProperties: true },
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
                status: { type: "string", enum: ["success", "error", "blocked"] },
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
            inputSchema: { type: "object", properties: { log_id: { type: "string" } }, required: ["log_id"] },
          },
          {
            name: "get_summary",
            description: "Get a dashboard summary of audit trail activity.",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "verify_chain",
            description: "Verify the cryptographic integrity of the entire audit trail chain.",
            inputSchema: { type: "object", properties: {} },
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
      const { name, arguments: args = {} } = params;

      if (name === "log_action") {
        const dataFields = Array.isArray(args.data_fields_accessed) ? args.data_fields_accessed : [];
        const violations = evaluatePolicy(args.tool_name || "", args.tool_action || "", args.parameters || {}, dataFields);
        const entry = await writeLog({
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
              log_id: entry.entry_id || entry.id,
              timestamp: entry.timestamp,
              hash: entry.hash,
              previous_hash: entry.previous_hash,
              violations,
            }),
          }],
        };
      }

      if (name === "query_logs") {
        const results = await queryLogs({
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
                id: l.entry_id || l.id,
                timestamp: l.timestamp,
                agent: l.agent_name,
                tool: `${l.tool_name}.${l.tool_action}`,
                status: l.response_status,
                violations: Array.isArray(l.policy_violations) ? l.policy_violations.length : 0,
                hash: l.hash,
                previous_hash: l.previous_hash,
              })),
            }),
          }],
        };
      }

      if (name === "get_log_detail") {
        const entry = await getLogById(args.log_id);
        if (!entry) {
          return { content: [{ type: "text", text: `No log entry found with ID: ${args.log_id}` }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(entry, null, 2) }] };
      }

      if (name === "get_summary") {
        const summary = await getSummary();
        return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
      }

      if (name === "verify_chain") {
        const result = await verifyChain();
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
        const chainStatus = await verifyChain();
        const results = await queryLogs({
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

  if (parsedUrl.pathname === "/health" && req.method === "GET") {
    const chainStatus = await verifyChain();
    const logs = USE_SUPABASE
      ? await supabaseFetch("audit_logs?select=entry_id&limit=1")
      : loadLocalLogs();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      backend: USE_SUPABASE ? "supabase" : "local",
      chain_intact: chainStatus.valid,
      entries: Array.isArray(logs) ? logs.length : "?",
    }));
    return;
  }

  if (parsedUrl.pathname === "/mcp" && req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();

    let id = null, method = null, params = null;
    try {
      const json = JSON.parse(body);
      id = json.id; method = json.method; params = json.params || {};
    } catch {
      res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }));
      return;
    }

    const accept = req.headers["accept"] || "";
    try {
      const result = await handleMCPRequest(method, params);
      if (accept.includes("text/event-stream")) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*", "X-MCP-protocol-version": "2024-11-05",
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

  if (parsedUrl.pathname === "/waitlist" && req.method === "GET") {
    const emails = readWaitlist();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ count: emails.length }));
    return;
  }

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
  console.error(`Backend: ${USE_SUPABASE ? "Supabase" : "local JSON"}`);
});

server.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});
