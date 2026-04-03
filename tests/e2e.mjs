#!/usr/bin/env node

/**
 * End-to-end test for Agent Audit Trail MCP server.
 * Sends JSON-RPC messages over stdio and validates responses.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", "dist", "index.js");

let msgId = 0;
function rpc(method, params = {}) {
  return JSON.stringify({ jsonrpc: "2.0", id: ++msgId, method, params });
}

async function runTest() {
  const proc = spawn("node", [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, AUDIT_DATA_DIR: "/tmp/aat-test-" + Date.now() },
  });

  let buffer = "";
  const responses = [];

  proc.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.trim()) {
        try {
          responses.push(JSON.parse(line));
        } catch {}
      }
    }
  });

  function send(msg) {
    proc.stdin.write(msg + "\n");
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  let passed = 0;
  let failed = 0;

  function assert(name, condition) {
    if (condition) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name}`);
      failed++;
    }
  }

  // Initialize
  send(rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "1.0" },
  }));
  await wait(500);

  console.log("\n=== Agent Audit Trail - Test Suite ===\n");

  // Test 1: List tools
  console.log("1. List tools");
  send(rpc("tools/list"));
  await wait(500);
  const toolsResp = responses.find((r) => r.result?.tools);
  const toolNames = toolsResp?.result?.tools?.map((t) => t.name) || [];
  assert("Has 10 tools", toolNames.length === 10);
  assert("Has log_action", toolNames.includes("log_action"));
  assert("Has query_logs", toolNames.includes("query_logs"));
  assert("Has add_policy_rule", toolNames.includes("add_policy_rule"));
  assert("Has export_audit_log", toolNames.includes("export_audit_log"));

  // Test 2: Log a clean action (no violations)
  console.log("\n2. Log clean action");
  send(rpc("tools/call", {
    name: "log_action",
    arguments: {
      agent_name: "test-bot",
      tool_name: "weather_api",
      tool_action: "get_forecast",
      parameters: '{"city": "Sacramento"}',
      response_status: "success",
      response_summary: "Returned 7-day forecast",
    },
  }));
  await wait(500);
  const cleanResp = responses[responses.length - 1];
  const cleanResult = JSON.parse(cleanResp?.result?.content?.[0]?.text || "{}");
  assert("Returns log_id", !!cleanResult.log_id);
  assert("Status is success", cleanResult.status === "success");
  assert("No violations", cleanResult.violations_count === 0);

  // Test 3: Log action with PII (should trigger default rule)
  console.log("\n3. Log PII access action");
  send(rpc("tools/call", {
    name: "log_action",
    arguments: {
      agent_name: "customer-bot",
      tool_name: "database_query",
      tool_action: "SELECT",
      parameters: '{"query": "SELECT name, email, ssn FROM customers"}',
      data_fields_accessed: "name,email,ssn",
      response_status: "success",
    },
  }));
  await wait(500);
  const piiResp = responses[responses.length - 1];
  const piiResult = JSON.parse(piiResp?.result?.content?.[0]?.text || "{}");
  assert("Detected PII violations", piiResult.violations_count > 0);
  assert("PII rule triggered", piiResult.violations?.some((v) => v.rule === "PII Field Access"));

  // Test 4: Log high-value financial action
  console.log("\n4. Log financial threshold action");
  send(rpc("tools/call", {
    name: "log_action",
    arguments: {
      agent_name: "payment-bot",
      tool_name: "stripe",
      tool_action: "charge",
      parameters: '{"amount": 5000, "currency": "usd", "customer": "cus_123"}',
      response_status: "success",
    },
  }));
  await wait(500);
  const finResp = responses[responses.length - 1];
  const finResult = JSON.parse(finResp?.result?.content?.[0]?.text || "{}");
  assert("Detected financial violation", finResult.violations_count > 0);
  assert("Financial rule triggered", finResult.violations?.some((v) => v.rule === "High-Value Financial Action"));

  // Test 5: Log destructive action
  console.log("\n5. Log destructive action");
  send(rpc("tools/call", {
    name: "log_action",
    arguments: {
      agent_name: "cleanup-bot",
      tool_name: "database_query",
      tool_action: "DELETE",
      parameters: '{"query": "DELETE FROM users WHERE inactive = true"}',
      response_status: "success",
    },
  }));
  await wait(500);
  const delResp = responses[responses.length - 1];
  const delResult = JSON.parse(delResp?.result?.content?.[0]?.text || "{}");
  assert("Detected destructive violation", delResult.violations_count > 0);
  assert("Destructive rule triggered", delResult.violations?.some((v) => v.rule === "Destructive Action Detection"));

  // Test 6: Query logs
  console.log("\n6. Query logs");
  send(rpc("tools/call", {
    name: "query_logs",
    arguments: { limit: 10 },
  }));
  await wait(500);
  const queryResp = responses[responses.length - 1];
  const queryResult = JSON.parse(queryResp?.result?.content?.[0]?.text || "{}");
  assert("Returns 4 entries", queryResult.count === 4);

  // Test 7: Query with violation filter
  console.log("\n7. Query violations only");
  send(rpc("tools/call", {
    name: "query_logs",
    arguments: { has_violations: true },
  }));
  await wait(500);
  const violResp = responses[responses.length - 1];
  const violResult = JSON.parse(violResp?.result?.content?.[0]?.text || "{}");
  assert("Returns 3 violation entries", violResult.count === 3);

  // Test 8: Get summary
  console.log("\n8. Get summary");
  send(rpc("tools/call", {
    name: "get_summary",
    arguments: {},
  }));
  await wait(500);
  const sumResp = responses[responses.length - 1];
  const sumResult = JSON.parse(sumResp?.result?.content?.[0]?.text || "{}");
  assert("Total actions = 4", sumResult.total_actions === 4);
  assert("Has active agents", sumResult.active_agents > 0);
  assert("Has top tools", sumResult.top_tools?.length > 0);

  // Test 9: List agents
  console.log("\n9. List agents");
  send(rpc("tools/call", {
    name: "list_agents",
    arguments: {},
  }));
  await wait(500);
  const agentsResp = responses[responses.length - 1];
  const agentsResult = JSON.parse(agentsResp?.result?.content?.[0]?.text || "{}");
  assert("Has 4 auto-registered agents", agentsResult.agents?.length === 4);

  // Test 10: List default policy rules
  console.log("\n10. List policy rules");
  send(rpc("tools/call", {
    name: "list_policy_rules",
    arguments: {},
  }));
  await wait(500);
  const rulesResp = responses[responses.length - 1];
  const rulesResult = JSON.parse(rulesResp?.result?.content?.[0]?.text || "{}");
  assert("Has 3 default rules", rulesResult.rules?.length === 3);

  // Test 11: Add custom rule
  console.log("\n11. Add custom policy rule");
  send(rpc("tools/call", {
    name: "add_policy_rule",
    arguments: {
      name: "Block External APIs",
      description: "Block calls to external APIs",
      condition_type: "tool_match",
      condition_operator: "contains",
      condition_value: "external",
      action: "block",
      severity: "high",
    },
  }));
  await wait(500);
  const addRuleResp = responses[responses.length - 1];
  const addRuleResult = JSON.parse(addRuleResp?.result?.content?.[0]?.text || "{}");
  assert("Rule created with ID", !!addRuleResult.created?.id);

  // Test 12: Trigger the block rule
  console.log("\n12. Test blocking rule");
  send(rpc("tools/call", {
    name: "log_action",
    arguments: {
      agent_name: "risky-bot",
      tool_name: "external_api_call",
      tool_action: "POST",
      parameters: '{"url": "https://sketchy.api.com/data"}',
    },
  }));
  await wait(500);
  const blockResp = responses[responses.length - 1];
  const blockResult = JSON.parse(blockResp?.result?.content?.[0]?.text || "{}");
  assert("Action was blocked", blockResult.blocked === true);
  assert("Status is blocked", blockResult.status === "blocked");

  // Test 13: Export logs
  console.log("\n13. Export audit log");
  send(rpc("tools/call", {
    name: "export_audit_log",
    arguments: {},
  }));
  await wait(500);
  const exportResp = responses[responses.length - 1];
  const exportResult = JSON.parse(exportResp?.result?.content?.[0]?.text || "{}");
  assert("Export has version", exportResult.export_version === "1.0");
  assert("Export has 5 entries", exportResult.total_entries === 5);
  assert("Export has timestamp", !!exportResult.export_timestamp);

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

  proc.kill();
  process.exit(failed > 0 ? 1 : 0);
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
