'use client'
import { Theme } from '@/lib/theme'
import type { AuditLog } from '@/lib/types'
import TimelineCard from './TimelineCard'

interface Props {
  theme: Theme
  logs: AuditLog[]
  loading: boolean
  onReview: (log: AuditLog) => void
}

export default function Timeline({ theme: t, logs, loading, onReview }: Props) {
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: t.textMuted }}>Loading audit logs...</div>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: t.textMuted }}>No entries found</div>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: 8 }}>
      {logs.map(log => (
        <TimelineCard key={log.id} theme={t} log={log} onReview={onReview} />
      ))}
    </div>
  )
}
