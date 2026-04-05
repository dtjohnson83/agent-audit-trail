// One-time migration runner - adds migration marker columns to audit_logs
// Safe to run multiple times (IF NOT EXISTS)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const auditUrl = Deno.env.get("AUDIT_SUPABASE_URL");
  const auditKey = Deno.env.get("AUDIT_SERVICE_KEY");

  if (!auditUrl || !auditKey) {
    return new Response(JSON.stringify({ error: "Missing env vars" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(auditUrl, auditKey);

  // Run the ALTER TABLE via raw SQL using rpc (if available) or try via INSERT workaround
  // Since we can't run DDL via supabase-js, we'll try using a workaround:
  // Insert a dummy record that has the new columns, then check if they exist
  
  const results: string[] = [];

  // Check if columns exist by trying to select them
  const { error: colError } = await supabase
    .from("audit_logs")
    .select("migrated_from_nodejs, migrated_at")
    .limit(1);

  if (colError && colError.message.includes("migrated_from_nodejs")) {
    // Columns don't exist - we need to add them via raw SQL
    // Use the REST API directly to run SQL
    const sqlUrl = `${auditUrl}/rest/v1/rpc/__exec_sql__`;
    const sqlBody = {
      query: `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS migrated_from_nodejs BOOLEAN DEFAULT false, ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMPTZ;`,
    };
    
    try {
      const res = await fetch(sqlUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": auditKey,
          "Authorization": `Bearer ${auditKey}`,
          "Prefer": "return=representation",
        },
        body: JSON.stringify(sqlBody),
      });
      const text = await res.text();
      results.push(`SQL via rpc: ${res.status} - ${text}`);
    } catch (e) {
      results.push(`SQL via rpc failed: ${e}`);
      
      // Fallback: Try via pg膜
      // We can't actually run DDL this way without a proper SQL execution endpoint
      // Let's try the management API instead
      results.push("Need management API to run DDL. Columns were NOT added.");
    }
  } else {
    results.push("Columns already exist or query succeeded");
  }

  // Also verify with a simple select
  const { data, error } = await supabase
    .from("audit_logs")
    .select("entry_id, migrated_from_nodejs, migrated_at")
    .limit(5);

  return new Response(JSON.stringify({
    migration_run: new Date().toISOString(),
    results,
    columns_check: { error: colError?.message || "OK", sample: data },
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
