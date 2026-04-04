'use client'
import { Theme } from '@/lib/theme'

interface Props {
  theme: Theme
  mode: 'dark' | 'light'
  onToggleTheme: () => void
}

export default function Header({ theme: t, mode, onToggleTheme }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 16px',
      borderBottom: `1px solid ${t.border}`,
      background: t.surfaceSolid,
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backdropFilter: 'blur(20px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 8, height: 8, borderRadius: 4,
          background: t.accent,
          boxShadow: `0 0 8px ${t.accent}`,
          animation: 'pulse 2s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Agent Audit</span>
        <span style={{
          fontSize: 9, fontWeight: 600, padding: '2px 6px',
          borderRadius: 4, background: t.accentBg,
          border: `1px solid ${t.accentBorder}`,
          color: t.accent, letterSpacing: '0.05em',
        }}>LIVE</span>
      </div>
      <button
        onClick={onToggleTheme}
        style={{
          background: t.surface, border: `1px solid ${t.border}`,
          borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
          fontSize: 11, color: t.textSecondary, fontFamily: 'Geist, sans-serif',
          transition: 'all 0.2s',
        }}
      >
        {mode === 'dark' ? 'Light' : 'Dark'}
      </button>
    </div>
  )
}
