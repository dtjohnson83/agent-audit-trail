'use client'
// @ts-nocheck
import { useState, useEffect, useRef } from "react";

// ─── SCROLL REVEAL ───
function useReveal(opts: { threshold?: number } = {}): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); obs.unobserve(el); } },
      { threshold: opts.threshold || 0.12, rootMargin: "0px 0px -30px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, vis];
}

function Reveal({ children, delay = 0, y = 28, style = {} }: { children: React.ReactNode; delay?: number; y?: number; style?: React.CSSProperties }) {
  const [ref, vis] = useReveal();
  return (
    <div ref={ref} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? "translateY(0)" : `translateY(${y}px)`,
      transition: `opacity 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      willChange: "opacity, transform",
      ...style,
    }}>{children}</div>
  );
}

// ─── ICONS ───
const IconChain = ({ size = 20, color }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);
const IconShield = ({ size = 20, color }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
);
const IconDoc = ({ size = 20, color }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const IconEye = ({ size = 20, color }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14m-7-7l7 7-7 7"/>
  </svg>
);
const IconLogo = ({ size = 18, stroke = "#0c0c0e" }: { size?: number; stroke?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

// ─── COLOR SYSTEM ───
const C = {
  bg: "#0c0c0e",
  surface: "#141416",
  border: "rgba(255,255,255,0.05)",
  text: "#ececee",
  textMid: "#a0a0a8",
  textDim: "#5c5c66",
  textGhost: "#2e2e36",
  accent: "#d4a853",
  accentDim: "rgba(212,168,83,0.08)",
  accentBorder: "rgba(212,168,83,0.15)",
  danger: "#c4463a",
  warn: "#cc8832",
  ok: "#5a9a6e",
  info: "#6e8ab0",
};

// ─── MINI DASHBOARD ───
const now = new Date("2026-04-03T15:00:00Z");
const ts = (m: number) => new Date(now.getTime() - m * 60000).toISOString();
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

const DEMO_LOGS = [
  { tool: "bash", action: "execute", status: "success", summary: "Committed to main branch", ms: 320, violations: [], hash: "a1b2c3d4", ts: ts(2), agent: "Ed" },
  { tool: "supabase", action: "query", status: "success", summary: "Queried user contact data", ms: 128, violations: [{ severity: "high", msg: "PII fields accessed: email, phone" }], hash: "m4n5o6p7", ts: ts(8), agent: "Ed" },
  { tool: "database", action: "delete", status: "flagged", summary: "Destructive op blocked by policy", ms: 0, violations: [{ severity: "critical", msg: "DELETE operation blocked" }], hash: "g7h8i9j0", ts: ts(15), agent: "Ed" },
  { tool: "web_fetch", action: "scrape", status: "success", summary: "Fetched page for SEO analysis", ms: 1840, violations: [], hash: "j1k2l3m4", ts: ts(12), agent: "SEO" },
  { tool: "gemini_api", action: "generate", status: "success", summary: "Generated content", ms: 2100, violations: [], hash: "a1b2c0d1", ts: ts(30), agent: "SEO" },
];

const sevCol = (s) => ({ critical: C.danger, high: C.warn, medium: C.info }[s] || C.textDim);
const statCol = (s) => ({ success: C.ok, error: C.danger, flagged: C.warn }[s] || C.textDim);

function MiniDashboard() {
  const [openIdx, setOpenIdx] = useState(null);
  const [ref, vis] = useReveal({ threshold: 0.08 });

  return (
    <div ref={ref} style={{
      background: C.surface, borderRadius: 16, padding: "18px 14px",
      border: "1px solid " + C.border,
      boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
      position: "relative", overflow: "hidden", maxWidth: 420, margin: "0 auto",
      opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(20px)",
      transition: "all 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconLogo size={11} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text, letterSpacing: "0.04em", fontFamily: "var(--fh)", textTransform: "uppercase" }}>Audit Feed</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, background: "rgba(90,154,110,0.08)", border: "1px solid rgba(90,154,110,0.12)" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.ok, animation: "pulse 2.5s ease-in-out infinite" }} />
          <span style={{ fontSize: 8, color: C.ok, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "var(--fh)" }}>CHAIN INTACT</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
        {[
          { l: "ACTIONS", v: "847", c: C.text },
          { l: "FLAGGED", v: "2", c: C.warn },
          { l: "BLOCKED", v: "1", c: C.danger },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, padding: "7px 9px", borderRadius: 8,
            background: "rgba(255,255,255,0.02)", border: "1px solid " + C.border,
            opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(8px)",
            transition: "all 0.45s ease " + (0.25 + i * 0.07) + "s",
          }}>
            <div style={{ fontSize: 7, color: C.textDim, letterSpacing: "0.14em", fontWeight: 600, marginBottom: 2, fontFamily: "var(--fh)" }}>{s.l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.c, letterSpacing: "-0.02em", fontFamily: "var(--fh)" }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      {DEMO_LOGS.map((log, i) => {
        const hasV = log.violations.length > 0;
        const accent = hasV ? sevCol(log.violations[0].severity) : statCol(log.status);
        const isOpen = openIdx === i;
        return (
          <div key={i} onClick={() => setOpenIdx(isOpen ? null : i)} style={{
            display: "flex", gap: 9, cursor: "pointer",
            opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(6px)",
            transition: "all 0.45s ease " + (0.35 + i * 0.06) + "s",
          }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 12, paddingTop: 3 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: accent, flexShrink: 0 }} />
              {i < DEMO_LOGS.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 14, background: accent + "25", marginTop: 3 }} />}
            </div>
            <div style={{
              flex: 1, marginBottom: 5, padding: "7px 9px", borderRadius: 8,
              background: isOpen ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)",
              border: "1px solid " + (isOpen ? accent + "20" : C.border),
              transition: "all 0.2s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.text, fontFamily: "var(--fb)" }}>{log.tool}</span>
                  <span style={{ fontSize: 10, color: C.textDim, fontFamily: "var(--fb)" }}>.{log.action}</span>
                </div>
                <span style={{ fontSize: 7, padding: "2px 5px", borderRadius: 3, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: statCol(log.status), background: statCol(log.status) + "10", fontFamily: "var(--fh)" }}>{log.status}</span>
              </div>
              <div style={{ fontSize: 10, color: C.textMid, marginTop: 2, fontFamily: "var(--fb)" }}>{log.summary}</div>
              {hasV && <div style={{ marginTop: 4, padding: "3px 5px", borderRadius: 4, background: sevCol(log.violations[0].severity) + "08", border: "1px solid " + sevCol(log.violations[0].severity) + "12", fontSize: 9, color: sevCol(log.violations[0].severity), fontWeight: 600, fontFamily: "var(--fb)" }}>{log.violations[0].msg}</div>}
              <div style={{ display: "flex", gap: 5, marginTop: 3, fontSize: 9, color: C.textGhost, fontFamily: "var(--fb)" }}>
                <span style={{ color: C.textDim }}>{log.agent}</span><span>·</span><span>{fmtTime(log.ts)}</span><span>·</span>
                <span style={{ fontFamily: "monospace", fontSize: 8 }}>{log.hash}</span>
              </div>
              {isOpen && (
                <div style={{ marginTop: 7, paddingTop: 7, borderTop: "1px solid " + C.border }}>
                  <div style={{ display: "flex", gap: 14 }}>
                    {[
                      { l: "DURATION", v: log.ms + "ms" },
                      { l: "HASH", v: log.hash, c: C.accent, mono: true },
                      { l: "AGENT", v: log.agent },
                    ].map((d, di) => (
                      <div key={di}>
                        <div style={{ fontSize: 7, color: C.textGhost, letterSpacing: "0.1em", fontWeight: 700, fontFamily: "var(--fh)" }}>{d.l}</div>
                        <div style={{ fontSize: 10, color: d.c || C.textMid, fontFamily: d.mono ? "monospace" : "var(--fb)" }}>{d.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── PAGE ───
export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 60); }, []);

  const handleSubmit = async () => {
    if (!email.includes("@")) return;
    setLoading(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) setSubmitted(true);
    } catch (e) {
      // fail silently — submitted stays false
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "var(--fb)" }}>
      {/* BG */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -180, left: "10%", width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,168,83,0.03) 0%, transparent 60%)", filter: "blur(60px)" }} />
        <div style={{ position: "absolute", top: 400, right: "5%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(110,138,176,0.025) 0%, transparent 60%)", filter: "blur(50px)" }} />
        <div style={{ position: "absolute", inset: 0, opacity: 0.012, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>

        {/* NAV */}
        <nav style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 0",
          opacity: mounted ? 1 : 0, transition: "opacity 0.4s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconLogo size={15} />
            </div>
            <span style={{ fontFamily: "var(--fh)", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>Agent Audit Trail</span>
          </div>
          <a href="#waitlist" style={{
            padding: "6px 14px", borderRadius: 6, fontSize: 10, fontWeight: 700,
            fontFamily: "var(--fh)", letterSpacing: "0.06em", textTransform: "uppercase",
            background: C.accentDim, color: C.accent,
            border: "1px solid " + C.accentBorder, textDecoration: "none",
          }}>Early Access</a>
          <a href="/dashboard" style={{
            padding: "6px 14px", borderRadius: 6, fontSize: 10, fontWeight: 700,
            fontFamily: "var(--fh)", letterSpacing: "0.06em", textTransform: "uppercase",
            background: "rgba(255,255,255,0.03)", color: C.textDim,
            border: "1px solid " + C.border, textDecoration: "none",
          }}>Dashboard</a>
        </nav>

        {/* HERO */}
        <section style={{
          paddingTop: 48, paddingBottom: 40, textAlign: "center",
          opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(16px)",
          transition: "all 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s",
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 6, marginBottom: 22,
            background: "rgba(255,255,255,0.02)", border: "1px solid " + C.border,
          }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.ok }} />
            <span style={{ fontFamily: "var(--fh)", fontSize: 9, letterSpacing: "0.14em", fontWeight: 700, color: C.textDim, textTransform: "uppercase" }}>Now in early access</span>
          </div>

          <h1 style={{
            fontFamily: "var(--fh)", fontWeight: 700, textTransform: "uppercase",
            fontSize: 42, lineHeight: 0.95, letterSpacing: "-0.01em",
            margin: "0 0 18px", color: C.text,
          }}>
            Know what your<br />agents are doing.
          </h1>

          <p style={{ fontSize: 15, color: C.textMid, lineHeight: 1.55, maxWidth: 350, margin: "0 auto 28px", fontWeight: 400 }}>
            Every action. Every tool call. Every policy violation. Chain-verified, human-reviewed, and ready for compliance teams.
          </p>

          <a href="#waitlist" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "13px 28px", borderRadius: 8, textDecoration: "none",
            background: C.accent, color: C.bg,
            fontFamily: "var(--fh)", fontSize: 13, fontWeight: 700,
            letterSpacing: "0.04em", textTransform: "uppercase",
            boxShadow: "0 2px 16px rgba(212,168,83,0.15)",
          }}>
            Get Early Access <IconArrow />
          </a>
        </section>

        {/* DEMO */}
        <section style={{ paddingBottom: 52 }}>
          <Reveal delay={0}>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: "var(--fh)", fontSize: 9, letterSpacing: "0.14em", fontWeight: 700, color: C.textDim, textTransform: "uppercase" }}>Interactive Demo</span>
            </div>
          </Reveal>
          <MiniDashboard />
          <Reveal delay={0.2} y={10}>
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <span style={{ fontSize: 10, color: C.textGhost }}>tap entries to inspect</span>
            </div>
          </Reveal>
        </section>

        {/* PROBLEM */}
        <Reveal>
          <section style={{ paddingBottom: 52 }}>
            <div style={{
              padding: "24px 20px", borderRadius: 14,
              background: C.danger + "06", border: "1px solid " + C.danger + "10",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: 2, height: "100%", background: "linear-gradient(to bottom, " + C.danger + ", transparent)" }} />
              <div style={{ fontFamily: "var(--fh)", fontSize: 9, letterSpacing: "0.14em", fontWeight: 700, color: C.danger, marginBottom: 10, textTransform: "uppercase" }}>The Problem</div>
              <p style={{ fontFamily: "var(--fh)", fontSize: 20, fontWeight: 700, lineHeight: 1.2, color: C.text, margin: "0 0 10px", letterSpacing: "-0.01em" }}>
                Your AI agent just queried customer data, modified a database, and sent an email.
              </p>
              <p style={{ fontFamily: "var(--fh)", fontSize: 20, fontWeight: 700, lineHeight: 1.2, color: C.danger, margin: "0 0 12px", letterSpacing: "-0.01em" }}>
                Can you prove what it did?
              </p>
              <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.55, margin: 0 }}>
                No audit trail means no compliance. No compliance means no permission to deploy. Your agents stay in staging.
              </p>
            </div>
          </section>
        </Reveal>

        {/* FEATURES */}
        <section style={{ paddingBottom: 52 }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <span style={{ fontFamily: "var(--fh)", fontSize: 9, letterSpacing: "0.14em", fontWeight: 700, color: C.textDim, textTransform: "uppercase" }}>How It Works</span>
            </div>
          </Reveal>

          {[
            { icon: <IconChain size={19} color={C.accent} />, title: "Immutable Hash Chain", desc: "Every agent action is logged with a cryptographic hash linking it to the previous entry. Tamper with one record and the chain breaks.", color: C.accent },
            { icon: <IconShield size={19} color={C.warn} />, title: "Policy Engine", desc: "Define rules that flag or block agent behavior. PII access, destructive operations, unauthorized tools — caught before damage is done.", color: C.warn },
            { icon: <IconDoc size={19} color={C.info} />, title: "Compliance Export", desc: "One-click PDF and CSV reports for auditors. Filter by agent, date range, or violation type. Hand it to legal and move on.", color: C.info },
            { icon: <IconEye size={19} color={C.textMid} />, title: "Full Transparency", desc: "Every tool call, every parameter, every response — recorded with timestamps and duration. Nothing hidden.", color: C.textMid },
          ].map((f, i) => (
            <Reveal key={i} delay={i * 0.09} y={20}>
              <div style={{
                padding: "16px 16px", borderRadius: 12, marginBottom: 6,
                background: "rgba(255,255,255,0.01)", border: "1px solid " + C.border,
                display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: f.color + "0a", border: "1px solid " + f.color + "15",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{f.icon}</div>
                <div>
                  <div style={{ fontFamily: "var(--fh)", fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: "0.01em", marginBottom: 4 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.55 }}>{f.desc}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </section>

        {/* ORIGIN */}
        <Reveal>
          <section style={{ paddingBottom: 52 }}>
            <div style={{
              padding: "24px 20px", borderRadius: 14,
              background: "rgba(255,255,255,0.01)", border: "1px solid " + C.border,
            }}>
              <div style={{ fontFamily: "var(--fh)", fontSize: 9, letterSpacing: "0.14em", fontWeight: 700, color: C.textDim, marginBottom: 14, textTransform: "uppercase" }}>Why We Built This</div>
              <p style={{ fontSize: 14, color: C.textMid, lineHeight: 1.65, margin: "0 0 10px", fontStyle: "italic" }}>
                "I built an AI agent that could do real development work — write code, commit to git, query databases, send notifications. It was incredibly powerful.
              </p>
              <p style={{ fontSize: 14, color: C.textMid, lineHeight: 1.65, margin: "0 0 10px", fontStyle: "italic" }}>
                Then I thought about deploying it commercially. The first question was obvious:
              </p>
              <p style={{ fontSize: 14, color: C.text, lineHeight: 1.65, margin: "0 0 18px", fontStyle: "italic", fontWeight: 600 }}>
                How do you prove what it did?"
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: C.accentDim, border: "1px solid " + C.accentBorder,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontFamily: "var(--fh)", fontSize: 16, fontWeight: 700, color: C.accent }}>D</span>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Dan Johnson</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>Founder · DANZUS Holdings</div>
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* INDUSTRIES */}
        <section style={{ paddingBottom: 52 }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <span style={{ fontFamily: "var(--fh)", fontSize: 9, letterSpacing: "0.14em", fontWeight: 700, color: C.textDim, textTransform: "uppercase" }}>Built For Regulated Industries</span>
            </div>
          </Reveal>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
            {["Finance", "Legal", "HR & Staffing", "Insurance", "Accounting", "Healthcare", "Government"].map((ind, i) => (
              <Reveal key={ind} delay={i * 0.05} y={14} style={{ display: "inline-block" }}>
                <span style={{
                  display: "inline-block", padding: "7px 14px", borderRadius: 6,
                  background: "rgba(255,255,255,0.02)", border: "1px solid " + C.border,
                  fontSize: 12, color: C.textMid, fontWeight: 500,
                }}>{ind}</span>
              </Reveal>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section style={{ paddingBottom: 52 }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <span style={{ fontFamily: "var(--fh)", fontSize: 9, letterSpacing: "0.14em", fontWeight: 700, color: C.textDim, textTransform: "uppercase" }}>FAQ</span>
            </div>
          </Reveal>

          {[
            { q: "How is the audit log tamper-proof?", a: "Every action is logged with a SHA-256 hash that chains to the previous entry. The chain is recalculated on every read. If anything was modified or deleted, the chain breaks and the dashboard flags it immediately." },
            { q: "Can I block actions, not just log them?", a: "Yes. The policy engine runs in two modes: Flag only (log and alert but let the action through) or Block (stop the action before it executes and alert your team). You can set different rules per agent and per tool." },
            { q: "What agents does this work with?", a: "Agent Audit Trail uses the Model Context Protocol (MCP), the open standard for agent tooling. Any MCP-compatible agent can connect with minimal configuration. We also support direct SDK integration for custom agents." },
            { q: "Where is the data stored?", a: "Your audit logs live in your own Supabase/PostgreSQL database. You control the infrastructure. We do not hold your data — the platform is the audit trail for your own systems." },
            { q: "Do I need to change my agent's code?", a: "For MCP-compatible agents, almost no changes required. The audit layer sits between your agent and its tools. For custom integrations, we provide a lightweight SDK." },
            { q: "What does the export look like?", a: "One-click PDF or CSV export filtered by agent, date range, or violation type. The PDF is formatted for auditor review with chain-of-custody documentation and a integrity verification summary." },
            { q: "Is this SOC 2 / ISO compliant?", a: "Not yet certified, but the architecture was designed with compliance in mind: immutable hash chain, own-database storage, full action transparency, and exportable chain integrity reports." },
            { q: "What happens if the audit service goes down?", a: "Agent actions continue. The audit service is a sidecar — agents log events asynchronously and queue them if the service is temporarily unavailable. No blocking, no data loss. When the service recovers, the queue drains." },
            { q: "How does an agent connect?", a: "Add the server URL to your agent's MCP config. For OpenClaw, Claude Code, or any MCP-compatible agent, add: {\"agent-audit-trail\": {\"url\": \"https://agent-audit-trail-production.up.railway.app/mcp\"}}. The agent then has access to log_action, query_logs, verify_chain, and all other tools. No code changes needed." },
            { q: "Can I self-host?", a: "Yes. Run with Docker: 'docker run -p 3000:3000 agentaudittr ail/agent-audit-trail' or 'npx @agent-audit-trail/server'. Point it at your own Supabase project for storage. You control the infrastructure end-to-end." },
          ].map((item, i) => {
            const isOpen = openFaq === i;
            return (
              <Reveal key={i} delay={i * 0.04} y={12}>
                <div style={{
                  marginBottom: 4, borderRadius: 10,
                  background: isOpen ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)",
                  border: "1px solid " + (isOpen ? C.accentBorder : C.border),
                  overflow: "hidden",
                }}>
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "13px 16px", background: "none", border: "none", cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontFamily: "var(--fb)", fontSize: 13, fontWeight: 600, color: C.text, paddingRight: 12, lineHeight: 1.4 }}>{item.q}</span>
                    <span style={{
                      fontSize: 16, color: isOpen ? C.accent : C.textDim,
                      transition: "all 0.2s ease", flexShrink: 0,
                      transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                    }}>+</span>
                  </button>
                  {isOpen && (
                    <div style={{
                      padding: "0 16px 14px",
                      fontFamily: "var(--fb)", fontSize: 13, color: C.textMid,
                      lineHeight: 1.6, borderTop: "1px solid " + C.border,
                      paddingTop: 12,
                    }}>
                      {item.a}
                    </div>
                  )}
                </div>
              </Reveal>
            );
          })}
        </section>

        {/* WAITLIST */}
        <Reveal>
          <section id="waitlist" style={{ paddingBottom: 56 }}>
            <div style={{
              padding: "28px 20px", borderRadius: 16,
              background: C.accentDim, border: "1px solid " + C.accentBorder,
              textAlign: "center",
            }}>
              {!submitted ? (
                <>
                  <div style={{ fontFamily: "var(--fh)", fontSize: 9, letterSpacing: "0.14em", fontWeight: 700, color: C.accent, marginBottom: 10, textTransform: "uppercase" }}>Early Access</div>
                  <h2 style={{ fontFamily: "var(--fh)", fontSize: 24, fontWeight: 700, lineHeight: 1.1, margin: "0 0 8px", color: C.text, letterSpacing: "-0.01em" }}>
                    Get audit-ready before your competitors.
                  </h2>
                  <p style={{ fontSize: 13, color: C.textMid, margin: "0 0 20px", lineHeight: 1.5 }}>
                    Join the waitlist for early access and priority onboarding.
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="work@company.com"
                      style={{
                        flex: 1, padding: "12px 12px", borderRadius: 8,
                        border: "1px solid " + C.border,
                        background: "rgba(0,0,0,0.3)", color: C.text, fontSize: 13,
                        outline: "none", fontFamily: "var(--fb)",
                      }}
                    />
                    <button onClick={handleSubmit} disabled={loading} style={{
                      padding: "12px 20px", borderRadius: 8, border: "none", cursor: loading ? "default" : "pointer",
                      background: loading ? C.textDim : C.accent, color: C.bg,
                      fontFamily: "var(--fh)", fontSize: 12, fontWeight: 700,
                      letterSpacing: "0.04em", textTransform: "uppercase",
                      flexShrink: 0, opacity: loading ? 0.7 : 1,
                    }}>{loading ? "..." : "Join"}</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: 44, height: 44, borderRadius: 12, margin: "0 auto 12px", background: C.ok + "12", border: "1px solid " + C.ok + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.ok} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <h3 style={{ fontFamily: "var(--fh)", fontSize: 18, fontWeight: 700,                  color: C.accent, margin: "0 0 6px" }}>You're on the list.</h3>
                  <p style={{ fontSize: 13, color: C.textMid, margin: 0 }}>We'll reach out when your spot opens up.</p>
                </>
              )}
            </div>
          </section>
        </Reveal>

        {/* FOOTER */}
        <footer style={{ paddingBottom: 28, textAlign: "center", borderTop: "1px solid " + C.border, paddingTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 6 }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconLogo size={9} />
            </div>
            <span style={{ fontFamily: "var(--fh)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>Agent Audit Trail</span>
          </div>
          <p style={{ fontSize: 10, color: C.textGhost, margin: 0 }}>© 2026 DANZUS Holdings LLC</p>
        </footer>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        :root { --fh: 'Barlow Condensed', sans-serif; --fb: 'DM Sans', sans-serif; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0c0c0e; -webkit-font-smoothing: antialiased; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 0; }
        input::placeholder { color: #2e2e36; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}} />
    </div>
  );
}
