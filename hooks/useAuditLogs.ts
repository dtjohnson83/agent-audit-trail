'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AuditLog } from '@/lib/types'

export function useAuditLogs(agentFilter: string, dateRange: { start: Date | null; end: Date | null }) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200)

      if (agentFilter !== 'all') {
        query = query.eq('agent_id', agentFilter)
      }
      if (dateRange.start) {
        query = query.gte('timestamp', dateRange.start.toISOString())
      }
      if (dateRange.end) {
        query = query.lte('timestamp', dateRange.end.toISOString())
      }

      const { data, error: err } = await query
      if (err) throw err
      setLogs((data as any) || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [agentFilter, dateRange.start?.toISOString(), dateRange.end?.toISOString()])

  useEffect(() => { fetch() }, [fetch])

  return { logs, loading, error, refetch: fetch }
}
