import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { agent_id, tool_name, tool_action, parameters, data_fields_accessed } = await req.json()

  if (!agent_id || !tool_name || !tool_action) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 1. Check agent permissions (deny list)
  const { data: denied } = await supabase
    .from('agent_permissions')
    .select('*')
    .eq('agent_id', agent_id)
    .eq('permission_type', 'deny')

  for (const d of denied || []) {
    if (d.resource_type === 'tool' && d.resource_name === tool_name) {
      return new Response(JSON.stringify({
        allowed: false,
        reason: `Agent denied access to tool: ${tool_name}`,
        rule: 'agent_permission',
        blocked_by: [{ name: 'agent_permission', message: `Access to ${tool_name} denied` }],
        violations: [],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (d.resource_type === 'action' && d.resource_name === tool_action) {
      return new Response(JSON.stringify({
        allowed: false,
        reason: `Agent denied action: ${tool_action}`,
        rule: 'agent_permission',
        blocked_by: [{ name: 'agent_permission', message: `Action ${tool_action} denied` }],
        violations: [],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  }

  // 2. Check policy rules
  const { data: rules } = await supabase
    .from('policy_rules')
    .select('*')
    .eq('enabled', true)

  const violations: any[] = []

  for (const rule of rules || []) {
    let triggered = false
    const values = (rule.condition_value as string).split(' ').filter(Boolean)

    if (rule.condition_type === 'tool_match') {
      triggered = values.some((v: string) =>
        tool_name.toLowerCase().includes(v.toLowerCase()) ||
        tool_action.toLowerCase().includes(v.toLowerCase())
      )
    }

    if (rule.condition_type === 'data_field_match' && data_fields_accessed?.length) {
      triggered = triggered || data_fields_accessed.some((field: string) =>
        values.some((v: string) => field.toLowerCase().includes(v.toLowerCase()))
      )
    }

    if (rule.condition_type === 'parameter_match' && parameters) {
      const paramStr = JSON.stringify(parameters).toLowerCase()
      triggered = triggered || values.some((v: string) => paramStr.includes(v.toLowerCase()))
    }

    if (triggered) {
      violations.push({
        rule_id: rule.rule_id,
        name: rule.name,
        severity: rule.severity,
        enforcement: rule.enforcement_mode,
        message: rule.description,
      })
    }
  }

  const blocked = violations.some(v => v.enforcement === 'block')

  return new Response(JSON.stringify({
    allowed: !blocked,
    violations,
    blocked_by: blocked ? violations.filter(v => v.enforcement === 'block') : [],
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
