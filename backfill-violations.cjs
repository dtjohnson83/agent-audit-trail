#!/usr/bin/env node
/**
 * Backfill missing policy_violations in audit_logs.
 * Since changing violations changes the hash, must recompute entire chain
 * from the first modified entry onwards.
 */
const { createHash } = require('crypto');

const SUPABASE_URL = 'https://gdmeyoikofpkulyqwzgi.supabase.co';
const SERVICE_KEY = process.env.AUDIT_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkbWV5b2lrb2Zwa3VseXF3emdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI4MzgzNSwiZXhwIjoyMDkwODU5ODM1fQ.ShMCrCyBndpebhvA5-q_8L5rCtxZ23GEjb74D7WP6KY';
const GENESIS_HASH = 'genesis';

function sortedJSON(obj) {
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj); } catch { return '{}'; }
  }
  if (Array.isArray(obj)) {
    return JSON.stringify(obj.map(item =>
      typeof item === 'object' && item !== null ? sortedJSON(item) : item
    ));
  }
  if (typeof obj === 'object' && obj !== null) {
    const keys = Object.keys(obj).sort();
    const result = {};
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === 'object' && v !== null) {
        result[k] = Array.isArray(v)
          ? v.map(vi => typeof vi === 'object' && vi !== null ? sortedJSON(vi) : vi)
          : sortedJSON(v);
      } else {
        result[k] = v;
      }
    }
    return JSON.stringify(result);
  }
  return JSON.stringify(obj);
}

function computeEntryHash(previousHash, entry) {
  const dfa = Array.isArray(entry.data_fields_accessed)
    ? [...entry.data_fields_accessed].sort()
    : [];
  const payload = [
    previousHash ?? GENESIS_HASH,
    String(entry.entry_id || ''),
    String(entry.timestamp || ''),
    String(entry.agent_id || ''),
    String(entry.agent_name || ''),
    String(entry.tool_name || ''),
    String(entry.tool_action || ''),
    sortedJSON(entry.parameters ?? {}),
    String(entry.response_summary || ''),
    String(entry.response_status || 'success'),
    JSON.stringify(dfa),
    String(entry.execution_duration_ms ?? 0),
    String(entry.token_cost_estimate ?? ''),
    sortedJSON(entry.policy_violations ?? []),
    sortedJSON(entry.metadata ?? {}),
  ].join('|');
  return createHash('sha256').update(payload).digest('hex');
}

function evaluateEntry(entry) {
  const violations = [];
  const toolText = `${entry.tool_name || ''} ${entry.tool_action || ''}`.toLowerCase();
  const dataFields = Array.isArray(entry.data_fields_accessed) ? entry.data_fields_accessed : [];
  const dataText = dataFields.join(' ').toLowerCase();

  // PII rule
  const piiFields = ['ssn', 'passport', 'drivers_license', 'dob', 'date_of_birth', 'email', 'phone', 'address', 'credit_card'];
  if (piiFields.some(f => dataText.includes(f))) {
    violations.push({ rule_id: 'pii-rule', rule_name: 'PII Field Access', severity: 'high', action_taken: 'flag', enforcement_mode: 'flag', details: 'Rule "PII Field Access" triggered (data_field_match match).' });
  }

  // Destructive DB rule — only database tools
  const isDbTool = ['sql', 'database', 'supabase', 'postgres', 'pg', 'mysql', 'sqlite', 'mongod', 'redis'].some(
    t => (entry.tool_name || '').toLowerCase().includes(t)
  );
  const destructiveKeywords = ['delete', 'drop', 'truncate', 'destroy'];
  if (isDbTool && destructiveKeywords.some(k => toolText.includes(k))) {
    violations.push({ rule_id: 'destructive-db', rule_name: 'Destructive Database Operation', severity: 'critical', action_taken: 'flag', enforcement_mode: 'flag', details: 'Rule "Destructive Database Operation" triggered (tool_match match).' });
  }

  // File delete — triggers destructive rule (separate from DB)
  const isFileDelete = (entry.tool_name || '').toLowerCase() === 'file' &&
                       (entry.tool_action || '').toLowerCase() === 'delete';
  if (isFileDelete) {
    violations.push({ rule_id: 'destructive-db', rule_name: 'Destructive DB Op', severity: 'critical', action_taken: 'flag', enforcement_mode: 'flag', details: 'Rule "Destructive DB Op" triggered (file delete operation).' });
  }

  return violations;
}

async function supabaseFetch(table, options = {}) {
  const { method = 'GET', body, params = {} } = options;
  const queryStr = Object.keys(params).length > 0
    ? '?' + new URLSearchParams(params).toString()
    : '';
  const init = {
    method,
    headers: {
      'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'PATCH' ? 'return=representation' : '',
    },
  };
  if (body) init.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${queryStr}`, init);
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${table} failed: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  console.log('Fetching all audit logs...');
  const logs = await supabaseFetch('audit_logs?select=*&order=created_at.asc');
  console.log(`Found ${logs.length} entries`);

  // Determine which entries need violations added
  const needsUpdate = [];
  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];
    const violations = evaluateEntry(entry);
    const currentPV = entry.policy_violations;
    const hasBlank = !currentPV || currentPV.length === 0 ||
      (currentPV.length === 1 && currentPV[0] && !currentPV[0].rule_id);

    if (violations.length > 0 && hasBlank) {
      needsUpdate.push({ index: i, entry_id: entry.entry_id, violations });
    }
  }

  if (needsUpdate.length === 0) {
    console.log('No entries need backfilling.');
    return;
  }

  console.log(`Entries needing backfill: ${needsUpdate.length}`);
  needsUpdate.forEach(({ entry_id, violations }) => {
    console.log(`  ${entry_id.slice(0, 8)}: ${violations.map(v => v.rule_name).join(', ')}`);
  });

  // Rebuild chain from first modified entry onwards
  const firstModifiedIdx = needsUpdate[0].index;
  console.log(`\nRebuilding chain from entry ${firstModifiedIdx}...`);

  for (let i = firstModifiedIdx; i < logs.length; i++) {
    const entry = logs[i];

    // Recompute violations if this entry needs them
    const needsV = needsUpdate.find(u => u.index === i);
    const violations = needsV ? needsV.violations : (entry.policy_violations || []);
    const previousHash = i === 0 ? null : logs[i - 1].hash;
    const newHash = computeEntryHash(previousHash, { ...entry, policy_violations: violations });

    if (i < 5 || i >= logs.length - 3) {
      console.log(`  ${i}: ${entry.entry_id.slice(0, 8)} violations=${violations.length} hash=${newHash.slice(0, 12)}...`);
    } else if (i === 5) {
      console.log('  ...');
    }

    await supabaseFetch(`audit_logs?entry_id=eq.${entry.entry_id}`, {
      method: 'PATCH',
      body: { policy_violations: violations, hash: newHash, previous_hash: previousHash },
    });

    // Update in-memory for next iteration
    logs[i] = { ...entry, policy_violations: violations, hash: newHash, previous_hash: previousHash };
  }

  console.log(`\nDone. Chain rebuilt from entry ${firstModifiedIdx}.`);
}

main().catch(console.error);
