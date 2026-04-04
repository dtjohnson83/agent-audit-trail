'use client'
import { useState } from 'react'
import { Theme } from '@/lib/theme'
import type { AuditLog } from '@/lib/types'
import { exportCsv, exportPdf } from '@/lib/export'

interface Props {
  theme: Theme
  logs: AuditLog[]
}

export default function ExportButton({ theme: t, logs }: Props) {
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
          borderRadius: 10, overflow: 'hidden', minWidth: 140,
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
        </div>
      )}
    </div>
  )
}
