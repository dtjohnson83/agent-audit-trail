'use client'
import { useState } from 'react'
import { Theme } from '@/lib/theme'
import type { AuditLog } from '@/lib/types'
import { exportCsv, exportPdf, exportColoradoSb205 } from '@/lib/export'

interface Props {
  theme: Theme
  logs: AuditLog[]
  orgName?: string
  contactEmail?: string
}

export default function ExportButton({ theme: t, logs, orgName, contactEmail }: Props) {
  const [open, setOpen] = useState(false)

  if (logs.length === 0) return null

  const filename = `audit-trail-${new Date().toISOString().split('T')[0]}`

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600,
          background: t.surface, border: `1px solid ${t.border}`,
          color: t.textSecondary, cursor: 'pointer',
        }}
      >
        Export ({logs.length})
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 50,
          background: t.surfaceSolid, border: `1px solid ${t.border}`,
          borderRadius: 10, overflow: 'hidden', minWidth: 180,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          <button
            onClick={() => { exportCsv(logs, filename); setOpen(false) }}
            style={{
              display: 'block', width: '100%', padding: '10px 14px', fontSize: 12,
              background: 'transparent', border: 'none', color: t.text,
              cursor: 'pointer', textAlign: 'left',
            }}
          >Export CSV</button>
          <button
            onClick={() => { exportPdf(logs, filename); setOpen(false) }}
            style={{
              display: 'block', width: '100%', padding: '10px 14px', fontSize: 12,
              background: 'transparent', border: 'none', color: t.text,
              cursor: 'pointer', textAlign: 'left',
            }}
          >Export PDF</button>
          <div style={{ borderTop: `1px solid ${t.border}`, padding: '6px 14px 4px' }}>
            <button
              onClick={() => { exportColoradoSb205(logs, filename, orgName, contactEmail); setOpen(false) }}
              style={{
                display: 'block', width: '100%', padding: '8px 0 4px', fontSize: 11,
                background: 'transparent', border: 'none', color: '#0a9b80',
                cursor: 'pointer', textAlign: 'left', fontWeight: 600,
              }}
              title="Colorado SB 205 AI Audit Compliance Report"
            >
              CO SB 205 Report
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
