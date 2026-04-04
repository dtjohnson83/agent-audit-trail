'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Agent } from '@/lib/types'

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('last_active', { ascending: false })
    if (!error && data) {
      setAgents(data as any[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { agents, loading, refetch: fetch }
}
