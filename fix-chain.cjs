#!/usr/bin/env node
/**
 * Fix the hash chain for Agent Audit Trail
 * Reads all entries from audit_logs, recomputes hashes using the correct
 * Deno-compatible algorithm, and updates them in place.
 * 
 * Usage: node fix-chain.js
 */
const { createHash } = require('crypto');

// Configuration
const SUPABASE_URL = process.env.AUDIT_SUPABASE_URL || 'https://gdmeyoikofpkulyqwzgi.supabase.co';
const SERVICE_KEY = process.env.AUDIT_SERVICE_KEY;
const PROJECT_KEY = process.env.SUPABASE_KEY; // fallback

if (!SERVICE_KEY && !PROJECT_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY or SUPABASE_KEY env');
  process.exit(1);
}
const KEY = SERVICE_KEY || PROJECT_KEY;

const GENESIS_HASH = 'genesis';

// ============================================================
// sortedJSON - MUST match the Deno version exactly
// ============================================================
function sortedJSON(obj) {
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj); } catch { return '{}'; }
  }
  if (Array.isArray(obj)) {
    return JSON.stringify(obj.map(item => {
      if (typeof item === 'object' && item !== null) return sortedJSON(item);
      return item;
    }));
  }
  if (typeof obj === 'object' && obj !== null) {
    const keys = Object.keys(obj).sort();
    const result = {};
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === 'object' && v !== null) {
        result[k] = Array.isArray(v)
          ? v.map(vi => (typeof vi === 'object' && vi !== null) ? sortedJSON(vi) : vi)
          : sortedJSON(v);
      } else {
        result[k] = v;
      }
    }
    return JSON.stringify(result);
  }
  return JSON.stringify(obj);
}

// ============================================================
// Hash computation - MUST match Deno computeEntryHash
// ============================================================
function computeEntryHash(previousHash, entry) {
  const params = entry.parameters;
  const meta = entry.metadata;
  const pv = entry.policy_violations;
  const dfa = Array.isArray(entry.data_fields_accessed)
    ? entry.data_fields_accessed.slice().sort()
    : [];

  const payload = [
    previousHash ?? GENESIS_HASH,
    String(entry.entry_id || entry.id || ''),
    String(entry.timestamp || ''),
    String(entry.agent_id || ''),
    String(entry.agent_name || ''),
    String(entry.tool_name || ''),
    String(entry.tool_action || ''),
    sortedJSON(params ?? {}),
    String(entry.response_summary ?? ''),
    String(entry.response_status ?? 'success'),
    JSON.stringify(dfa),
    String(entry.execution_duration_ms ?? 0),
    String(entry.token_cost_estimate ?? ''),
    sortedJSON(pv ?? []),
    sortedJSON(meta ?? {}),
  ].join('|');

  return createHash('sha256').update(payload).digest('hex');
}

// ============================================================
// Normalize JSONB from Supabase
// ============================================================
function normalizeJSONB(val) {
  if (typeof val === 'undefined' || val === null) return null;
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.map(item => {
        if (typeof item === 'string') {
          try { return JSON.parse(item); } catch { return item; }
        }
        return item;
      });
    }
    return val;
  }
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

// ============================================================
// Supabase REST helpers
// ============================================================
async function supabaseFetch(table, options = {}) {
  const { method = 'GET', body, params = {} } = options;
  const queryStr = Object.keys(params).length > 0
    ? '?' + new URLSearchParams(params).map((v, k) => [k, v]).flatMap(([k, v]) => Array.isArray(v) ? v.map(vi => [k, vi]) : [[k, v]]).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&')
    : '';
  const init = {
    method,
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' || method === 'PATCH' ? 'return=representation' : '',
    },
  };
  if (body) init.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${queryStr}`, init);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`[supabase] ${method} ${table} failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

// ============================================================
// Main migration
// ============================================================
async function main() {
  console.log('Fetching all audit logs...');
  const logs = await supabaseFetch('audit_logs?select=*&order=created_at.asc');
  console.log(`Found ${logs.length} entries`);

  if (logs.length === 0) {
    console.log('Nothing to fix. Chain is empty.');
    return;
  }

  let fixed = 0;
  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];
    
    // Normalize JSONB fields
    const normalized = {
      ...entry,
      parameters: normalizeJSONB(entry.parameters) ?? {},
      metadata: normalizeJSONB(entry.metadata) ?? {},
      policy_violations: normalizeJSONB(entry.policy_violations) ?? [],
      data_fields_accessed: Array.isArray(entry.data_fields_accessed) ? entry.data_fields_accessed : [],
    };

    const previousHash = i === 0 ? null : logs[i - 1].hash;
    const newHash = computeEntryHash(previousHash, normalized);

    if (entry.hash !== newHash) {
      console.log(`Entry ${i}: ${entry.entry_id.slice(0, 8)} — hash mismatch`);
      console.log(`  OLD: ${entry.hash.slice(0, 16)}...`);
      console.log(`  NEW: ${newHash.slice(0, 16)}...`);
      console.log(`  prev_hash: ${previousHash ? previousHash.slice(0, 16) + '...' : 'genesis'}`);

      // Update in DB
      await supabaseFetch(`audit_logs?entry_id=eq.${entry.entry_id}`, {
        method: 'PATCH',
        body: {
          hash: newHash,
          previous_hash: previousHash,
        },
      });
      fixed++;
    } else {
      console.log(`Entry ${i}: ${entry.entry_id.slice(0, 8)} — OK (${newHash.slice(0, 8)}...)`);
    }
  }

  console.log(`\nDone. Fixed ${fixed} entries.`);
}

main().catch(console.error);
