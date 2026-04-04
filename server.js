/**
 * Agent Audit Trail - Vercel Serverless HTTP Handler
 * With cryptographic hash chaining for tamper-evident logging.
 */
const { randomUUID, createHash } = require("crypto");

// ============================================================
// Hash chaining for immutability
// ============================================================
const GENESIS_HASH = "genesis";
const logs = [];

function computeEntryHash(previousHash, entry) {
  const payload = [
    previousHash ?? GENESIS_HASH,
    entry.id, entry.timestamp,
    entry.agent_id, entry.agent_name, entry.tool_name, entry.tool_action,
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
  const vals = Object.values(parameters).map(Number).filter(n => !isNaN(n));
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
    ...entry, id, timestamp, previous_hash: previousHash,
  };
  const hash = computeEntryHash(previousHash, entryData);
  const full = { ...entryData, hash };
  logs.unshift(full);
  if (logs.length > 10000) logs.splice(0, logs.length - 10000);
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

function handleMcp(body) {
  const { method, params, id } = body;
  if (method === "tools/call") {
    const { name, arguments: args = {} } = params || {};
    if (name === "log_action") {
      const dataFields = typeof args.data_fields_accessed === "string"
        ? args.data_fields_accessed.split(",").map(s => s.trim()).filter(Boolean)
        : Array.isArray(args.data_fields_accessed) ? args.data_fields_accessed : [];
      const entry = {
        agent_id: args.agent_id || "vercel-agent", agent_name: args.agent_name || "unknown",
        tool_name: args.tool_name || "unknown", tool_action: args.tool_action || "",
        parameters: args.parameters || {}, response_summary: "logged", response_status: "success",
        data_fields_accessed: dataFields, execution_duration_ms: args.execution_duration_ms || 0,
        token_cost_estimate: args.token_cost_estimate ?? null, policy_violations: [], metadata: args.metadata || {},
      };
      const result = writeLog(entry);
      const violations = evaluatePolicy(args.tool_name || "unknown", args.tool_action || "", args.parameters || {}, dataFields);
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ log_id: result.id, hash: result.hash, previous_hash: result.previous_hash, violations }) }] } };
    }
    if (name === "query_logs") return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(queryLogs({ agent_id: args.agent_id, tool_name: args.tool_name, has_violations: args.has_violations, limit: args.limit })) }] } };
    if (name === "get_summary") return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(getSummary()) }] } };
    if (name === "verify_chain") {
      const result = verifyChain();
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ chain_intact: result.valid, entries_verified: result.entries_checked, broken_at: result.at ?? "none", detail: result.valid ? `All ${result.entries_checked} entries verified. Chain is intact.` : result.reason })}] } };
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${name}` } };
  }
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: [
      { name: "log_action", description: "Log an agent action to the immutable audit trail", inputSchema: { type: "object", properties: { agent_name: { type: "string" }, agent_id: { type: "string" }, tool_name: { type: "string" }, tool_action: { type: "string" }, parameters: { type: "object" }, data_fields_accessed: { type: "string" }, metadata: { type: "object" } }, required: ["agent_name", "tool_name"] } },
      { name: "query_logs", description: "Search and filter audit log entries", inputSchema: { type: "object", properties: { agent_id: { type: "string" }, tool_name: { type: "string" }, has_violations: { type: "boolean" }, limit: { type: "number" } } } },
      { name: "get_summary", description: "Get a dashboard summary of audit activity", inputSchema: { type: "object", properties: {} } },
      { name: "verify_chain", description: "Verify the cryptographic integrity of the audit trail chain", inputSchema: { type: "object", properties: {} } },
    ]}};
  }
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method: ${method}` } };
}

