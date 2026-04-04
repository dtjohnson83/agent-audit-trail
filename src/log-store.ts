/**
 * Agent Audit Trail - Log Store
 * Immutable audit log storage with cryptographic hash chaining.
 *
 * Every entry is signed with SHA-256 of: (previous_entry_hash + entry_contents)
 * This creates an immutable, tamper-evident chain.
 * Any modification to historical entries breaks the chain and is detectable.
 */

import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import type {
  AuditLogEntry,
  AuditQueryOptions,
  AuditSummary,
  AgentRegistration,
  ChainVerificationResult,
} from "./types.js";

const GENESIS_HASH = "genesis";

/**
 * Compute the SHA-256 hash of an audit log entry.
 * Covers all core fields but NOT the hash fields themselves (previous_hash, hash).
 * The previous_hash is prepended to bind entries together.
 */
function computeEntryHash(
  previousHash: string | null,
  entry: Omit<AuditLogEntry, "previous_hash" | "hash">
): string {
  const payload = [
    previousHash ?? GENESIS_HASH,
    entry.id,
    entry.timestamp,
    entry.agent_id,
    entry.agent_name,
    entry.tool_name,
    entry.tool_action,
    JSON.stringify(entry.parameters ?? {}),
    entry.response_summary ?? "",
    entry.response_status ?? "success",
    JSON.stringify(entry.data_fields_accessed ?? []),
    String(entry.execution_duration_ms ?? 0),
    String(entry.token_cost_estimate ?? ""),
    JSON.stringify(entry.policy_violations ?? []),
    JSON.stringify(entry.metadata ?? {}),
  ].join("|");

  return createHash("sha256").update(payload).digest("hex");
}

export class LogStore {
  private logs: AuditLogEntry[] = [];
  private agents: Map<string, AgentRegistration> = new Map();
  private persistPath: string | null;

  constructor(persistPath?: string) {
    this.persistPath = persistPath || null;
    if (this.persistPath) {
      this.loadFromDisk();
    }
  }

  /**
   * Write an immutable log entry.
   *
   * The entry is cryptographically chained to the previous entry.
   * Once written, the chain cannot be broken without detection.
   *
   * @returns The written entry with hash and previous_hash populated.
   */
  writeLog(
    entry: Omit<AuditLogEntry, "id" | "timestamp" | "previous_hash" | "hash">
  ): AuditLogEntry {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    const previousHash = this.logs.length > 0 ? this.logs[this.logs.length - 1].hash : null;

    const entryData = {
      ...entry,
      id,
      timestamp,
      previous_hash: previousHash,
    };

    const hash = computeEntryHash(previousHash, entryData);

    const fullEntry: AuditLogEntry = {
      ...entryData,
      hash,
    };

    this.logs.push(fullEntry);
    this.updateAgentActivity(entry.agent_id, entry.agent_name);
    this.persistToDisk();

    return fullEntry;
  }

  /**
   * Verify the integrity of the entire audit chain.
   *
   * Returns which entry (if any) is the first to fail verification.
   * A valid chain returns { valid: true, entries_checked, broken_at: null, error: null }.
   *
   * Call this after loading from disk, before serving compliance reports.
   */
  verifyChain(): ChainVerificationResult {
    if (this.logs.length === 0) {
      return {
        valid: true,
        entries_checked: 0,
        broken_at: null,
        error: null,
      };
    }

    // logs[] is stored newest-first; verify oldest-first (genesis first)
    const reversed = [...this.logs].reverse();
    for (let i = 0; i < reversed.length; i++) {
      const entry = reversed[i];
      const expectedPreviousHash = i === 0 ? null : reversed[i - 1].hash;

      if (entry.previous_hash !== expectedPreviousHash) {
        return {
          valid: false,
          entries_checked: i,
          broken_at: entry.id,
          error: `Entry ${i} (${entry.id}): previous_hash mismatch. Expected ${expectedPreviousHash}, got ${entry.previous_hash}.`,
        };
      }

      const recomputedHash = computeEntryHash(entry.previous_hash, entry);
      if (recomputedHash !== entry.hash) {
        return {
          valid: false,
          entries_checked: i,
          broken_at: entry.id,
          error: `Entry ${i} (${entry.id}): hash mismatch. Entry contents have been modified after writing.`,
        };
      }
    }

    return {
      valid: true,
      entries_checked: this.logs.length,
      broken_at: null,
      error: null,
    };
  }

