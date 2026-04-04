'use client'
import { useState, useEffect } from 'react'
import { themes } from '@/lib/theme'
import { format } from '@/lib/date-utils'

// ─── ThemeToggle ──────────────────────────────────────────────────────────────
function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
      background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      position: 'relative', display: 'flex', alignItems: 'center', padding: '0 3px',
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: isDark ? '#f4f4f5' : '#111118',
        transform: isDark ? 'translateX(0)' : 'translateX(18px)',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: isDark ? '0 0 8px rgba(255,255,255,0.2)' : '0 1px 4px rgba(0,0,0,0.15)',
      }}>
        <span style={{ fontSize: 10, lineHeight: 1 }}>{isDark ? '🌙' : '☀️'}</span>
      </div>
    </button>
  )
}

// ─── DashboardDemo ─────────────────────────────────────────────────────────────
function DashboardDemo({ t, isDark }: { t: any; isDark: boolean }) {
  const [logs, setLogs] = useState<any[]>([])
  const [tab, setTab] = useState('timeline')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/mock-logs')
      .then(r => r.json())
      .then(d => setLogs(d.logs || []))
      .catch(() => {
        // Fallback sample data
        setLogs([
          { id: 'e-001', tool_name: 'bash', action: 'execute', agent_name: 'Ed', status: 'success', summary: 'git commit -m \'feat: audit endpoint\'', timestamp: new Date(Date.now() - 120000).toISOString(), duration_ms: 320, token_cost: 0.002, hash: 'a1b2c3d4e5', previous_hash: 'z9y8x7w6v5', violations: [] },
          { id: 'e-002', tool_name: 'supabase', action: 'query', agent_name: 'Ed', status: 'flagged', summary: 'Queried user contact data', timestamp: new Date(Date.now() - 300000).toISOString(), duration_ms: 128, token_cost: 0.003, hash: 'z9y8x7w6v5', previous_hash: 'm4n5o6p7q8', violations: [{ severity: 'high', msg: 'PII fields accessed: email, phone' }] },
          { id: 'e-003', tool_name: 'database', action: 'delete', agent_name: 'Ed', status: 'flagged', summary: 'Destructive op blocked by policy', timestamp: new Date(Date.now() - 720000).toISOString(), duration_ms: 0, token_cost: 0.001, hash: 'g7h8i9j0k1', previous_hash: 'd4e5f6g7h8', violations: [{ severity: 'critical', msg: 'Destructive DB operation: DELETE' }] },
          { id: 'e-004', tool_name: 'web_fetch', action: 'scrape', agent_name: 'SEO', status: 'success', summary: 'Fetched page for analysis', timestamp: new Date(Date.now() - 900000).toISOString(), duration_ms: 1840, token_cost: 0.012, hash: 'j1k2l3m4n5', previous_hash: 'g7h8i9j0k1', violations: [] },
          { id: 'e-005', tool_name: 'telegram', action: 'send', agent_name: 'Ed', status: 'success', summary: 'Sent notification to Dan', timestamp: new Date(Date.now() - 1200000).toISOString(), duration_ms: 380, token_cost: 0.001, hash: 'x7w6v5u4t3', previous_hash: 'u4t3s2r1q0', violations: [] },
        ])
      })
  }, [])

  const stats = {
    total: logs.length,
    violations: logs.filter(l => l.violations?.length > 0).length,
    errors: logs.filter(l => l.status === 'error').length,
    cost: logs.reduce((s, l) => s + (l.token_cost || 0), 0),
  }

  const sCol = (s: string) => ({ critical: t.critical, high: t.high, medium: t.medium }[s] || t.textMuted)
  const stCol = (s: string) => ({ success: t.success, error: t.error, flagged: t.flagged }[s] || t.textMuted)

  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.surfaceSolid || t.surface }}>
      {/* Mini header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${t.border}`, background: t.surfaceSolid || t.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: t.accent, boxShadow: `0 0 8px ${t.accent}` }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>Agent Audit</span>
          <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: t.accentBg, border: `1px solid ${t.accentBorder}`, color: t.accent, fontWeight: 600, letterSpacing: '0.05em' }}>LIVE</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['timeline', 'agents', 'policies'].map(tb => (
            <button key={tb} onClick={() => setTab(tb)} style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              background: tab === tb ? t.accentBg : 'transparent',
              color: tab === tb ? t.accent : t.textMuted,
            }}>{tb}</button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 1, padding: '10px 16px', borderBottom: `1px solid ${t.border}`, overflowX: 'auto' }}>
        {[
          { label: 'ACTIONS', value: stats.total, color: t.accent },
          { label: 'VIOLATIONS', value: stats.violations, color: t.high },
          { label: 'ERRORS', value: stats.errors, color: t.error },
          { label: 'COST', value: `$${stats.cost.toFixed(2)}`, color: t.costColor, isText: true },
        ].map((s, i) => (
          <div key={i} style={{ minWidth: 72, padding: '8px 12px', borderRadius: 8, background: t.surface, border: `1px solid ${t.border}`, marginRight: 6 }}>
            <div style={{ fontSize: 7, color: t.textMuted, letterSpacing: '0.12em', fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color || s.isText ? t.text : s.color, letterSpacing: '-0.02em' }}>{s.isText ? s.value : s.value}</div>
          </div>
        ))}
      </div>

      {/* Timeline (simplified) */}
      {tab === 'timeline' && (
        <div style={{ maxHeight: 340, overflowY: 'auto', padding: '12px 16px' }}>
          {logs.slice(0, 5).map((log, i) => {
            const hasV = (log.violations?.length || 0) > 0
            const isErr = log.status === 'error'
            const isOpen = open === log.id
            const accent = hasV ? sCol(log.violations[0]?.severity) : isErr ? t.error : t.accent
            return (
              <div key={log.id} onClick={() => setOpen(isOpen ? null : log.id)} style={{ display: 'flex', gap: 10, cursor: 'pointer', marginBottom: 8, animation: `fadeSlide 0.3s ease ${i * 0.06}s both` }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 14, paddingTop: 2 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, boxShadow: `0 0 6px ${accent}60` }} />
                  {i < Math.min(logs.length, 5) - 1 && <div style={{ width: 1, flex: 1, minHeight: 16, background: `${accent}25`, marginTop: 3 }} />}
                </div>
                <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: isOpen ? t.surfaceHover : t.cardBg, border: `1px solid ${isOpen ? `${accent}20` : t.border}`, transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{log.tool_name}<span style={{ fontSize: 11, color: t.textMuted }}>.{log.action}</span></span>
                    <span style={{ fontSize: 7, padding: '2px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: stCol(log.status), background: `${stCol(log.status)}12` }}>{log.status}</span>
                  </div>
                  <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 3 }}>{log.summary}</div>
                  {hasV && (
                    <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 6, background: `${sCol(log.violations[0].severity)}08`, border: `1px solid ${sCol(log.violations[0].severity)}15` }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: sCol(log.violations[0].severity) }}>{log.violations[0].severity?.toUpperCase()}: </span>
                      <span style={{ fontSize: 9, color: t.textSecondary }}>{log.violations[0].msg}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, fontSize: 9, color: t.textGhost }}>
                    <span>{log.agent_name}</span><span>·</span><span>{format(new Date(log.timestamp))}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'monospace' }}>⛓ {String(log.hash || '').slice(0, 6)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'agents' && (
        <div style={{ padding: '16px', maxHeight: 340, overflowY: 'auto' }}>
          {[{ name: 'Ed', id: 'ed-openclaw', actions: 3, violations: 2, last: '2m ago' }, { name: 'SEO Agent', id: 'seo-crawler', actions: 1, violations: 0, last: '15m ago' }].map((a, i) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: t.surface, border: `1px solid ${t.border}`, marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: t.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🤖</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{a.name}</div>
                  <div style={{ fontSize: 9, color: t.textGhost, fontFamily: 'monospace' }}>{a.id}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: t.accent }}>{a.actions}</div>
                <div style={{ fontSize: 9, color: t.textGhost }}>actions</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'policies' && (
        <div style={{ padding: '16px', maxHeight: 340, overflowY: 'auto' }}>
          {[
            { name: 'PII Access Guard', severity: 'high', rule: 'data_field ∈ {ssn, email, phone, dob}', triggers: 1 },
            { name: 'Destructive Op Shield', severity: 'critical', rule: 'tool_action ∈ {delete, drop, truncate}', triggers: 1 },
            { name: 'Cost Anomaly', severity: 'medium', rule: 'token_cost > $0.50 per action', triggers: 0 },
          ].map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: t.surface, border: `1px solid ${t.border}`, marginBottom: 6, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: sCol(p.severity) }} />
              <div style={{ flex: 1, paddingLeft: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{p.name}</div>
                <div style={{ fontSize: 9, color: t.textMuted, fontFamily: 'monospace', marginTop: 2 }}>{p.rule}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: p.triggers > 0 ? sCol(p.severity) : t.textMuted }}>{p.triggers}</div>
                <div style={{ fontSize: 8, color: t.textGhost }}>triggers</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Landing Page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [mode, setMode] = useState<'dark' | 'light'>('dark')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [count, setCount] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)

  const t = themes[mode]
  const isDark = mode === 'dark'

  useEffect(() => {
    setMounted(true)
    fetch('/api/waitlist')
      .then(r => r.json())
      .then(d => setCount(d.count))
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) { setError('Enter a valid email'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const data = await res.json()
      if (data.success) {
        setSubmitted(true)
        setCount(c => (c ?? 0) + 1)
      } else {
        setError(data.error || 'Something went wrong')
      }
    } catch {
      setError('Network error — try again')
    }
    setLoading(false)
  }

  return (
    <div style={{
      background: t.bg, minHeight: '100vh', color: t.text,
      fontFamily: "'Geist', 'SF Pro Display', system-ui, sans-serif",
      transition: 'background 0.4s ease, color 0.4s ease',
    }}>
      {/* Ambient glows */}
      {isDark && <>
        <div style={{ position: 'fixed', top: -100, left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,245,212,0.06) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(60px)' }} />
        <div style={{ position: 'fixed', bottom: 0, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,97,255,0.05) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(60px)' }} />
      </>}

      <div style={{ position: 'relative', zIndex: 1, opacity: mounted ? 1 : 0, transition: 'opacity 0.6s ease' }}>

        {/* ── HERO ── */}
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px 40px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: t.accentBg, border: `1px solid ${t.accentBorder}`, marginBottom: 24 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, boxShadow: `0 0 8px ${t.accent}` }} />
            <span style={{ fontSize: 11, color: t.accent, fontWeight: 600 }}>Now in private beta</span>
          </div>

          <h1 style={{
            fontSize: 'clamp(32px, 8vw, 52px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.04em',
            background: isDark ? 'linear-gradient(135deg, #f4f4f5 0%, #00f5d4 100%)' : 'linear-gradient(135deg, #111118 0%, #0a9b80 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 20,
          }}>
            Know what your<br />agents are doing.
          </h1>

          <p style={{
            fontSize: 18, lineHeight: 1.6, color: t.textSecondary,
            maxWidth: 480, margin: '0 auto 32px',
          }}>
            Every action. Every tool call. Every policy violation. Chain-verified, human-reviewed, and ready for compliance teams.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#demo" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', borderRadius: 12, background: t.accent, color: '#030306',
              fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: `0 0 24px ${t.accent}30`,
            }}>
              See it in action
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
            <a href="/dashboard" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', borderRadius: 12, background: t.surface, color: t.text,
              fontSize: 14, fontWeight: 600, textDecoration: 'none', border: `1px solid ${t.border}`,
            }}>
              Open dashboard
            </a>
          </div>
        </div>

        {/* ── DASHBOARD DEMO ── */}
        <div id="demo" style={{ maxWidth: 520, margin: '0 auto', padding: '0 18px 56px' }}>
          <DashboardDemo t={t} isDark={isDark} />
        </div>

        {/* ── WANT THIS? ── */}
        <div style={{ textAlign: 'center', padding: '0 24px 40px' }}>
          <h2 style={{
            fontSize: 'clamp(22px, 5vw, 30px)', fontWeight: 800, letterSpacing: '-0.03em',
            color: t.text, marginBottom: 12,
          }}>
            Want this for your agents?
          </h2>
          <p style={{ fontSize: 16, color: t.textSecondary, marginBottom: 32 }}>
            Join the waitlist. Early access for teams running AI agents in production.
          </p>

          {/* Waitlist form */}
          {!submitted ? (
            <form onSubmit={handleSubmit} style={{ maxWidth: 420, margin: '0 auto' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  style={{
                    flex: '1 1 200px', padding: '12px 16px', borderRadius: 12,
                    border: `1px solid ${error ? t.critical : t.border}`,
                    background: t.surface, color: t.text, fontSize: 15, fontFamily: 'inherit',
                    outline: 'none', minWidth: 0,
                  }}
                />
                <button type="submit" disabled={loading} style={{
                  padding: '12px 24px', borderRadius: 12, border: 'none',
                  background: t.accent, color: '#030306', fontSize: 14, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                }}>
                  {loading ? 'Joining...' : 'Join waitlist'}
                </button>
              </div>
              {error && (
                <p style={{ fontSize: 12, color: t.critical, marginTop: 8 }}>{error}</p>
              )}
              {count !== null && (
                <p style={{ fontSize: 12, color: t.textGhost, marginTop: 10 }}>
                  {count} {count === 1 ? 'person' : 'people'} already on the list
                </p>
              )}
            </form>
          ) : (
            <div style={{ padding: '20px 24px', borderRadius: 16, background: t.accentBg, border: `1px solid ${t.accentBorder}`, maxWidth: 420, margin: '0 auto' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.accent, marginBottom: 4 }}>You are on the list.</div>
              <div style={{ fontSize: 13, color: t.textSecondary }}>We will be in touch when early access opens.</div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div style={{ borderTop: `1px solid ${t.border}`, padding: '24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: isDark ? 'linear-gradient(135deg, #00f5d4, #7b61ff)' : 'linear-gradient(135deg, #0a9b80, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#030306' : '#fff'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>Agent Audit Trail</span>
          </div>
          <p style={{ fontSize: 11, color: t.textGhost }}>Built by DANZUS HOLDINGS</p>
        </div>

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  )
}