// ============================================================
// Landing page HTML (minified)
// ============================================================
const LANDING_PAGE = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AI Agent Audit</title><meta name="description" content="Compliance infrastructure for agentic AI."/><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#050505;color:#e4e4e7;font-family:'DM Sans',system-ui,sans-serif;min-height:100vh;overflow-x:hidden}.grain{position:fixed;inset:0;pointer-events:none;z-index:1;mix-blend-mode:overlay;opacity:.025;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}.vig{position:fixed;inset:0;background:radial-gradient(ellipse at center,transparent 0%,rgba(0,0,0,.55)100%);pointer-events:none;z-index:1}.blob{position:absolute;border-radius:50%;filter:blur(120px);opacity:.12;animation:float ease-in-out infinite}.b1{top:5%;left:15%;width:300px;height:300px;background:#22d3ee;animation-duration:8s}.b2{top:40%;left:75%;width:250px;height:250px;background:#a855f7;animation-duration:11s;animation-delay:3s}.b3{top:75%;left:30%;width:200px;height:200px;background:#22d3ee;animation-duration:14s;animation-delay:6s}@keyframes float{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(20px,-20px) scale(1.05)}}@keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}@keyframes pg{0%,100%{box-shadow:0 0 20px rgba(34,211,238,.15)}50%{box-shadow:0 0 40px rgba(34,211,238,.3)}}.wrap{position:relative;z-index:2;max-width:1080px;margin:0 auto;padding:0 24px}nav{display:flex;justify-content:space-between;align-items:center;padding:20px 0;border-bottom:1px solid rgba(255,255,255,.04)}.logo{display:flex;align-items:center;gap:10px}.ld{width:8px;height:8px;border-radius:4px;background:#22d3ee;box-shadow:0 0 8px #22d3ee,0 0 16px rgba(34,211,238,.4)}.lt{font-size:15px;font-weight:700;letter-spacing:-.01em}.nl{display:flex;gap:24px;align-items:center}.nl a{color:#52525b;font-size:13px;text-decoration:none;transition:color .15s}.nl a:hover{color:#a1a1aa}.cta{color:#050505;background:#22d3ee;font-size:13px;font-weight:600;padding:7px 16px;border-radius:8px;text-decoration:none;box-shadow:0 0 16px rgba(34,211,238,.2)}.hero{padding-top:100px;padding-bottom:80px;text-align:center;animation:fadeUp .8s ease forwards}.badge{display:inline-block;padding:4px 14px;border-radius:100px;background:rgba(34,211,238,.08);border:1px solid rgba(34,211,238,.15);font-size:12px;color:#22d3ee;font-weight:500;margin-bottom:24px;letter-spacing:.02em}.h1{font-size:clamp(36px,5.5vw,64px);font-weight:700;line-height:1.08;letter-spacing:-.035em;margin-bottom:20px;color:#fafafa}.h1 span{color:#22d3ee;text-shadow:0 0 40px rgba(34,211,238,.25)}.sp{font-size:17px;color:#71717a;max-width:540px;margin:0 auto 36px;line-height:1.6;font-weight:300}.btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}.btn1{padding:12px 28px;border-radius:10px;font-size:15px;font-weight:600;background:#22d3ee;color:#050505;text-decoration:none;box-shadow:0 0 24px rgba(34,211,238,.2);animation:pg 3s ease-in-out infinite}.btn2{padding:12px 28px;border-radius:10px;font-size:15px;font-weight:500;background:rgba(255,255,255,.04);color:#a1a1aa;border:1px solid rgba(255,255,255,.08);text-decoration:none}.cb{max-width:600px;margin:0 auto 80px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:14px;overflow:hidden}.ch{padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.04);display:flex;align-items:center;gap:8px}.dot{width:10px;height:10px;border-radius:5px}.dr{background:#ef4444;opacity:.6}.dy{background:#f59e0b;opacity:.6}.dg{background:#22c55e;opacity:.6}.cf{font-size:11px;color:#3f3f46;margin-left:8px;font-family:'JetBrains Mono',monospace}.cb pre{padding:20px;margin:0;font-size:13px;line-height:1.7;overflow:auto;font-family:'JetBrains Mono',monospace;color:#a1a1aa;white-space:pre-wrap}.sec{padding:60px 0;border-top:1px solid rgba(255,255,255,.04)}.sh{font-size:28px;font-weight:700;letter-spacing:-.02em;margin-bottom:40px;text-align:center}.fg{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.fc{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:24px}.fc svg{margin-bottom:14px}.fc h3{font-size:16px;font-weight:600;margin-bottom:8px;color:#fafafa}.fc p{font-size:14px;color:#71717a;line-height:1.6;font-weight:300}.prob{max-width:680px;margin:0 auto}.prob h2{font-size:28px;font-weight:700;letter-spacing:-.02em;margin-bottom:16px}.prob p{font-size:17px;color:#71717a;line-height:1.7;font-weight:300;margin-bottom:28px}.pq{padding:20px 28px;border-radius:12px;background:rgba(239,68,68,.04);border:1px solid rgba(239,68,68,.1);font-size:18px;font-weight:500;font-style:italic;color:#fca5a5}.pn{font-size:15px;color:#52525b;line-height:1.7;font-weight:300;margin-top:24px}.ur{display:flex;flex-direction:column;gap:8px;max-width:640px;margin:0 auto}.urw{display:flex;gap:16px;align-items:flex-start;padding:16px 20px;border-radius:12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04)}.urr{flex-shrink:0;width:140px;font-size:13px;font-weight:600;color:#22d3ee;padding-top:1px}.urp{font-size:14px;color:#71717a;line-height:1.5;font-weight:300}.ws{padding:80px 0;border-top:1px solid rgba(255,255,255,.04);text-align:center}.ws h2{font-size:32px;font-weight:700;letter-spacing:-.02em;margin-bottom:12px}.ws p{font-size:15px;color:#52525b;max-width:440px;margin:0 auto 28px}.wf{display:flex;gap:10px;justify-content:center;max-width:420px;margin:0 auto}.wi{flex:1;padding:12px 16px;border-radius:10px;font-size:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#e4e4e7;outline:none;font-family:inherit}.wb{padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;background:#22d3ee;color:#050505;border:none;cursor:pointer;box-shadow:0 0 20px rgba(34,211,238,.2)}.ssec{padding:24px 0;border-top:1px solid rgba(255,255,255,.04);display:flex;justify-content:space-between;align-items:center}.ssec span{font-size:12px;color:#27272a}.ssec a{font-size:12px;color:#3f3f46;text-decoration:none}
</style>
</head>
<body>
<div class="grain"></div><div class="vig"></div>
<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
<div class="wrap">
<nav><div class="logo"><div class="ld"></div><span class="lt">AI Agent Audit</span></div>
<div class="nl"><a href="https://github.com/danzusholdings/agent-audit-trail" target="_blank" rel="noopener">GitHub</a><a href="#waitlist" class="cta">Get Early Access</a></div>
</nav>
<section class="hero">
<div class="badge">Open Source MCP Server</div>
<h1 class="h1">Your AI agents handle<br/><span>sensitive data.</span><br/>Now you can prove it.</h1>
<p class="sp">Immutable audit logging and policy enforcement for AI agent workflows. Know exactly what your agents did, what data they touched, and whether any action crossed a boundary.</p>
<div class="btns"><a href="https://github.com/danzusholdings/agent-audit-trail" class="btn1" target="_blank" rel="noopener">View on GitHub</a><a href="#waitlist" class="btn2">Join Waitlist</a></div>
</section>
<div class="cb"><div class="ch"><div class="dot dr"></div><div class="dot dy"></div><div class="dot dg"></div><span class="cf">claude_desktop_config.json</span></div>
<pre>{"mcpServers":{"agent-audit-trail":{"command":"npx","args":["agent-audit-trail"]}}}</pre></div>
<section class="sec">
<div class="prob"><h2>The problem</h2>
<p>AI agents are transforming how professionals work. But if you handle client data in finance, law, healthcare, insurance, or HR, you can't adopt agents without answering one question:</p>
<div class="pq">"What did the AI do with my client's data, and can you prove it?"</div>
<p class="pn">Without an audit trail, the answer is no. Agent Audit Trail gives you the paper trail so you can say yes.</p></div>
</section>
<section class="sec"><h2 class="sh">How it works</h2>
<div class="fg">
<div class="fc"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg><h3>Immutable Audit Trail</h3><p>Every agent action logged with full context. Tamper-proof by design.</p></div>
<div class="fc"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg><h3>Policy Engine</h3><p>Configurable rules that flag or block risky actions in real time.</p></div>
<div class="fc"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><h3>Compliance Export</h3><p>One-click export formatted for Colorado SB 205, EU AI Act, and SOX.</p></div>
<div class="fc"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg><h3>Zero-Friction Install</h3><p>Add one line to your MCP config. Works with Claude, GPT, and any MCP-compatible agent.</p></div>
</div></section>
<section class="sec"><h2 class="sh">Built for professionals with client data</h2>
<div class="ur">
<div class="urw"><span class="urr">Financial Advisors</span><span class="urp">Can't use AI agents on client portfolios without proving data was handled properly.</span></div>
<div class="urw"><span class="urr">Law Firms</span><span class="urp">Need documentation that AI tools didn't expose privileged client information.</span></div>
<div class="urw"><span class="urr">HR Consultants</span><span class="urp">AI-assisted screening requires audit trails to satisfy anti-discrimination regulations.</span></div>
<div class="urw"><span class="urr">Insurance Agencies</span><span class="urp">Agents processing claims data need verifiable logging for regulatory audits.</span></div>
<div class="urw"><span class="urr">Accounting Firms</span><span class="urp">Client financial data touched by AI must be tracked and reportable.</span></div>
</div></section>
<section id="waitlist" class="ws">
<div id="wf"><h2>Get early access</h2>
<p>The MCP server is free and open source on GitHub. Join the waitlist for the hosted dashboard.</p>
<form class="wf" onsubmit="event.preventDefault();submit()"><input type="email" id="ei" class="wi" placeholder="you@company.com" required/><button type="submit" class="wb">Join Waitlist</button></form></div>
<div id="ws" style="display:none"><div style="width:48px;height:48px;border-radius:24px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);display:flex;align-items:center;justify-content:center;margin:0 auto 16px"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div><h2 style="font-size:24px;font-weight:700;margin-bottom:8px">You're on the list</h2><p style="font-size:15px;color:#52525b">We'll reach out when the hosted dashboard is ready.</p></div>
</section>
<footer class="ssec"><span>DANZUS Holdings LLC</span><div><a href="https://github.com/danzusholdings/agent-audit-trail" target="_blank" rel="noopener">GitHub</a> <a href="https://linkedin.com/in/danjohnsondata" target="_blank" rel="noopener">LinkedIn</a></div></footer>
</div>
<script>async function submit(){const e=document.getElementById('ei').value;if(e.includes('@')){try{await fetch('/api/waitlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e})})}catch(err){}document.getElementById('wf').style.display='none';document.getElementById('ws').style.display='block'}}
</script></body></html>`;

// ============================================================
// Waitlist (in-memory)
// ============================================================
const waitlistEmails = [];

// ============================================================
// Vercel serverless handler
// ============================================================
module.exports = async function handler(req, res) {
  const url = new URL(req.url || "/", `https://${req.headers.host}`);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, MCP-Procedure-Name");

  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  // Landing page
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(LANDING_PAGE);
    return;
  }

  // MCP endpoint
  if (url.pathname === "/api/mcp") {
    if (req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream", "Cache-Control": "no-cache",
        "Connection": "keep-alive", "MCP-Session-Id": url.searchParams.get("sessionId") || "stateless",
      });
      res.write(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "connected" })}\n\n`);
      const heartbeat = setInterval(() => { try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); } }, 30000);
      req.on("close", () => clearInterval(heartbeat));
      return;
    }

    if (req.method === "POST") {
      try {
        const body = req.body || {};
        const result = handleMcp(body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32603, message: err.message } }));
      }
      return;
    }
  }

  // Waitlist endpoint
  if (url.pathname === "/api/waitlist" && req.method === "POST") {
    try {
      const { email } = req.body || {};
      if (email && email.includes("@") && !waitlistEmails.includes(email)) waitlistEmails.push(email);
    } catch (e) {}
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("NOT_FOUND");
};
