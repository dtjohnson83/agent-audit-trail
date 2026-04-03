"use client";
import { useState, useEffect } from "react";
const features = [
    {
        title: "Immutable Audit Trail",
        desc: "Every agent action logged with full context. What tool was called, what data was accessed, what the outcome was. Tamper-proof by design.",
        icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    },
    {
        title: "Policy Engine",
        desc: "Configurable rules that flag or block risky actions in real time. PII detection, financial thresholds, and destructive operations caught before they cause damage.",
        icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    },
    {
        title: "Compliance Export",
        desc: "One-click export of audit logs formatted for regulatory review. Built with Colorado SB 205, EU AI Act, and SOX requirements in mind.",
        icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    },
    {
        title: "Zero-Friction Install",
        desc: "Add one line to your MCP config. No code changes, no infrastructure, no vendor lock-in. Works with Claude, GPT, and any MCP-compatible agent.",
        icon: "M13 10V3L4 14h7v7l9-11h-7z",
    },
];
const useCases = [
    { role: "Financial Advisors", problem: "Can't use AI agents on client portfolios without proving data was handled properly." },
    { role: "Law Firms", problem: "Need documentation that AI tools didn't expose privileged client information." },
    { role: "HR Consultants", problem: "AI-assisted screening requires audit trails to satisfy anti-discrimination regulations." },
    { role: "Insurance Agencies", problem: "Agents processing claims data need verifiable logging for regulatory audits." },
    { role: "Accounting Firms", problem: "Client financial data touched by AI must be tracked and reportable." },
];
function Icon({ d, size = 24, color = "#22d3ee" }) {
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>);
}
function GlowDot({ top, left, size, color, delay: delayNum }) {
    return (<div style={{
            position: "absolute", top, left, width: size, height: size,
            borderRadius: "50%", background: color, filter: `blur(${size * 0.6}px)`,
            opacity: 0.15, animation: `float ${8 + delayNum}s ease-in-out infinite`,
            animationDelay: `${delayNum}s`,
        }}/>);
}
export default function LandingPage() {
    const [email, setEmail] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [visibleSections, setVisibleSections] = useState(new Set());
    useEffect(() => {
        const timer = setTimeout(() => {
            setVisibleSections(new Set(["hero", "problem", "features", "usecases", "cta"]));
        }, 100);
        return () => clearTimeout(timer);
    }, []);
    const handleSubmit = async () => {
        if (email.includes("@")) {
            try {
                await fetch("/api/waitlist", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                });
            }
            catch (_) {
                // still show success even if network fails
            }
            setSubmitted(true);
        }
    };
    return (<div style={{
            minHeight: "100vh", background: "#050505", color: "#e4e4e7",
            fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
            position: "relative", overflow: "hidden",
        }}>
      <div style={{
            position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1, mixBlendMode: "overlay", opacity: 0.025,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}/>
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.55) 100%)", pointerEvents: "none", zIndex: 1 }}/>

      <GlowDot top="5%" left="15%" size={300} color="#22d3ee" delay={0}/>
      <GlowDot top="40%" left="75%" size={250} color="#a855f7" delay={3}/>
      <GlowDot top="75%" left="30%" size={200} color="#22d3ee" delay={6}/>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes float { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,-20px) scale(1.05)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseGlow { 0%,100%{box-shadow:0 0 20px rgba(34,211,238,0.15)} 50%{box-shadow:0 0 40px rgba(34,211,238,0.3)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: rgba(34,211,238,0.3); }
        a:hover { opacity: 0.9; }
      `}</style>

      <div style={{ position: "relative", zIndex: 2, maxWidth: 1080, margin: "0 auto", padding: "0 24px" }}>

        <nav style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "20px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
            width: 8, height: 8, borderRadius: 4, background: "#22d3ee",
            boxShadow: "0 0 8px #22d3ee, 0 0 16px rgba(34,211,238,0.4)",
        }}/>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>AI Agent Audit</span>
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <a href="https://github.com/danzusholdings/agent-audit-trail" target="_blank" rel="noopener" style={{ color: "#52525b", fontSize: 13, textDecoration: "none", transition: "color 0.15s" }}>
              GitHub
            </a>
            <a href="#waitlist" style={{
            color: "#050505", background: "#22d3ee", fontSize: 13, fontWeight: 600,
            padding: "7px 16px", borderRadius: 8, textDecoration: "none",
            boxShadow: "0 0 16px rgba(34,211,238,0.2)",
        }}>
              Get Early Access
            </a>
          </div>
        </nav>

        <section style={{
            paddingTop: 100, paddingBottom: 80, textAlign: "center",
            animation: visibleSections.has("hero") ? "fadeUp 0.8s ease forwards" : "none",
            opacity: visibleSections.has("hero") ? 1 : 0,
        }}>
          <div style={{
            display: "inline-block", padding: "4px 14px", borderRadius: 100,
            background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.15)",
            fontSize: 12, color: "#22d3ee", fontWeight: 500, marginBottom: 24, letterSpacing: "0.02em",
        }}>
            Open Source MCP Server
          </div>
          <h1 style={{
            fontSize: "clamp(36px, 5.5vw, 64px)", fontWeight: 700, lineHeight: 1.08,
            letterSpacing: "-0.035em", marginBottom: 20, color: "#fafafa",
        }}>
            Your AI agents handle<br />
            <span style={{ color: "#22d3ee", textShadow: "0 0 40px rgba(34,211,238,0.25)" }}>sensitive data.</span><br />
            Now you can prove it.
          </h1>
          <p style={{
            fontSize: 17, color: "#71717a", maxWidth: 540, margin: "0 auto 36px",
            lineHeight: 1.6, fontWeight: 300,
        }}>
            Immutable audit logging and policy enforcement for AI agent workflows.
            Know exactly what your agents did, what data they touched, and whether
            any action crossed a boundary.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="https://github.com/danzusholdings/agent-audit-trail" target="_blank" rel="noopener" style={{
            padding: "12px 28px", borderRadius: 10, fontSize: 15, fontWeight: 600,
            background: "#22d3ee", color: "#050505", textDecoration: "none",
            boxShadow: "0 0 24px rgba(34,211,238,0.2)",
            animation: "pulseGlow 3s ease-in-out infinite",
        }}>
              View on GitHub
            </a>
            <a href="#waitlist" style={{
            padding: "12px 28px", borderRadius: 10, fontSize: 15, fontWeight: 500,
            background: "rgba(255,255,255,0.04)", color: "#a1a1aa",
            border: "1px solid rgba(255,255,255,0.08)", textDecoration: "none",
        }}>
              Join Waitlist
            </a>
          </div>
        </section>

        <section style={{
            maxWidth: 600, margin: "0 auto 80px", background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden",
        }}>
          <div style={{
            padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)",
            display: "flex", alignItems: "center", gap: 8,
        }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, background: "#ef4444", opacity: 0.6 }}/>
            <div style={{ width: 10, height: 10, borderRadius: 5, background: "#f59e0b", opacity: 0.6 }}/>
            <div style={{ width: 10, height: 10, borderRadius: 5, background: "#22c55e", opacity: 0.6 }}/>
            <span style={{ fontSize: 11, color: "#3f3f46", marginLeft: 8, fontFamily: "'JetBrains Mono', monospace" }}>claude_desktop_config.json</span>
          </div>
          <pre style={{
            padding: 20, margin: 0, fontSize: 13, lineHeight: 1.7, overflow: "auto",
            fontFamily: "'JetBrains Mono', monospace", color: "#a1a1aa",
        }}>
            <code>{`{"mcpServers":{"agent-audit-trail":{"command":"npx","args":["agent-audit-trail"]}}}`}</code>
          </pre>
        </section>

        <section style={{ padding: "60px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 16 }}>The problem</h2>
            <p style={{ fontSize: 17, color: "#71717a", lineHeight: 1.7, fontWeight: 300, marginBottom: 28 }}>
              AI agents are transforming how professionals work. But if you handle client data
              in finance, law, healthcare, insurance, or HR, you can&apos;t adopt agents without
              answering one question:
            </p>
            <div style={{
            padding: "20px 28px", borderRadius: 12,
            background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)",
            fontSize: 18, fontWeight: 500, fontStyle: "italic", color: "#fca5a5",
        }}>
              &quot;What did the AI do with my client&apos;s data, and can you prove it?&quot;
            </div>
            <p style={{ fontSize: 15, color: "#52525b", lineHeight: 1.7, fontWeight: 300, marginTop: 24 }}>
              Without an audit trail, the answer is no. That locks your firm out of the
              productivity gains your competitors are already capturing.
              Agent Audit Trail gives you the paper trail so you can say yes.
            </p>
          </div>
        </section>

        <section style={{ padding: "60px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 40, textAlign: "center" }}>How it works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {features.map((f, i) => (<div key={i} style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 14, padding: 24,
            }}>
                <div style={{ marginBottom: 14 }}><Icon d={f.icon}/></div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#fafafa" }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: "#71717a", lineHeight: 1.6, fontWeight: 300 }}>{f.desc}</p>
              </div>))}
          </div>
        </section>

        <section style={{ padding: "60px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 12, textAlign: "center" }}>
            Built for professionals with client data
          </h2>
          <p style={{ fontSize: 15, color: "#52525b", textAlign: "center", marginBottom: 36 }}>
            If your work involves sensitive information, this is for you.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 640, margin: "0 auto" }}>
            {useCases.map((u, i) => (<div key={i} style={{
                display: "flex", gap: 16, alignItems: "flex-start",
                padding: "16px 20px", borderRadius: 12,
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
            }}>
                <span style={{ flexShrink: 0, width: 140, fontSize: 13, fontWeight: 600, color: "#22d3ee", paddingTop: 1 }}>{u.role}</span>
                <span style={{ fontSize: 14, color: "#71717a", lineHeight: 1.5, fontWeight: 300 }}>{u.problem}</span>
              </div>))}
          </div>
        </section>

        <section id="waitlist" style={{ padding: "80px 0", borderTop: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
          {!submitted ? (<>
              <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 12 }}>Get early access</h2>
              <p style={{ fontSize: 15, color: "#52525b", maxWidth: 440, margin: "0 auto 28px" }}>
                The MCP server is free and open source on GitHub today. Join the waitlist for the
                hosted dashboard with team management, advanced policies, and compliance reporting.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", maxWidth: 420, margin: "0 auto" }}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" onKeyDown={e => e.key === "Enter" && handleSubmit()} style={{
                flex: 1, padding: "12px 16px", borderRadius: 10, fontSize: 14,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: "#e4e4e7", outline: "none", fontFamily: "inherit",
            }}/>
                <button onClick={handleSubmit} style={{
                padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                background: "#22d3ee", color: "#050505", border: "none", cursor: "pointer",
                boxShadow: "0 0 20px rgba(34,211,238,0.2)",
            }}>
                  Join Waitlist
                </button>
              </div>
            </>) : (<div>
              <div style={{
                width: 48, height: 48, borderRadius: 24, background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center",
                justifyContent: "center", margin: "0 auto 16px",
            }}>
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>You&apos;re on the list</h2>
              <p style={{ fontSize: 15, color: "#52525b" }}>We&apos;ll reach out when the hosted dashboard is ready.</p>
            </div>)}
        </section>

        <footer style={{
            padding: "24px 0", borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 12, color: "#27272a" }}>DANZUS Holdings LLC</span>
          <div style={{ display: "flex", gap: 20 }}>
            <a href="https://github.com/danzusholdings/agent-audit-trail" target="_blank" rel="noopener" style={{ fontSize: 12, color: "#3f3f46", textDecoration: "none" }}>GitHub</a>
            <a href="https://linkedin.com/in/danjohnsondata" target="_blank" rel="noopener" style={{ fontSize: 12, color: "#3f3f46", textDecoration: "none" }}>LinkedIn</a>
          </div>
        </footer>
      </div>
    </div>);
}
//# sourceMappingURL=page.js.map