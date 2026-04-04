'use client'
import { Theme } from '@/lib/theme'

type Tab = 'timeline' | 'agents' | 'policies'

interface Props {
  theme: Theme
  active: Tab
  onChange: (tab: Tab) => void
}

export default function TabNav({ theme: t, active, onChange }: Props) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'agents', label: 'Agents' },
    { id: 'policies', label: 'Policies' },
  ]

  return (
    <div style={{
      display: 'flex', gap: 4, padding: '8px 16px',
      borderBottom: `1px solid ${t.border}`,
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: active === tab.id ? t.surface : 'transparent',
            border: `1px solid ${active === tab.id ? t.border : 'transparent'}`,
            color: active === tab.id ? t.text : t.textMuted,
            cursor: 'pointer', transition: 'all 0.2s',
            fontFamily: 'Geist, sans-serif',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
