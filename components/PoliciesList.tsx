'use client'
import { Theme } from '@/lib/theme'
import type { PolicyRule } from '@/lib/types'

interface Props {
  theme: Theme
  policies: PolicyRule[]
  onToggle: (id: string, enabled: boolean) => void
  onSetEnforcement: (id: string, mode: 'flag' | 'block') => void
  onEdit: (policy: PolicyRule) => void
}

export default function PoliciesList({ theme: t, policies, onToggle, onSetEnforcement, onEdit }: Props) {
  const severityColor = (sev: string) =>
    sev === 'critical' ? t.critical : sev === 'high' ? t.high : sev === 'medium' ? t.medium : t.textMuted

  if (policies.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: t.textMuted }}>No policies configured</div>
      </div>
    )
  }

  return (
    <div style={{ padding: 12 }}>
      {policies.map(policy => (
        <div key={policy.id} style={{
          padding: 14, borderRadius: 12, marginBottom: 8,
          background: t.cardBg, border: `1px solid ${t.border}`,
          backdropFilter: 'blur(10px)',
          opacity: policy.enabled ? 1 : 0.5,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{policy.name}</span>
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4,
                  background: `${severityColor(policy.severity)}15`,
                  color: severityColor(policy.severity),
                }}>{policy.severity.toUpperCase()}</span>
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4,
                  background: policy.enforcement_mode === 'block' ? `${t.critical}15` : `${t.flagged}15`,
                  color: policy.enforcement_mode === 'block' ? t.critical : t.flagged,
                }}>{policy.enforcement_mode.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 3 }}>{policy.description}</div>
              <div style={{ fontSize: 9, color: t.textGhost, marginTop: 3, fontFamily: 'monospace' }}>
                {policy.condition_type}: {policy.condition_value}
              </div>
            </div>
            <button
              onClick={() => onEdit(policy)}
              style={{
                padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                background: t.surface, border: `1px solid ${t.border}`, color: t.textSecondary,
              }}
            >Edit</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => onToggle(policy.id, !policy.enabled)}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                background: policy.enabled ? `${t.success}15` : t.surface,
                border: `1px solid ${policy.enabled ? `${t.success}30` : t.border}`,
                color: policy.enabled ? t.success : t.textMuted,
              }}
            >{policy.enabled ? 'Enabled' : 'Disabled'}</button>
            <button
              onClick={() => onSetEnforcement(policy.id, policy.enforcement_mode === 'flag' ? 'block' : 'flag')}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                background: policy.enforcement_mode === 'flag' ? `${t.flagged}15` : `${t.critical}15`,
                border: `1px solid ${policy.enforcement_mode === 'flag' ? `${t.flagged}30` : `${t.critical}30`}`,
                color: policy.enforcement_mode === 'flag' ? t.flagged : t.critical,
              }}
            >
              Mode: {policy.enforcement_mode === 'flag' ? 'Flag' : 'Block'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
