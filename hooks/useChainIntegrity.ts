'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useChainIntegrity() {
  const [status, setStatus] = useState<'verifying' | 'valid' | 'broken' | 'empty'>('verifying')
  const [brokenAt, setBrokenAt] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  const verify = async () => {
    setStatus('verifying')
    try {
      // Get all logs ordered by entry_id to check chain
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, entry_id, hash, previous_hash, agent_name, tool_name, timestamp')
        .order('entry_id', { ascending: true })

      if (error || !data || data.length === 0) {
        setStatus(data?.length === 0 ? 'empty' : 'verifying')
        return
      }

      // Check chain integrity: each entry's previous_hash should match prior entry's hash
      for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1]
        const curr = data[i]
        if (curr.previous_hash && curr.previous_hash !== prev.hash) {
          setStatus('broken')
          setBrokenAt(`${curr.agent_name} ${curr.tool_name} (${curr.id.slice(0, 8)})`)
          return
        }
      }
      setStatus('valid')
      setBrokenAt(null)
    } catch {
      setStatus('empty')
    }
    setCheckedAt(new Date())
  }

  useEffect(() => { verify() }, [])

  return { status, brokenAt, checkedAt, refetch: verify }
}
