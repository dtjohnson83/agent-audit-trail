/**
 * Create waitlist table — Supabase Edge Function using postgres.js
 * Uses SUPABASE_DB_URL env var (auto-injected in Supabase Edge Runtime)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return new Response(JSON.stringify({ 
        error: "SUPABASE_DB_URL not available",
        sql: "CREATE TABLE IF NOT EXISTS waitlist (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW()); ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY; CREATE POLICY 'waitlist_insert' ON waitlist FOR INSERT TO anon WITH CHECK (true); CREATE POLICY 'waitlist_select' ON waitlist FOR SELECT TO anon USING (true);"
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // postgres.js import
    const { default: postgres } = await import("https://esm.sh/@supabase/postgres-js@1.0.0");

    const sql = postgres(dbUrl, {
      max: 1,
      idleTimeout: 10,
      connect_timeout: 10,
    });

    // Run DDL
    await sql`CREATE TABLE IF NOT EXISTS waitlist (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY`;
    await sql`CREATE POLICY "waitlist_insert" ON waitlist FOR INSERT TO anon WITH CHECK (true)`;
    await sql`CREATE POLICY "waitlist_select" ON waitlist FOR SELECT TO anon USING (true)`;

    // Close connection
    await sql.end();

    return new Response(JSON.stringify({ 
      success: true,
      message: "waitlist table created successfully"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    
    // If table already exists, that's fine
    if (message.includes("already exists") || message.includes("42P07")) {
      return new Response(JSON.stringify({ 
        success: true,
        status: "already_exists",
        message: "waitlist table already exists"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
