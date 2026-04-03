/**
 * Agent Audit Trail - Minimal MCP HTTP Server
 * Implements MCP JSON-RPC 2.0 over HTTP (Streamable HTTP profile)
 * No external MCP SDK dependency needed for the transport layer.
 */
"use strict";

const http = require("http");
const url = require("url");
const { randomUUID } = require("crypto");

// ============================================================
// In-memory log store + policy engine (from the MCP server)
// ============================================================
const logs = [];

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
  const vals = Object.values(parameters).map(Number).filter(n => !isNaN(n));
  if (vals.some(v => v > 1000)) {
    violations.push({ rule_id: "financial-threshold", rule_name: "High-Value Financial Action", severity: "high", action_taken: "flag", details: "Rule 'High-Value Financial Action' triggered." });
  }
  return violations;
}

function writeLog(entry) {
  logs.push({ ...entry, id: randomUUID(), timestamp: new Date().toISOString() });
  return logs[logs.length - 1];
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
            description: "Log an agent action to the immutable audit trail",
            inputSchema: {
              type: "object",
              properties: {
                agent_name: { type: "string" },
                agent_id: { type: "string" },
                tool_name: { type: "string" },
                tool_action: { type: "string" },
                parameters: { type: "object", additionalProperties: true },
                data_fields_accessed: { type: "array", items: { type: "string" } },
                metadata: { type: "object", additionalProperties: true },
              },
              required: ["agent_name", "tool_name"],
            },
          },
        ],
      };
    }

    case "tools/call": {
      const { name, arguments: args } = params;
      if (name === "log_action") {
        const { agent_name, agent_id, tool_name, tool_action, parameters, data_fields_accessed, metadata } = args;
        const dataFields = data_fields_accessed || [];
        const violations = evaluatePolicy(tool_name, tool_action, parameters || {}, dataFields);
        const result = writeLog({
          agent_name, agent_id, tool_name, tool_action,
          parameters: parameters || {},
          data_fields_accessed: dataFields,
          metadata: metadata || {},
          violations,
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ log_id: result.id, violations }) }],
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
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // MCP POST endpoint
  if (req.method === "POST") {
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

    // Streamable HTTP: check Accept header
    const accept = req.headers["accept"] || "";

    try {
      const result = handleMCPRequest(method, params);

      if (accept.includes("text/event-stream")) {
        // SSE stream response
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "X-MCP-protocol-version": "2024-11-05",
        });
        const data = `data: ${JSON.stringify({ jsonrpc: "2.0", id, result })}\n\n`;
        res.write(data);
        res.write("data: [DONE]\n\n");
        res.end();
      } else {
        // Direct JSON response
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
      }
    } catch (err) {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: { code: -32603, message: err.message },
      }));
    }
    return;
  }

  // GET on /mcp — Smithery health check
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
