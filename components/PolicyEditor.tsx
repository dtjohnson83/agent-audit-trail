'use client'
import { useState } from 'react'
import { Theme } from '@/lib/theme'
import type { PolicyRule } from '@/lib/types'

interface Props {
  theme: Theme
  onClose: () => void
  onSaved: () => void
  existing?: PolicyRule
}

export default function PolicyEditor({ theme: t, onClose, onSaved, existing }: Props) {
  const [name, setName] = useState(existing?.name || '')
  const [description, setDescription] = useState(existing?.description || '')
  const [conditionType, setConditionType] = useState(existing?.condition_type || 'tool_match')
  const [conditionValue, setConditionValue] = useState(existing?.condition_value || '')
  const [severity, setSeverity] = useState(existing?.severity || 'high')
  const [enforcement, setEnforcement] = useState<'flag' | 'block'>(existing?.enforcement_mode || 'flag')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name || !conditionValue) return
    setSaving(true)
    const rule = {
      rule_id: existing?.rule_id || name.toLowerCase().replace(/\s+/g, '-'),
      name,
      description,
      condition_type: conditionType,
      condition_operator: 'contains',
      condition_value: conditionValue,
      severity,
      enforcement_mode: enforcement,
      action: enforcement,
      enabled: true,
    }
    const { supabase } = await import('@/lib/supabase')
    if (existing) {
      await supabase.from('policy_rules').update(rule).eq('id', existing.id)
    } else {
      await supabase.from('policy_rules').insert(rule)
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  const inputStyle = (): React.CSSProperties => ({
    width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
    background: t.surface, border: `1px solid ${t.border}`, color: t.text,
    outline: 'none', fontFamily: 'Geist, sans-serif', boxSizing: 'border-box',
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 420, borderRadius: 16,
        background: t.surfaceSolid, border: `1px solid ${t.border}`,
        padding: 24, maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: '0 0 20px' }}>
          {existing ? 'Edit Policy' : 'New Policy'}
        </h2>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: t.textSecondary, display: 'block', marginBottom: 4 }}>Rule Name</label>
          <input style={inputStyle()} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Block destructive DB ops" />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: t.textSecondary, display: 'block', marginBottom: 4 }}>Description</label>
          <input style={inputStyle()} value={description} onChange={e => setDescription(e.target.value)} placeholder="What this rule catches" />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: t.textSecondary, display: 'block', marginBottom: 4 }}>Condition Type</label>
            <select style={{ ...inputStyle(), cursor: 'pointer' }} value={conditionType} onChange={e => setConditionType(e.target.value)}>
              <option value="tool_match">Tool Match</option>
              <option value="data_field_match">Data Field Match</option>
              <option value="parameter_match">Parameter Match</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: t.textSecondary, display: 'block', marginBottom: 4 }}>Severity</label>
            <select style={{ ...inputStyle(), cursor: 'pointer' }} value={severity} onChange={e => setSeverity(e.target.value as 'critical' | 'high' | 'medium' | 'low')}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: t.textSecondary, display: 'block', marginBottom: 4 }}>Keywords (space-separated)</label>
          <input style={inputStyle()} value={conditionValue} onChange={e => setConditionValue(e.target.value)} placeholder="e.g. delete drop truncate" />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: t.textSecondary, display: 'block', marginBottom: 4 }}>Enforcement Mode</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['flag', 'block'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setEnforcement(mode)}
                style={{
                  flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: enforcement === mode ? (mode === 'flag' ? `${t.flagged}15` : `${t.critical}15`) : t.surface,
                  border: `1px solid ${enforcement === mode ? (mode === 'flag' ? `${t.flagged}30` : `${t.critical}30`) : t.border}`,
                  color: enforcement === mode ? (mode === 'flag' ? t.flagged : t.critical) : t.textSecondary,
                }}
              >{mode === 'flag' ? 'Flag Only' : 'Block'}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            background: t.surface, border: `1px solid ${t.border}`, color: t.textSecondary,
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !name || !conditionValue} style={{
            flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: t.accent, border: `1px solid ${t.accent}`, color: '#000',
            opacity: (!name || !conditionValue) ? 0.5 : 1,
          }}>{saving ? 'Saving...' : 'Save Policy'}</button>
        </div>
      </div>
    </div>
  )
}
