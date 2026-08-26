import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashEntry(previousHash: string | null, entry: Record<string, unknown>) {
  const payload = [
    previousHash ?? "genesis",
    entry.entry_id,
    entry.timestamp,
    entry.agent_id,
    entry.agent_name,
    entry.tool_name,
    entry.tool_action,
    stableJson(entry.parameters ?? {}),
    entry.response_summary ?? "",
    entry.response_status ?? "success",
    stableJson(entry.data_fields_accessed ?? []),
    String(entry.execution_duration_ms ?? 0),
    String(entry.token_cost_estimate ?? ""),
    stableJson(entry.policy_violations ?? []),
    stableJson(entry.metadata ?? {}),
  ].join("|");

  return createHash("sha256").update(payload).digest("hex");
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Audit backend is not configured" },
      { status: 503 },
    );
  }

  const [totalResult, blockedResult, agentsResult, latestResult] =
    await Promise.all([
      supabase.from("audit_logs").select("id", { count: "exact", head: true }),
      supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("response_status", "blocked"),
      supabase
        .from("agents")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("audit_logs")
        .select("hash")
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const queryError =
    totalResult.error ||
    blockedResult.error ||
    agentsResult.error ||
    latestResult.error;
  if (queryError) {
    console.error("[webmcp] Summary query failed:", queryError.message);
    return NextResponse.json({ error: "Audit summary unavailable" }, { status: 502 });
  }

  const previousHash = latestResult.data?.hash ?? null;
  const timestamp = new Date().toISOString();
  const origin = request.headers.get("origin") || new URL(request.url).origin;
  const entry: Record<string, unknown> = {
    entry_id: randomUUID(),
    timestamp,
    previous_hash: previousHash,
    agent_id: "webmcp-browser-agent",
    agent_name: "WebMCP Browser Agent",
    tool_name: "webmcp.get_audit_summary",
    tool_action: "read",
    parameters: { source: "document.modelContext" },
    response_summary: "Returned aggregate audit activity through WebMCP",
    response_status: "success",
    data_fields_accessed: [],
    execution_duration_ms: Math.round(performance.now() - startedAt),
    token_cost_estimate: null,
    policy_violations: [],
    metadata: {
      channel: "webmcp",
      origin,
      human_in_the_loop: true,
      spec_surface: "document.modelContext",
    },
  };
  entry.hash = hashEntry(previousHash, entry);

  const { error: insertError } = await supabase.from("audit_logs").insert(entry);
  if (insertError) {
    console.error("[webmcp] Audit insert failed:", insertError.message);
    return NextResponse.json({ error: "Invocation could not be audited" }, { status: 502 });
  }

  return NextResponse.json({
    total_actions: totalResult.count ?? 0,
    blocked_actions: blockedResult.count ?? 0,
    active_agents: agentsResult.count ?? 0,
    audit_receipt: {
      log_id: entry.entry_id,
      timestamp,
      hash: entry.hash,
    },
  });
}

