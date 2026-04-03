"use client";
import { useState, useEffect } from "react";

function AgentViz() {
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<"without"|"with">("without");
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const chaosLog = [
    { action: "Queried customer SSNs", icon: "\u26a0" },
    { action: "Sent email to unknown address", icon: "\u26a0" },
    { action: "Deleted 340 records", icon: "\u26a0" },
    { action: "Charged client $4,200", icon: "\u26a0" },
    { action: "Accessed medical history", icon: "\u26a0" },
    { action: "Called external API with PII", icon: "\u26a0" },
  ];

  const orderLog = [
    { action: "Queried clients table (2 fields)", status: "Logged", icon: "\u2713", color: "#4ade80" },
    { action: "Sent email via SendGrid", status: "Logged", icon: "\u2713", color: "#4ade80" },
    { action: "Accessed SSN field", status: "Flagged", icon: "!", color: "#fbbf24" },
    { action: "Processed $50 refund", status: "Logged", icon: "\u2713", color: "#4ade80" },
    { action: "Attempted DELETE on users", status: "Blocked", icon: "\u2715", color: "#f87171" },
    { action: "Read invoice #4021", status: "Logged", icon: "\u2713", color: "#4ade80" },
  ];

  const visibleCount = 4;
  const chaosOffset = tick % chaosLog.length;
  const orderOffset = tick % orderLog.length;
  const getVisible = <T,>(log: T[], offset: number): T[] => {
    const items: T[] = [];
    for (let i = 0; i < visibleCount; i++) items.push(log[(offset + i) % log.length]);
    return items;
  };

  return (
    <div>
      <div style={{ display: "flex" }}>
        {(["without", "with"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "13px 8px", fontSize: 13, fontWeight: 600,
            background: tab === t ? (t === "without" ? "rgba(255,60,60,0.05)" : "rgba(255,255,255,0.05)") : "transparent",
            color: tab === t ? "#fafafa" : "#404040",
            border: `1px solid ${tab === t ? (t === "without" ? "rgba(255,60,60,0.12)" : "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.04)"}`,
            borderBottom: tab === t ? "1px solid transparent" : "1px solid rgba(255,255,255,0.04)",
            borderRadius: t === "without" ? "10px 0 0 0" : "0 10px 0 0",
            cursor: "pointer", transition: "all 0.2s",
          }}>
            {t === "without" ? "Without Audit Trail" : "With Audit Trail"}
          </button>
        ))}
      </div>
      <div style={{
        borderRadius: "0 0 12px 12px", overflow: "hidden",
        border: `1px solid ${tab === "without" ? "rgba(255,60,60,0.08)" : "rgba(255,255,255,0.06)"}`,
        borderTop: "none",
        background: tab === "without" ? "rgba(255,30,30,0.02)" : "rgba(255,255,255,0.015)",
        transition: "all 0.3s",
      }}>
        <div style={{
          padding: "10px 16px",
          background: tab === "without" ? "rgba(255,40,40,0.05)" : "rgba(74,222,128,0.03)",
          borderBottom: `1px solid ${tab === "without" ? "rgba(255,60,60,0.06)" : "rgba(255,255,255,0.04)"}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 7, height: 7, borderRadius: 4,
              background: tab === "without" ? "#ff4444" : "#4ade80",
              animation: "pulse 1.5s ease-in-out infinite",
              boxShadow: tab === "without" ? "0 0 8px rgba(255,68,68,0.4)" : "0 0 8px rgba(74,222,128,0.4)",
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: tab === "without" ? "#ff8888" : "#4ade80" }}>
              {tab === "without" ? "NO OVERSIGHT" : "RECORDING"}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "#404040", fontFamily: "monospace" }}>
            {tab === "without" ? "0 actions logged" : `${tick % 47 + 31} actions logged`}
          </span>
        </div>
        <div style={{ padding: "20px 16px" }}>
          {tab === "without" ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(8px, 2vw, 16px)", flexWrap: "wrap", marginBottom: 20, padding: "16px 0" }}>
                {["Database", "Email", "Files", "CRM", "Payments", "API"].map((name, i) => {
                  const isActive = i === tick % 6;
                  return (
                    <div key={name} style={{
                      padding: "8px 14px", borderRadius: 8,
                      background: isActive ? "rgba(255,80,80,0.08)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${isActive ? "rgba(255,80,80,0.2)" : "rgba(255,255,255,0.05)"}`,
                      fontSize: 12, fontWeight: 500, color: isActive ? "#ff8888" : "#505050",
                      transition: "all 0.4s ease", transform: isActive ? "scale(1.05)" : "scale(1)",
                      position: "relative" as const,
                    }}>
                      {name}
                      {isActive && (
                        <div style={{
                          position: "absolute" as const, top: -6, right: -6, width: 14, height: 14, borderRadius: 7,
                          background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 8, fontWeight: 800, color: "#000", boxShadow: "0 0 12px rgba(255,255,255,0.3)",
                        }}>AI</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ border: "1px solid rgba(255,60,60,0.06)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "6px 12px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 10, color: "#333", textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 500 }}>Activity log</div>
                {getVisible(chaosLog, chaosOffset).map((entry, i) => (
                  <div key={`${entry.action}-${i}`} style={{
                    padding: "10px 12px", borderBottom: i < visibleCount - 1 ? "1px solid rgba(255,255,255,0.02)" : "none",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, opacity: 1 - (i * 0.15),
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 12, color: "#ff6b6b", flexShrink: 0 }}>{entry.icon}</span>
                      <span style={{ fontSize: 13, color: "#808080", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{entry.action}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#ff6b6b", fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "rgba(255,60,60,0.06)", flexShrink: 0 }}>??</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "#505050", textAlign: "center" as const, marginTop: 16, fontStyle: "italic" as const }}>No record of what happened. No way to prove compliance.</p>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(6px, 1.5vw, 14px)", marginBottom: 20, padding: "12px 0", flexWrap: "nowrap" as const, overflowX: "auto" as const }}>
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 19, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fafafa" }}>AI</div>
                  <span style={{ fontSize: 10, color: "#505050" }}>Agent</span>
                </div>
                <svg width="28" height="10" viewBox="0 0 28 10" style={{ flexShrink: 0 }}><line x1="0" y1="5" x2="20" y2="5" stroke="#333" strokeWidth="1" /><polyline points="18,2 24,5 18,8" fill="none" stroke="#333" strokeWidth="1" /></svg>
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4, flexShrink: 0, position: "relative" as const }}>
                  <div style={{ position: "absolute" as const, inset: -8, borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", animation: "pulse 2.5s ease-in-out infinite" }} />
                  <div style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", textAlign: "center" as const, position: "relative" as const }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#fafafa" }}>Audit Trail</div>
                  </div>
                  <span style={{ fontSize: 10, color: "#505050" }}>Logs + checks</span>
                </div>
                <svg width="28" height="10" viewBox="0 0 28 10" style={{ flexShrink: 0 }}><line x1="0" y1="5" x2="20" y2="5" stroke="#333" strokeWidth="1" /><polyline points="18,2 24,5 18,8" fill="none" stroke="#333" strokeWidth="1" /></svg>
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 4, flexShrink: 0 }}>
                  {["Database", "Email", "Payments"].map(name => (
                    <div key={name} style={{ padding: "5px 12px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "#808080", fontWeight: 500 }}>{name}</div>
                  ))}
                </div>
              </div>
              <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "6px 12px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.03)", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: "#404040", textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 500 }}>Audit log</span>
                  <span style={{ fontSize: 10, color: "#333", fontFamily: "monospace" }}>Live</span>
                </div>
                {getVisible(orderLog, orderOffset).map((entry, i) => (
                  <div key={`${entry.action}-${i}`} style={{
                    padding: "10px 12px", borderBottom: i < visibleCount - 1 ? "1px solid rgba(255,255,255,0.02)" : "none",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, opacity: 1 - (i * 0.12),
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 10, flexShrink: 0, width: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: `${entry.color}15`, color: entry.color, fontWeight: 700 }}>{entry.icon}</span>
                      <span style={{ fontSize: 13, color: "#a3a3a3", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{entry.action}</span>
                    </div>
                    <span style={{ fontSize: 11, color: entry.color, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: `${entry.color}10`, flexShrink: 0 }}>{entry.status}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "#4ade80", textAlign: "center" as const, marginTop: 16, fontWeight: 500, opacity: 0.7 }}>Every action accounted for. Exportable. Audit-ready.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatNum({ num, label }: { num: string; label: string }) {
  return (
    <div style={{ textAlign: "center" as const, flex: 1 }}>
      <div style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 200, color: "#fafafa", letterSpacing: "-0.03em", lineHeight: 1 }}>{num}</div>
      <div style={{ fontSize: 10, color: "#525252", marginTop: 6, textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

export default function Landing() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const handleSubmit = async () => {
    if (!email.includes("@")) return;
    try {
      const res = await fetch("https://agent-audit-trail-production.up.railway.app/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) setSubmitted(true);
    } catch {}
  };

  const sec: React.CSSProperties = { padding: "clamp(40px, 8vw, 80px) 0" };
  const lbl: React.CSSProperties = { fontSize: 11, color: "#404040", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 500, marginBottom: "clamp(16px, 3vw, 28px)" };

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#e5e5e5", fontFamily: "'DM Sans', system-ui, sans-serif", overflow: "hidden" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)", backgroundSize: "60px 60px", opacity: 0.5 }} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "0 clamp(16px, 4vw, 28px)" }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: "#fff", animation: "pulse 3s ease-in-out infinite" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#fafafa" }}>AI Agent Audit</span>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <a href="https://github.com/dtjohnson83/agent-audit-trail" target="_blank" rel="noopener noreferrer" style={{ color: "#525252", fontSize: 12, textDecoration: "none" }}>GitHub</a>
            <a href="https://linkedin.com/in/danjohnsondata" target="_blank" rel="noopener noreferrer" style={{ color: "#525252", fontSize: 12, textDecoration: "none" }}>LinkedIn</a>
            <a href="#contact" style={{ color: "#000", background: "#fff", fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 6, textDecoration: "none", whiteSpace: "nowrap" }}>Get in Touch</a>
          </div>
        </nav>
        <section style={{ paddingTop: "clamp(60px, 12vw, 120px)", paddingBottom: "clamp(32px, 6vw, 60px)", animation: "fadeIn 1s ease forwards" }}>
          <p style={{ fontSize: 11, color: "#525252", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 500, marginBottom: 16 }}>Open source MCP server</p>
          <h1 style={{ fontSize: "clamp(32px, 7vw, 68px)", fontWeight: 300, lineHeight: 1.08, letterSpacing: "-0.04em", color: "#fafafa", marginBottom: 20, maxWidth: 600 }}>Know what your AI agents did.</h1>
          <p style={{ fontSize: "clamp(15px, 2.5vw, 18px)", color: "#525252", maxWidth: 460, lineHeight: 1.65, fontWeight: 300, marginBottom: 32 }}>If you handle client data, you need a record of every action your AI takes. Agent Audit Trail creates that record automatically.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="https://github.com/dtjohnson83/agent-audit-trail" target="_blank" rel="noopener noreferrer" style={{ padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, background: "#fff", color: "#000", textDecoration: "none" }}>View on GitHub</a>
            <a href="#how" style={{ padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 400, color: "#707070", border: "1px solid rgba(255,255,255,0.1)", textDecoration: "none" }}>How it works</a>
          </div>
        </section>
        <section style={sec}><p style={lbl}>See the difference</p><AgentViz /></section>
        <section style={sec}>
          <p style={lbl}>Think of it this way</p>
          <div style={{ maxWidth: 600, padding: "clamp(20px, 4vw, 36px)", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: "clamp(16px, 2.5vw, 20px)", fontWeight: 300, color: "#a3a3a3", lineHeight: 1.7 }}>When an employee handles sensitive files, there\u2019s a paper trail. Access logs, timestamps, signatures.</p>
            <p style={{ fontSize: "clamp(16px, 2.5vw, 20px)", fontWeight: 300, color: "#a3a3a3", lineHeight: 1.7, marginTop: 14 }}>AI agents don\u2019t leave that trail.</p>
            <p style={{ fontSize: "clamp(17px, 2.8vw, 22px)", fontWeight: 400, color: "#fafafa", lineHeight: 1.7, marginTop: 18 }}>Agent Audit Trail is the sign-in sheet for your AI. Every action recorded. Every data access logged. Nothing editable after the fact.</p>
          </div>
        </section>
        <section id="how" style={sec}>
          <p style={lbl}>How it works</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {[{ n: "01", t: "Install", d: "Add one line to your agent config. No code changes, no infrastructure." }, { n: "02", t: "Work normally", d: "Your agents call tools the same way. Everything is recorded in the background." }, { n: "03", t: "Review anytime", d: "Query logs, check violations, export reports when a client or regulator asks." }].map((s, i) => (
              <div key={i} style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 11, color: "#333", fontFamily: "'JetBrains Mono', monospace" }}>{s.n}</span>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "#fafafa", marginTop: 8, marginBottom: 6 }}>{s.t}</h3>
                <p style={{ fontSize: 13, color: "#525252", lineHeight: 1.6, fontWeight: 300 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </section>
        <section style={sec}>
          <p style={lbl}>What the policy engine catches</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {[{ l: "PII Access", d: "Agent touched email, SSN, phone, or address fields.", t: "HIGH" }, { l: "Financial Thresholds", d: "Charge, refund, or transfer over your set limit.", t: "HIGH" }, { l: "Destructive Actions", d: "DELETE, DROP, or TRUNCATE in a database call.", t: "CRITICAL" }].map((item, i) => (
              <div key={i} style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#fafafa" }}>{item.l}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: item.t === "CRITICAL" ? "#e5e5e5" : "#707070", letterSpacing: "0.05em" }}>{item.t}</span>
                </div>
                <p style={{ fontSize: 13, color: "#525252", lineHeight: 1.6, fontWeight: 300 }}>{item.d}</p>
              </div>
            ))}
          </div>
        </section>
        <section style={sec}>
          <p style={lbl}>Who this is for</p>
          <div style={{ maxWidth: 540 }}>
            {["Financial advisors protecting client portfolio data.", "Law firms proving AI didn\u2019t expose privileged info.", "HR teams using AI screening under anti-discrimination rules.", "Insurance agencies processing claims with AI.", "Accounting firms where every data access must be traceable.", "Anyone handling other people\u2019s sensitive information."].map((text, i) => (<div key={i} style={{ padding: "12px 0", borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.03)" : "none", display: "flex", gap: 12 }}>
              <span style={{ color: "#404040", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, paddingTop: 2 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontSize: 14, color: "#a3a3a3", lineHeight: 1.55, fontWeight: 300 }}>{text}</span>
            </div>
            ))}
          </div>
        </section>
        <section style={{ padding: "clamp(32px, 6vw, 60px) 0" }}>
          <div style={{ display: "flex", justifyContent: "space-around", maxWidth: 400, padding: "28px 0", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <StatNum num="10" label="MCP Tools" />
            <StatNum num="3" label="Default Rules" />
            <StatNum num="1" label="Line to Install" />
          </div>
        </section>
        <section style={{ padding: "clamp(24px, 4vw, 40px) 0 clamp(40px, 8vw, 80px)" }}>
          <p style={lbl}>Installation</p>
          <div style={{ maxWidth: 460, borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 5, alignItems: "center" }}>
              <div style={{ width: 7, height: 7, borderRadius: 4, background: "#333" }} />
              <div style={{ width: 7, height: 7, borderRadius: 4, background: "#333" }} />
              <div style={{ width: 7, height: 7, borderRadius: 4, background: "#333" }} />
              <span style={{ fontSize: 10, color: "#333", marginLeft: 6, fontFamily: "'JetBrains Mono', monospace" }}>config.json</span>
            </div>
            <pre style={{ padding: "14px 16px", margin: 0, fontSize: 12, lineHeight: 1.8, overflowX: "auto", fontFamily: "'JetBrains Mono', monospace", color: "#707070", fontWeight: 300 }}>
{`{
  "mcpServers": {
    "audit-trail": {
      "command": "npx",
      "args": ["agent-audit-trail"]
    }
  }
}`}
            </pre>
          </div>
        </section>
        <section id="contact" style={{ ...sec, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ maxWidth: 440 }}>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 300, letterSpacing: "-0.03em", color: "#fafafa", marginBottom: 14, lineHeight: 1.2 }}>Interested?</h2>
            <p style={{ fontSize: 14, color: "#525252", lineHeight: 1.6, fontWeight: 300, marginBottom: 28 }}>The MCP server is free and open source. If you want help setting it up, or early access to the hosted dashboard, reach out.</p>
            <a href="https://linkedin.com/in/danjohnsondata" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, background: "#fff", color: "#000", textDecoration: "none", marginBottom: 24 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#000"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
              Connect on LinkedIn
            </a>
            <div>
              {!submitted ? (
                <div><p style={{ fontSize: 12, color: "#404040", marginBottom: 10 }}>Or join the waitlist:</p>
                  <div style={{ display: "flex", gap: 8, maxWidth: 340 }}>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="you@company.com" style={{ flex: 1, padding: "9px 12px", borderRadius: 8, fontSize: 13, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#e5e5e5", outline: "none", fontFamily: "'DM Sans', sans-serif", minWidth: 0 }} />
                    <button onClick={handleSubmit} style={{ padding: "9px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(255,255,255,0.06)", color: "#a3a3a3", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", whiteSpace: "nowrap" }}>Join</button>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "#707070" }}>Added. We\u2019ll be in touch.</p>
              )}
            </div>
          </div>
        </section>
        <footer style={{ padding: "20px 0", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#262626" }}>DANZUS Holdings LLC</span>
          <span style={{ fontSize: 10, color: "#262626" }}>Built for professionals who protect client data</span>
        </footer>
      </div>
    </div>
  );
}
