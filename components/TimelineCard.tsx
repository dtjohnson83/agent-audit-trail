'use client'
import { useState } from 'react'
import { Theme } from '@/lib/theme'
import type { AuditLog } from '@/lib/types'

interface Props {
  theme: Theme
  log: AuditLog
  onReview: (log: AuditLog) => void
}

export default function TimelineCard({ theme: t, log, onReview }: Props) {
  const [expanded, setExpanded] = useState(false)

  const statusColor = log.response_status === 'success' ? t.success
    : log.response_status === 'blocked' ? t.critical
    : log.response_status === 'error' ? t.error
    : t.flagged

  const severityColor = (sev: string) =>
    sev === 'critical' ? t.critical : sev === 'high' ? t.high : sev === 'medium' ? t.medium : t.textMuted

  return (
    <div style={{
      margin: '8px 16px', borderRadius: 12,
      background: t.cardBg, border: `1px solid ${t.border}`,
      backdropFilter: 'blur(10px)', overflow: 'hidden',
      animation: 'fadeSlide 0.3s ease forwards',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '12px 14px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
        }}
      >
        <div style={{
          width: 8, height: 8, borderRadius: 4, flexShrink: 0,
          background: statusColor,
          boxShadow: `0 0 6px ${statusColor}60`,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{log.agent_name}</span>
            <span style={{ fontSize: 10, color: t.textMuted }}>{log.tool_name}.{log.tool_action}</span>
            {log.policy_violations.length > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4,
                background: `${severityColor(log.policy_violations[0].severity)}15`,
                color: severityColor(log.policy_violations[0].severity),
              }}>
                {log.policy_violations[0].severity}
              </span>
            )}
            {log.response_status === 'flagged' && log.review_status === 'new' && (
              <span style={{
                fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4,
                background: `${t.flagged}15`, color: t.flagged,
              }}>REVIEW</span>
            )}
          </div>
          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
            {new Date(log.timestamp).toLocaleString()} · {log.execution_duration_ms}ms
          </div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: statusColor, flexShrink: 0 }}>
          {log.response_status.toUpperCase()}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{
          padding: '0 14px 14px', borderTop: `1px solid ${t.border}`,
          marginTop: 0, paddingTop: 12,
        }}>
          {log.response_summary && (
            <p style={{ fontSize: 11, color: t.textSecondary, margin: '0 0 10px', lineHeight: 1.5 }}>
              {log.response_summary}
            </p>
          )}
          {log.policy_violations.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 9, color: t.textMuted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Violations</p>
              {log.policy_violations.map((v, i) => (
                <div key={i} style={{
                  padding: '6px 10px', borderRadius: 6, marginBottom: 4,
                  background: `${severityColor(v.severity)}08`,
                  border: `1px solid ${severityColor(v.severity)}20`,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: severityColor(v.severity) }}>{v.severity.toUpperCase()}</span>
                  <span style={{ fontSize: 10, color: t.textSecondary, marginLeft: 6 }}>{v.message}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {log.data_fields_accessed.slice(0, 5).map(f => (
              <span key={f} style={{
                fontSize: 9, padding: '2px 6px', borderRadius: 4,
                background: t.surface, border: `1px solid ${t.border}`,
                color: t.textSecondary, fontFamily: 'monospace',
              }}>{f}</span>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 9, color: t.textMuted }}>Hash:</span>
            <span style={{ fontSize: 9, color: t.textGhost, fontFamily: 'monospace' }}>{log.hash.substring(0, 16)}...</span>
          </div>
          {(log.response_status === 'flagged' || log.response_status === 'blocked') && log.review_status === 'new' && (
            <button
              onClick={(e) => { e.stopPropagation(); onReview(log) }}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                background: t.accentBg, border: `1px solid ${t.accentBorder}`,
                color: t.accent, cursor: 'pointer', width: '100%',
              }}
            >Review Entry</button>
          )}
          {log.review_status !== 'new' && (
            <div style={{ fontSize: 10, color: t.textMuted }}>
              Reviewed {log.review_status} {log.review_notes && `- ${log.review_notes}`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
