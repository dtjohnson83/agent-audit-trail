'use client'
import { Theme } from '@/lib/theme'
import type { Agent } from '@/lib/types'

interface Props {
  theme: Theme
  agents: Agent[]
}

export default function AgentsList({ theme: t, agents }: Props) {
  if (agents.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: t.textMuted }}>No agents registered</div>
      </div>
    )
  }

  return (
    <div style={{ padding: 12 }}>
      {agents.map(agent => (
        <div key={agent.agent_id} style={{
          padding: 14, borderRadius: 12, marginBottom: 8,
          background: t.cardBg, border: `1px solid ${t.border}`,
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{agent.name}</div>
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>{agent.description || 'No description'}</div>
            </div>
            <div style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 600,
              background: agent.status === 'active' ? `${t.success}15` : t.surface,
              color: agent.status === 'active' ? t.success : t.textMuted,
              border: `1px solid ${agent.status === 'active' ? `${t.success}30` : t.border}`,
            }}>
              {agent.status.toUpperCase()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{agent.total_actions}</div>
              <div style={{ fontSize: 9, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Actions</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                {agent.last_active ? new Date(agent.last_active).toLocaleDateString() : 'Never'}
              </div>
              <div style={{ fontSize: 9, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Last Active</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
