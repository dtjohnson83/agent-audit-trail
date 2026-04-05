/**
 * Run DDL migration: add initiated_by, session_id, environment columns
 * Uses Deno's built-in postgres client
 */
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const connStr = Deno.env.get("AUDIT_SUPABASE_DB_URL");
  if (!connStr) {
    return new Response(JSON.stringify({ error: "AUDIT_SUPABASE_DB_URL not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let client: Client;
  try {
    client = new Client(connStr);
    await client.connect();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "Connection failed", detail: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Add columns
    await client.queryObject(`
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS initiated_by TEXT DEFAULT 'system'
    `);
    await client.queryObject(`
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS session_id TEXT
    `);
    await client.queryObject(`
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'production'
    `);
    await client.queryObject(`
      DO $$ BEGIN
        ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_environment_check
          CHECK (environment IN ('production', 'staging', 'dev', 'test'));
      $$ EXCEPTION WHEN duplicate_object THEN NULL;
    `);
    await client.queryObject(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON audit_logs(session_id)
    `);
    await client.queryObject(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_environment ON audit_logs(environment)
    `);

    return new Response(JSON.stringify({ success: true, message: "Schema migrated" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    await client.end();
  }
});

function serve(handler: (req: Request) => Promise<Response> | Response): void {
  const handlerFn = async (req: Request) => {
    try {
      return await handler(req);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: "Unhandled", detail: msg }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }
  };
  // @ts-ignore - Deno global
  self.addEventListener("fetch", (event) => {
    // @ts-ignore
    event.respondWith(handlerFn(event.request));
  });
}
