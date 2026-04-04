'use client'
import { useState, useEffect, useMemo } from 'react'
import { themes, Theme } from '@/lib/themes'
import { useChainIntegrity } from '@/hooks/useChainIntegrity'
import { supabase } from '@/lib/supabase'
import { format } from '@/lib/date-utils'

// ─── AnimNum ─────────────────────────────────────────────────────────────────
function AnimNum({ value, color }: { value: number; color: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const target = value
    const dur = 800
    const t0 = Date.now()
    const tick = () => {
      const p = Math.min((Date.now() - t0) / dur, 1)
      setDisplay(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    tick()
  }, [value])
  return <span style={{ color, fontVariantNumeric: 'tabular-nums' }}>{display}</span>
}

// ─── ThemeToggle ──────────────────────────────────────────────────────────────
function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
      background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      position: 'relative', transition: 'background 0.3s ease',
      display: 'flex', alignItems: 'center', padding: '0 3px',
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

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ t, isDark, onToggle }: { t: Theme; isDark: boolean; onToggle: () => void }) {
  const { status, brokenAt, refetch } = useChainIntegrity()
  const chainColor = status === 'valid' ? t.success : status === 'broken' ? t.critical : status === 'empty' ? t.textMuted : t.accent
  const chainLabel = status === 'valid' ? 'CHAIN OK' : status === 'broken' ? 'BROKEN' : status === 'empty' ? 'NO DATA' : 'VERIFYING'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 18px 14px',
      background: t.surfaceSolid, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderBottom: `1px solid ${t.border}`, position: 'sticky', top: 0, zIndex: 50,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: isDark ? 'linear-gradient(135deg, #00f5d4 0%, #4cc9f0 50%, #7b61ff 100%)' : 'linear-gradient(135deg, #0a9b80 0%, #2563eb 50%, #7c3aed 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isDark ? '0 0 24px rgba(0,245,212,0.25)' : '0 2px 12px rgba(10,155,128,0.2)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#030306' : '#fff'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <div style={{
            fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em',
            background: isDark ? 'linear-gradient(135deg, #f4f4f5 0%, #a1a1aa 100%)' : 'linear-gradient(135deg, #111118 0%, #5a5a6e 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Agent Audit Trail</div>
          <div style={{ fontSize: 9, color: t.textGhost, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500, marginTop: 1 }}>DANZUS HOLDINGS</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={refetch} title={brokenAt ? `Broken: ${brokenAt}` : 'Re-verify chain'} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px',
          borderRadius: 20, background: `${chainColor}15`, border: `1px solid ${chainColor}40`, cursor: 'pointer',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: chainColor,
            boxShadow: `0 0 8px ${chainColor}90`,
            animation: status === 'verifying' ? 'glow-pulse 1s ease-in-out infinite' : undefined,
          }} />
          <span style={{ fontSize: 10, color: chainColor, fontWeight: 600, letterSpacing: '0.04em' }}>{chainLabel}</span>
        </button>
        <ThemeToggle isDark={isDark} onToggle={onToggle} />
      </div>
    </div>
  )
}