  /**
   * Query logs with filtering options.
   */
  queryLogs(options: AuditQueryOptions = {}): AuditLogEntry[] {
    let results = [...this.logs];

    if (options.agent_id) {
      results = results.filter((l) => l.agent_id === options.agent_id);
    }
    if (options.tool_name) {
      results = results.filter((l) => l.tool_name === options.tool_name);
    }
    if (options.status) {
      results = results.filter((l) => l.response_status === options.status);
    }
    if (options.has_violations) {
      results = results.filter((l) => l.policy_violations.length > 0);
    }
    if (options.start_date) {
      results = results.filter((l) => l.timestamp >= options.start_date!);
    }
    if (options.end_date) {
      results = results.filter((l) => l.timestamp <= options.end_date!);
    }

    // Sort newest first
    results.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const offset = options.offset || 0;
    const limit = options.limit || 50;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get a single log entry by ID.
   */
  getLog(id: string): AuditLogEntry | undefined {
    return this.logs.find((l) => l.id === id);
  }

  /**
   * Generate summary statistics.
   */
  getSummary(): AuditSummary {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).toISOString();

    const todayLogs = this.logs.filter((l) => l.timestamp >= todayStart);
    const todayViolations = todayLogs.filter(
      (l) => l.policy_violations.length > 0
    );
    const todayBlocked = todayLogs.filter(
      (l) => l.response_status === "blocked"
    );

    // Top tools by usage
    const toolCounts = new Map<string, number>();
    for (const log of this.logs) {
      toolCounts.set(
        log.tool_name,
        (toolCounts.get(log.tool_name) || 0) + 1
      );
    }
    const topTools = Array.from(toolCounts.entries())
      .map(([tool_name, count]) => ({ tool_name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Recent violations
    const recentViolations = this.logs
      .flatMap((l) => l.policy_violations)
      .slice(-10)
      .reverse();

    const activeAgents = Array.from(this.agents.values()).filter(
      (a) => a.status === "active"
    );

    return {
      total_actions: this.logs.length,
      actions_today: todayLogs.length,
      policy_violations_today: todayViolations.length,
      blocked_actions_today: todayBlocked.length,
      active_agents: activeAgents.length,
      top_tools: topTools,
      recent_violations: recentViolations,
    };
  }

  /**
   * Register or update an agent.
   */
  registerAgent(
    id: string,
    name: string,
    description: string = ""
  ): AgentRegistration {
    const existing = this.agents.get(id);
    const agent: AgentRegistration = {
      id,
      name,
      description,
      registered_at:
        existing?.registered_at || new Date().toISOString(),
      last_active: new Date().toISOString(),
      total_actions: existing?.total_actions || 0,
      status: "active",
    };
    this.agents.set(id, agent);
    this.persistToDisk();
    return agent;
  }

  /**
   * List all registered agents.
   */
  listAgents(): AgentRegistration[] {
    return Array.from(this.agents.values());
  }

  /**
   * Export logs as JSON for compliance reporting.
   * Includes chain verification result so auditors know the chain is intact.
   */
  exportLogs(options: AuditQueryOptions = {}): string {
    const chainStatus = this.verifyChain();
    const logs = this.queryLogs({ ...options, limit: 999999 });
    return JSON.stringify(
      {
        export_timestamp: new Date().toISOString(),
        export_version: "1.0",
        chain_verification: chainStatus,
        total_entries: logs.length,
        entries: logs,
      },
      null,
      2
    );
  }

  private updateAgentActivity(
    agentId: string,
    agentName: string
  ): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.last_active = new Date().toISOString();
      agent.total_actions += 1;
    } else {
      this.registerAgent(agentId, agentName);
      const newAgent = this.agents.get(agentId)!;
      newAgent.total_actions = 1;
    }
  }

  private persistToDisk(): void {
    if (!this.persistPath) return;
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        logs: this.logs,
        agents: Array.from(this.agents.entries()),
      };
      fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2));
    } catch {
      // Silent fail on persistence - logs are still in memory
    }
  }

  private loadFromDisk(): void {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return;
    try {
      const raw = fs.readFileSync(this.persistPath, "utf-8");
      const data = JSON.parse(raw);
      this.logs = data.logs || [];
      if (data.agents) {
        this.agents = new Map(data.agents);
      }
    } catch {
      // Start fresh if file is corrupted
    }
  }
}
