'use client'
import { useState } from 'react'
import { Theme } from '@/lib/theme'
import type { AuditLog } from '@/lib/types'
import { supabase } from '@/lib/supabase'

interface Props {
  theme: Theme
  log: AuditLog
  onClose: () => void
  onSaved: () => void
}

export default function ReviewModal({ theme: t, log, onClose, onSaved }: Props) {
  const [status, setStatus] = useState<'reviewed' | 'escalated' | 'false_positive'>('reviewed')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('audit_logs').update({
      review_status: status,
      reviewed_by: 'dashboard_user',
      reviewed_at: new Date().toISOString(),
      review_notes: notes,
    }).eq('id', log.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  const statuses: { value: 'reviewed' | 'escalated' | 'false_positive'; label: string; color: string }[] = [
    { value: 'reviewed', label: 'Reviewed', color: t.success },
    { value: 'escalated', label: 'Escalated', color: t.high },
    { value: 'false_positive', label: 'False Positive', color: t.textMuted },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 400, borderRadius: 16,
        background: t.surfaceSolid, border: `1px solid ${t.border}`,
        padding: 24,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: '0 0 6px' }}>Review Entry</h2>
        <p style={{ fontSize: 11, color: t.textMuted, margin: '0 0 20px' }}>
          {log.tool_name}.{log.tool_action} · {log.agent_name}
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: t.textSecondary, display: 'block', marginBottom: 6 }}>Review Status</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {statuses.map(s => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value)}
                style={{
                  flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: status === s.value ? `${s.color}15` : t.surface,
                  border: `1px solid ${status === s.value ? `${s.color}30` : t.border}`,
                  color: status === s.value ? s.color : t.textSecondary,
                }}
              >{s.label}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: t.textSecondary, display: 'block', marginBottom: 4 }}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add review notes..."
            rows={3}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
              background: t.surface, border: `1px solid ${t.border}`, color: t.text,
              outline: 'none', fontFamily: 'Geist, sans-serif', resize: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            background: t.surface, border: `1px solid ${t.border}`, color: t.textSecondary,
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: t.accent, border: `1px solid ${t.accent}`, color: '#000',
          }}>{saving ? 'Saving...' : 'Submit Review'}</button>
        </div>
      </div>
    </div>
  )
}
