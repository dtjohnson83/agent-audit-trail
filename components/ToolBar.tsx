'use client'
import { Theme } from '@/lib/theme'
import type { AuditLog } from '@/lib/types'

interface Props {
  theme: Theme
  logs: AuditLog[]
}

export default function ToolBar({ theme: t, logs }: Props) {
  const toolCounts: Record<string, number> = {}
  logs.slice(0, 50).forEach(l => {
    const key = `${l.tool_name}.${l.tool_action}`
    toolCounts[key] = (toolCounts[key] || 0) + 1
  })

  const top = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  if (top.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      background: t.floatBg, border: `1px solid ${t.border}`,
      backdropFilter: 'blur(20px)', borderRadius: 12, padding: '8px 14px',
      display: 'flex', gap: 12, alignItems: 'center',
      boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
      maxWidth: 'calc(100vw - 32px)',
      overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      <span style={{ fontSize: 9, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Top:</span>
      {top.map(([tool, count]) => (
        <div key={tool} style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: t.text }}>{tool}</span>
          <span style={{
            fontSize: 9, padding: '1px 5px', borderRadius: 4,
            background: t.accentBg, color: t.accent, fontWeight: 600,
          }}>{count}</span>
        </div>
      ))}
    </div>
  )
}