// ─── Stats ───────────────────────────────────────────────────────────────────
function Stats({ t, logs }: { t: Theme; logs: any[] }) {
  const v = logs.filter((l) => (l.violations?.length || 0) > 0)
  const stats = {
    total: logs.length,
    violations: v.length,
    criticals: v.filter((l) => l.violations?.some((x: any) => x.severity === 'critical')).length,
    errors: logs.filter((l) => l.status === 'error').length,
    cost: logs.reduce((s: number, l: any) => s + (l.token_cost || 0), 0),
  }
  const items = [
    { label: 'ACTIONS', value: stats.total, color: t.accent },
    { label: 'VIOLATIONS', value: stats.violations, color: t.high },
    { label: 'CRITICAL', value: stats.criticals, color: t.critical },
    { label: 'ERRORS', value: stats.errors, color: t.error },
    { label: 'COST', value: stats.cost, color: t.costColor, isCost: true },
  ]
  return (
    <div style={{ display: 'flex', gap: 6, padding: '6px 18px 14px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {items.map((s, i) => (
        <div key={i} style={{
          minWidth: 100, flexShrink: 0, padding: '12px 14px', borderRadius: 14,
          background: t.surface, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${t.border}`, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, background: `linear-gradient(90deg, transparent, ${s.color}40, transparent)` }} />
          <div style={{ fontSize: 8, color: t.textMuted, letterSpacing: '0.14em', fontWeight: 600, marginBottom: 6 }}>{s.label}</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>
            {s.isCost ? <span style={{ color: s.color }}>${s.value.toFixed(2)}</span> : <AnimNum value={s.value} color={s.color} />}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── AgentFilter ─────────────────────────────────────────────────────────────
function AgentFilter({ t, agents, selected, onSelect }: { t: Theme; agents: any[]; selected: string; onSelect: (id: string) => void }) {
  const allAgents = [{ id: 'all', name: 'All Agents', status: null }, ...agents]
  return (
    <div style={{ display: 'flex', gap: 6, padding: '0 18px 10px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {allAgents.map((a) => {
        const active = selected === a.id
        return (
          <button key={a.id} onClick={() => onSelect(a.id)} style={{
            padding: '7px 14px', borderRadius: 24, border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
            background: active ? t.accentBg : t.surface,
            color: active ? t.accent : t.textMuted,
            boxShadow: active ? `0 0 12px ${t.accent}15, inset 0 0 0 1px ${t.accentBorder}` : `inset 0 0 0 1px ${t.border}`,
            transition: 'all 0.2s ease',
          }}>
            {a.name}
            {a.status && (
              <span style={{
                display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
                background: a.status === 'active' ? t.accent : t.textGhost,
                marginLeft: 7, verticalAlign: 'middle',
                boxShadow: a.status === 'active' ? `0 0 4px ${t.accent}80` : 'none',
              }} />
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Tabs ────────────────────────────────────────────────────────────────────
function Tabs({ t, tab, onTab }: { t: Theme; tab: string; onTab: (t: string) => void }) {
  const tabs = ['timeline', 'agents', 'policies']
  return (
    <div style={{ display: 'flex', margin: '0 18px 14px', borderRadius: 14, overflow: 'hidden', background: t.surface, border: `1px solid ${t.border}` }}>
      {tabs.map((tb) => {
        const active = tab === tb
        return (
          <button key={tb} onClick={() => onTab(tb)} style={{
            flex: 1, padding: '11px 0', border: 'none', cursor: 'pointer',
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
            background: active ? t.accentBg : 'transparent',
            color: active ? t.accent : t.textMuted, position: 'relative', transition: 'all 0.2s ease',
          }}>
            {tb}
            {active && <div style={{ position: 'absolute', bottom: 0, left: '25%', right: '25%', height: 2, background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)`, borderRadius: 1 }} />}
          </button>
        )
      })}
    </div>
  )
}

