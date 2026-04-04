'use client'
import { Theme } from '@/lib/theme'
import type { Agent } from '@/lib/types'

interface Props {
  theme: Theme
  selected: string
  onChange: (id: string) => void
  agents: Agent[]
}

export default function AgentFilter({ theme: t, selected, onChange, agents }: Props) {
  return (
    <div style={{
      display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 16px',
      borderBottom: `1px solid ${t.border}`, scrollbarWidth: 'none',
    }}>
      <button
        onClick={() => onChange('all')}
        style={{
          flexShrink: 0, padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500,
          background: selected === 'all' ? t.accentBg : 'transparent',
          border: `1px solid ${selected === 'all' ? t.accentBorder : t.border}`,
          color: selected === 'all' ? t.accent : t.textSecondary, cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >All agents</button>
      {agents.map(a => (
        <button
          key={a.agent_id}
          onClick={() => onChange(a.agent_id)}
          style={{
            flexShrink: 0, padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500,
            background: selected === a.agent_id ? t.accentBg : 'transparent',
            border: `1px solid ${selected === a.agent_id ? t.accentBorder : t.border}`,
            color: selected === a.agent_id ? t.accent : t.textSecondary, cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >{a.name}</button>
      ))}
    </div>
  )
}
