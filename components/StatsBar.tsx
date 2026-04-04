'use client'
import { Theme } from '@/lib/theme'
import type { AuditLog, PolicyRule } from '@/lib/types'

interface Props {
  theme: Theme
  logs: AuditLog[]
  policies: PolicyRule[]
}

export default function StatsBar({ theme: t, logs, policies }: Props) {
  const total = logs.length
  const flagged = logs.filter(l => l.response_status === 'flagged' || l.response_status === 'blocked').length
  const violations = logs.reduce((sum, l) => sum + (l.policy_violations?.length || 0), 0)
  const blocked = logs.filter(l => l.response_status === 'blocked').length
  const agents = [...new Set(logs.map(l => l.agent_id))].length
  const reviewed = logs.filter(l => l.review_status === 'reviewed').length
  const pending = logs.filter(l => l.review_status === 'new' && (l.response_status === 'flagged' || l.response_status === 'blocked')).length

  const stats = [
    { label: 'Total Actions', value: total, color: t.text },
    { label: 'Flagged', value: flagged, color: t.flagged },
    { label: 'Violations', value: violations, color: t.high },
    { label: 'Blocked', value: blocked, color: t.critical },
    { label: 'Active Agents', value: agents, color: t.accent },
    { label: 'Pending Review', value: pending, color: t.medium },
    { label: 'Reviewed', value: reviewed, color: t.success },
    { label: 'Policies', value: policies.length, color: t.text },
  ]

  return (
    <div style={{
      display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 16px',
      borderBottom: `1px solid ${t.border}`, scrollbarWidth: 'none',
    }}>
      {stats.map(s => (
        <div key={s.label} style={{
          flexShrink: 0, padding: '10px 14px', borderRadius: 10,
          background: t.cardBg, border: `1px solid ${t.border}`,
          backdropFilter: 'blur(10px)', minWidth: 80, textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontSize: 9, color: t.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}