// ─── TimelineTab ─────────────────────────────────────────────────────────────
function TimelineTab({ t, logs }: { t: Theme; logs: any[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const [reviewModal, setReviewModal] = useState<any>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewStatus, setReviewStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const sCol = (s: string) => ({ critical: t.critical, high: t.high, medium: t.medium }[s] || t.textMuted)
  const stCol = (s: string) => ({ success: t.success, error: t.error, flagged: t.flagged }[s] || t.textMuted)

  const toolBreakdown = useMemo(() => {
    const m: Record<string, number> = {}
    logs.forEach((l) => { m[l.tool_name] = (m[l.tool_name] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [logs])

  const saveReview = async () => {
    if (!reviewModal || !reviewStatus) return
    setSaving(true)
    await supabase.from('review_events').insert({ log_id: reviewModal.id, status: reviewStatus, note: reviewNote })
    setSaving(false)
    setReviewModal(null)
    setReviewNote('')
    setReviewStatus('')
  }

  return (
    <>
      {logs.map((log, i) => {
        const hasV = (log.violations?.length || 0) > 0
        const isErr = log.status === 'error'
        const isOpen = open === log.id
        const accent = hasV ? sCol(log.violations[0].severity) : isErr ? t.error : t.accent
        const violMsg = log.violations?.[0]?.message || log.violations?.[0]?.msg || ''

        return (
          <div key={log.id} onClick={() => setOpen(isOpen ? null : log.id)} style={{ display: 'flex', gap: 12, cursor: 'pointer', animation: `fadeSlide 0.4s ease ${i * 0.04}s both` }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 18, paddingTop: 3 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: accent, boxShadow: `0 0 8px ${accent}50, 0 0 16px ${accent}20` }} />
              {i < logs.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 24, background: `linear-gradient(to bottom, ${accent}30, transparent)`, marginTop: 4 }} />}
            </div>
            <div style={{
              flex: 1, marginBottom: 10, padding: '12px 14px', borderRadius: 14, position: 'relative', overflow: 'hidden',
              background: isOpen ? t.surfaceHover : t.cardBg, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              border: `1px solid ${isOpen ? `${accent}25` : t.border}`,
              boxShadow: isOpen ? `0 4px 24px ${accent}08` : 'none', transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              {(hasV || isErr) && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity: 0.5 }} />}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>{log.tool_name}</span>
                  <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 500 }}>.{log.action}</span>
                </div>
                <span style={{ fontSize: 8, padding: '3px 8px', borderRadius: 6, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: stCol(log.status), background: `${stCol(log.status)}12`, border: `1px solid ${stCol(log.status)}20` }}>{log.status}</span>
              </div>
              <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 5, lineHeight: 1.45 }}>{log.summary || log.agent_name}</div>
              {hasV && (
                <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: `${sCol(log.violations[0].severity)}08`, border: `1px solid ${sCol(log.violations[0].severity)}18`, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill={sCol(log.violations[0].severity)} style={{ marginTop: 1, flexShrink: 0 }}><path d="M12 2L2 20h20L12 2zm0 6v6m0 2v2" /></svg>
                  <span style={{ fontSize: 11, color: sCol(log.violations[0].severity), fontWeight: 600, lineHeight: 1.4 }}>{violMsg}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 10, color: t.textGhost, fontWeight: 500 }}>
                <span style={{ color: t.textMuted }}>{log.agent_name}</span>
                <span>·</span>
                <span>{log.timestamp ? format(new Date(log.timestamp)) : '—'}</span>
                <span>·</span>
                <span>{log.duration_ms ? `${log.duration_ms}ms` : '—'}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.02em' }}>⛓ {String(log.hash || '').slice(0, 8)}</span>
              </div>
              {isOpen && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}`, animation: 'fadeSlide 0.3s ease' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'ENTRY', val: log.id, mono: true },
                      { label: 'COST', val: log.token_cost != null ? `$${log.token_cost.toFixed(4)}` : '—', color: t.costColor },
                      { label: 'HASH', val: String(log.hash || '—'), mono: true, color: t.accent },
                      { label: 'PREV HASH', val: String(log.previous_hash || '—'), mono: true, color: t.textMuted },
                    ].map((f, fi) => (
                      <div key={fi}>
                        <div style={{ fontSize: 8, color: t.textGhost, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 3 }}>{f.label}</div>
                        <div style={{ fontSize: 10, color: f.color || t.textSecondary, fontFamily: f.mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{f.val}</div>
                      </div>
                    ))}
                  </div>
                  {log.parameters && Object.keys(log.parameters).length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 8, color: t.textGhost, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 4 }}>PARAMETERS</div>
                      <pre style={{ margin: 0, padding: 10, borderRadius: 8, background: t.codeBg, border: `1px solid ${t.codeBorder}`, fontSize: 10, color: t.textSecondary, fontFamily: 'monospace', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 }}>{JSON.stringify(log.parameters, null, 2)}</pre>
                    </div>
                  )}
                  {hasV && (
                    <button onClick={(e) => { e.stopPropagation(); setReviewModal(log) }} style={{ marginTop: 10, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: t.accentBg, color: t.accent, fontSize: 10, fontWeight: 600, boxShadow: `0 0 8px ${t.accent}15` }}>
                      Review Violation
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {toolBreakdown.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          maxWidth: 440, width: 'calc(100% - 36px)', padding: '10px 14px', borderRadius: 16,
          background: t.floatBg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${t.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
          <span style={{ fontSize: 8, color: t.textGhost, fontWeight: 700, letterSpacing: '0.1em', whiteSpace: 'nowrap', marginRight: 4 }}>TOOLS</span>
          {toolBreakdown.map(([tool, count]) => (
            <div key={tool} style={{ padding: '4px 10px', borderRadius: 8, flexShrink: 0, background: t.surface, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>{tool}</span>
              <span style={{ fontSize: 10, color: t.accent, fontWeight: 800 }}>{count}</span>
            </div>
          ))}
        </div>
      )}

      {reviewModal && (
        <div onClick={() => setReviewModal(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, borderRadius: 20, padding: 24, background: t.bg, border: `1px solid ${t.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>Review Violation</div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 16 }}>{reviewModal.tool_name}.{reviewModal.action}</div>
            {reviewModal.violations?.map((v: any, i: number) => (
              <div key={i} style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 12, background: `${sCol(v.severity)}08`, border: `1px solid ${sCol(v.severity)}18` }}>
                <span style={{ fontSize: 10, color: sCol(v.severity), fontWeight: 700 }}>{v.severity?.toUpperCase()}</span>
                <span style={{ fontSize: 11, color: t.textSecondary, marginLeft: 8 }}>{v.message || v.msg}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['reviewed', 'escalated', 'false_positive'].map((s) => (
                <button key={s} onClick={() => setReviewStatus(s)} style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600, textTransform: 'capitalize',
                  background: reviewStatus === s ? t.accentBg : t.surface, color: reviewStatus === s ? t.accent : t.textMuted,
                  boxShadow: reviewStatus === s ? `0 0 8px ${t.accent}15` : 'none',
                }}>{s.replace('_', ' ')}</button>
              ))}
            </div>
            <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Add a note (optional)..." rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.codeBg, color: t.text, fontSize: 12, fontFamily: 'inherit', resize: 'none', outline: 'none', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setReviewModal(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface, color: t.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveReview} disabled={!reviewStatus || saving} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: t.accent, color: '#030306', fontSize: 12, fontWeight: 700, opacity: !reviewStatus || saving ? 0.5 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── AgentsTab ───────────────────────────────────────────────────────────────
function AgentsTab({ t, logs }: { t: Theme; logs: any[] }) {
  const agents = useMemo(() => {
    const m: Record<string, any> = {}
    logs.forEach((l) => {
      if (!m[l.agent_name]) m[l.agent_name] = { id: l.agent_id || l.agent_name, name: l.agent_name, actions: 0, violations: 0, last: null }
      m[l.agent_name].actions++
      if ((l.violations?.length || 0) > 0) m[l.agent_name].violations++
      if (!m[l.agent_name].last || l.timestamp > m[l.agent_name].last) m[l.agent_name].last = l.timestamp
    })
    return Object.values(m)
  }, [logs])
  const ago = (iso: string | null) => {
    if (!iso) return '—'
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`
  }
  return (
    <div style={{ paddingBottom: 60 }}>
      {agents.map((a, i) => (
        <div key={a.id} style={{ marginBottom: 10, padding: 16, borderRadius: 16, background: t.surface, backdropFilter: 'blur(8px)', border: `1px solid ${t.border}`, animation: `fadeSlide 0.4s ease ${i * 0.08}s both`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>{a.name}</div>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: t.textGhost, marginTop: 1 }}>{a.id}</div>
              </div>
            </div>
            <div style={{ padding: '4px 10px', borderRadius: 20, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: t.accentBg, color: t.accent, border: `1px solid ${t.accentBorder}` }}>active</div>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {[
              { label: 'ACTIONS', val: a.actions, color: t.accent },
              { label: 'VIOLATIONS', val: a.violations, color: a.violations > 0 ? t.high : t.textGhost },
              { label: 'LAST SEEN', val: ago(a.last), isText: true },
            ].map((s, si) => (
              <div key={si} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: t.textGhost, letterSpacing: '0.14em', fontWeight: 700, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: s.isText ? 13 : 20, fontWeight: 800, color: s.isText ? t.textSecondary : s.color, letterSpacing: '-0.02em' }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── PoliciesTab ─────────────────────────────────────────────────────────────
function PoliciesTab({ t }: { t: Theme }) {
  const [policies, setPolicies] = useState<any[]>([])
  const [editing, setEditing] = useState<any>(null)
  const [showEditor, setShowEditor] = useState(false)
  const sCol = (s: string) => ({ critical: t.critical, high: t.high, medium: t.medium, low: t.textMuted }[s] || t.textMuted)

  useEffect(() => { supabase.from('policy_rules').select('*').then(({ data }) => setPolicies(data || [])) }, [])

  return (
    <div style={{ paddingBottom: 60 }}>
      {policies.map((p, i) => (
        <div key={p.id} style={{ marginBottom: 10, padding: 16, borderRadius: 16, background: t.surface, backdropFilter: 'blur(8px)', border: `1px solid ${t.border}`, animation: `fadeSlide 0.4s ease ${i * 0.08}s both`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: `linear-gradient(to bottom, ${sCol(p.severity)}, transparent)`, borderRadius: '3px 0 0 3px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>{p.name}</div>
            <div style={{ padding: '3px 10px', borderRadius: 6, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: `${sCol(p.severity)}12`, color: sCol(p.severity), border: `1px solid ${sCol(p.severity)}20` }}>{p.severity}</div>
          </div>
          <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.45, marginBottom: 10, paddingLeft: 8 }}>{p.description}</div>
          {p.rule && <div style={{ padding: '8px 10px', borderRadius: 8, background: t.codeBg, border: `1px solid ${t.codeBorder}`, fontFamily: 'monospace', fontSize: 10, color: t.textMuted, wordBreak: 'break-all', lineHeight: 1.5, marginBottom: 10, marginLeft: 8 }}>{p.rule}</div>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8 }}>
            <span style={{ fontSize: 10, color: t.textGhost }}><strong style={{ color: (p.trigger_count || 0) > 0 ? sCol(p.severity) : t.textGhost }}>{p.trigger_count || 0}</strong> triggers</span>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.accent, boxShadow: `0 0 6px ${t.accent}60` }} />
          </div>
        </div>
      ))}
      <button onClick={() => setShowEditor(true)} style={{
        width: '100%', marginTop: 4, padding: '10px', borderRadius: 12, border: `1px solid ${t.border}`,
        background: t.accentBg, color: t.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        boxShadow: `0 0 8px ${t.accent}10`,
      }}>+ Add Policy</button>
    </div>
  )
}

// ─── Grain overlay ───────────────────────────────────────────────────────────
function Grain({ t, isDark }: { t: Theme; isDark: boolean }) {
  if (!isDark) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, opacity: t.grain, pointerEvents: 'none', mixBlendMode: 'overlay',
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    }} />
  )
}

// ─── Glow orbs ───────────────────────────────────────────────────────────────
function GlowOrbs({ t, isDark }: { t: Theme; isDark: boolean }) {
  if (!isDark) return null
  return (
    <>
      <div style={{ position: 'fixed', top: -120, left: -80, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,245,212,0.07) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(40px)', opacity: t.glowOpacity }} />
      <div style={{ position: 'fixed', top: 200, right: -100, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(76,201,240,0.05) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(50px)', opacity: t.glowOpacity }} />
      <div style={{ position: 'fixed', bottom: 100, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,59,92,0.04) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(40px)', opacity: t.glowOpacity }} />
    </>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [mode, setMode] = useState<'dark' | 'light'>('dark')
  const [tab, setTab] = useState('timeline')
  const [agent, setAgent] = useState('all')
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setTimeout(() => setMounted(true), 50) }, [])

  const t = themes[mode]
  const isDark = mode === 'dark'

  const [logs, setLogs] = useState<any[]>([])
  useEffect(() => {
    supabase
      .from('audit_logs')
      .select('*')
      .order('entry_id', { ascending: false })
      .limit(50)
      .then(({ data }) => setLogs(data || []))
  }, [])

  const filtered = useMemo(() => agent === 'all' ? logs : logs.filter((l) => l.agent_id === agent || l.agent_name === agent), [logs, agent])

  const agents = useMemo(() => {
    const m: Record<string, any> = {}
    logs.forEach((l) => {
      if (!m[l.agent_name]) m[l.agent_name] = { id: l.agent_id || l.agent_name, name: l.agent_name, status: 'active' }
    })
    return Object.values(m)
  }, [logs])

  return (
    <div style={{
      background: t.bg, minHeight: '100vh', color: t.text,
      fontFamily: "'Geist', 'SF Pro Display', system-ui, sans-serif",
      maxWidth: 480, margin: '0 auto', position: 'relative', overflow: 'hidden',
      transition: 'background 0.4s ease, color 0.4s ease',
    }}>
      <GlowOrbs t={t} isDark={isDark} />
      <Grain t={t} isDark={isDark} />

      <div style={{
        position: 'relative', zIndex: 1,
        opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(8px)',
        transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <Header t={t} isDark={isDark} onToggle={() => setMode(isDark ? 'light' : 'dark')} />
        <Stats t={t} logs={filtered} />
        <AgentFilter t={t} agents={agents} selected={agent} onSelect={setAgent} />
        <Tabs t={t} tab={tab} onTab={setTab} />

        <div style={{ padding: '0 18px 50px' }}>
          {tab === 'timeline' && <TimelineTab t={t} logs={filtered} />}
          {tab === 'agents' && <AgentsTab t={t} logs={logs} />}
          {tab === 'policies' && <PoliciesTab t={t} />}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        @keyframes glow-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
