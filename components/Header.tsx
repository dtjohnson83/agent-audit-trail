'use client'
import { Theme } from '@/lib/theme'
import { useChainIntegrity } from '@/hooks/useChainIntegrity'

interface Props {
  theme: Theme
  mode: 'dark' | 'light'
  onToggleTheme: () => void
}

export default function Header({ theme: t, mode, onToggleTheme }: Props) {
  const { status, brokenAt, refetch } = useChainIntegrity()

  const chainColor = status === 'valid' ? t.success
    : status === 'broken' ? t.critical
    : status === 'empty' ? t.textMuted
    : t.accent

  const chainLabel = status === 'valid' ? 'CHAIN OK'
    : status === 'broken' ? 'CHAIN BROKEN'
    : status === 'empty' ? 'NO DATA'
    : 'VERIFYING'

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
          background: chainColor,
          boxShadow: `0 0 8px ${chainColor}`,
          animation: status === 'verifying' ? 'pulse 1s ease-in-out infinite' : undefined,
          transition: 'background 0.3s, box-shadow 0.3s',
        }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Agent Audit</span>
        <button
          onClick={refetch}
          title={brokenAt ? `Broken at: ${brokenAt}` : 'Click to re-verify chain'}
          style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px',
            borderRadius: 4, background: `${chainColor}15`,
            border: `1px solid ${chainColor}40`,
            color: chainColor, letterSpacing: '0.06em', cursor: 'pointer',
            transition: 'all 0.3s',
          }}
        >{chainLabel}</button>
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
