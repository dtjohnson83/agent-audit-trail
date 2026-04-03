/**
 * Agent Audit Trail - Log Store
 * Immutable audit log storage.
 * MVP uses in-memory + JSON file persistence.
 * Production swaps to Supabase/PostgreSQL.
 */
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
export class LogStore {
    logs = [];
    agents = new Map();
    persistPath;
    constructor(persistPath) {
        this.persistPath = persistPath || null;
        if (this.persistPath) {
            this.loadFromDisk();
        }
    }
    /**
     * Write an immutable log entry. Once written, entries cannot be
     * modified or deleted (compliance requirement).
     */
    writeLog(entry) {
        const fullEntry = {
            ...entry,
            id: uuidv4(),
            timestamp: new Date().toISOString(),
        };
        this.logs.push(fullEntry);
        this.updateAgentActivity(entry.agent_id, entry.agent_name);
        this.persistToDisk();
        return fullEntry;
    }
    /**
     * Query logs with filtering options.
     */
    queryLogs(options = {}) {
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
            results = results.filter((l) => l.timestamp >= options.start_date);
        }
        if (options.end_date) {
            results = results.filter((l) => l.timestamp <= options.end_date);
        }
        // Sort newest first
        results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const offset = options.offset || 0;
        const limit = options.limit || 50;
        return results.slice(offset, offset + limit);
    }
    /**
     * Get a single log entry by ID.
     */
    getLog(id) {
        return this.logs.find((l) => l.id === id);
    }
    /**
     * Generate summary statistics.
     */
    getSummary() {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const todayLogs = this.logs.filter((l) => l.timestamp >= todayStart);
        const todayViolations = todayLogs.filter((l) => l.policy_violations.length > 0);
        const todayBlocked = todayLogs.filter((l) => l.response_status === "blocked");
        // Top tools by usage
        const toolCounts = new Map();
        for (const log of this.logs) {
            toolCounts.set(log.tool_name, (toolCounts.get(log.tool_name) || 0) + 1);
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
        const activeAgents = Array.from(this.agents.values()).filter((a) => a.status === "active");
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
    registerAgent(id, name, description = "") {
        const existing = this.agents.get(id);
        const agent = {
            id,
            name,
            description,
            registered_at: existing?.registered_at || new Date().toISOString(),
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
    listAgents() {
        return Array.from(this.agents.values());
    }
    /**
     * Export logs as JSON for compliance reporting.
     */
    exportLogs(options = {}) {
        const logs = this.queryLogs({ ...options, limit: 999999 });
        return JSON.stringify({
            export_timestamp: new Date().toISOString(),
            export_version: "1.0",
            total_entries: logs.length,
            entries: logs,
        }, null, 2);
    }
    updateAgentActivity(agentId, agentName) {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.last_active = new Date().toISOString();
            agent.total_actions += 1;
        }
        else {
            this.registerAgent(agentId, agentName);
            const newAgent = this.agents.get(agentId);
            newAgent.total_actions = 1;
        }
    }
    persistToDisk() {
        if (!this.persistPath)
            return;
        try {
            const dir = path.dirname(this.persistPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const data = {
                logs: this.logs,
                agents: Array.from(this.agents.entries()),
            };
            fs.writeFileSync(this.persistPath, JSON.stringify(data));
        }
        catch {
            // Silent fail on persistence - logs are still in memory
        }
    }
    loadFromDisk() {
        if (!this.persistPath || !fs.existsSync(this.persistPath))
            return;
        try {
            const raw = fs.readFileSync(this.persistPath, "utf-8");
            const data = JSON.parse(raw);
            this.logs = data.logs || [];
            if (data.agents) {
                this.agents = new Map(data.agents);
            }
        }
        catch {
            // Start fresh if file is corrupted
        }
    }
}
//# sourceMappingURL=log-store.js.map