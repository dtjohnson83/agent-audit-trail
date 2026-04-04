'use client'
import { Theme } from '@/lib/theme'

interface Props {
  theme: Theme
  onChange: (range: { start: Date | null; end: Date | null }) => void
}

export default function DateRangeFilter({ theme: t, onChange }: Props) {
  const presets = [
    { label: '1H', ms: 60 * 60 * 1000 },
    { label: '24H', ms: 24 * 60 * 60 * 1000 },
    { label: '7D', ms: 7 * 24 * 60 * 60 * 1000 },
    { label: 'All', ms: 0 },
  ]

  const setPreset = (ms: number) => {
    if (ms === 0) {
      onChange({ start: null, end: null })
    } else {
      const end = new Date()
      const start = new Date(end.getTime() - ms)
      onChange({ start, end })
    }
  }

  return (
    <div style={{
      display: 'flex', gap: 6, padding: '8px 16px',
      borderBottom: `1px solid ${t.border}`, overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      {presets.map(p => (
        <button
          key={p.label}
          onClick={() => setPreset(p.ms)}
          style={{
            flexShrink: 0, padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
            background: t.surface, border: `1px solid ${t.border}`,
            color: t.textSecondary, cursor: 'pointer',
          }}
        >{p.label}</button>
      ))}
    </div>
  )
}
