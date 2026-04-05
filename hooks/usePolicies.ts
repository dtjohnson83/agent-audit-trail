'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { PolicyRule } from '@/lib/types'

export function usePolicies() {
  const [policies, setPolicies] = useState<PolicyRule[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true)
    const { data, error } = await supabase
      .from('policy_rules')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) {
      setPolicies(data as any[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const togglePolicy = async (id: string, enabled: boolean) => {
    await supabase.from('policy_rules').update({ enabled }).eq('id', id)
    fetch()
  }

  const updateEnforcement = async (id: string, mode: 'flag' | 'block') => {
    await supabase.from('policy_rules').update({ enforcement_mode: mode, action: mode }).eq('id', id)
    fetch()
  }

  const savePolicy = async (policy: Partial<PolicyRule>, existingId?: string) => {
    if (existingId) {
      await supabase.from('policy_rules').update(policy).eq('id', existingId)
    } else {
      await supabase.from('policy_rules').insert(policy)
    }
    fetch()
  }

  return { policies, loading, refetch: fetch, togglePolicy, updateEnforcement, savePolicy }
}
