# Agent Audit Trail

**Compliance infrastructure for agentic AI.**

An MCP server that provides immutable audit logging, policy enforcement, and compliance reporting for AI agent workflows. Built for SMBs deploying AI agents who need to demonstrate regulatory compliance (Colorado SB 205, EU AI Act, and emerging state AI legislation).

## What It Does

Agent Audit Trail sits between your AI agents and their tools, providing:

- **Cryptographically Immutable Audit Logging** - Every agent action is recorded with full context and a SHA-256 hash chained to the previous entry. Tampering is detectable. Verification is one call away.

- **Policy Engine** - Configurable rules that evaluate every action in real time. Flag PII access, block high-value financial transactions, detect destructive database operations, or create custom rules for your business.

- **Compliance Reporting** - Export audit logs in formats suitable for regulatory submissions. Pre-built support for Colorado SB 205 impact assessments and EU AI Act transparency documentation. Exports include a chain integrity verification result.

- **Agent Registry** - Track which agents are active, what they do, and their historical activity patterns.

## Quick Start

### Install

```bash
npm install -g agent-audit-trail
```

### Add to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-audit-trail": {
      "command": "agent-audit-trail"
    }
  }
}
```

### Add to Claude Code

```bash
claude mcp add agent-audit-trail -- npx agent-audit-trail
```

## Available Tools

| Tool | Description |
|------|-------------|
| `log_action` | Log an agent action to the immutable audit trail |
| `query_logs` | Search and filter audit entries |
| `get_log_detail` | Get full details for a specific log entry |
| `get_summary` | Dashboard-style activity summary |
| `list_agents` | Show all registered agents |
| `register_agent` | Explicitly register a new agent |
| `list_policy_rules` | Show configured policy rules |
| `add_policy_rule` | Create a new policy rule |
| `toggle_policy_rule` | Enable or disable a rule |
| `verify_chain` | Verify the cryptographic integrity of the audit trail |
| `export_audit_log` | Export logs for compliance reporting |

## Default Policy Rules

Three rules are active out of the box:

1. **PII Field Access** (High) - Flags access to fields matching SSN, date of birth, email, phone, address, passport, driver license, or credit card patterns.

2. **High-Value Financial Action** (High) - Flags financial actions with amounts exceeding $1,000.

3. **Destructive Action Detection** (Critical) - Flags tool calls containing DELETE, DROP, TRUNCATE, or REMOVE operations.

## Cryptographic Immutability

Every log entry is chained to the previous one using SHA-256. Each entry stores:
- `previous_hash` — the hash of the entry before it (null for the first entry)
- `hash` — SHA-256 of: `previous_hash + all entry fields`

This means:
- Modifying any historical entry changes its hash, breaking the chain
- Deleting an entry leaves the next entry pointing to a hash that no longer exists
- You can verify the entire chain with `verify_chain` and get a definitive yes/no answer

Run `verify_chain` before exporting compliance reports to confirm the chain is intact. The export output includes the verification result.

## Example Usage

### Logging an action

```
Use the log_action tool:
- agent_name: "customer-support-bot"
- tool_name: "database_query"
- tool_action: "SELECT"
- parameters: {"query": "SELECT email, phone FROM customers WHERE id = 123"}
- data_fields_accessed: "email,phone"
```

The server will log the action and return any policy violations (in this case, the PII Field Access rule would flag the email and phone access).

### Querying the audit trail

```
Use the query_logs tool:
- has_violations: true
- limit: 10
```

### Adding a custom policy rule

```
Use the add_policy_rule tool:
- name: "Block External API Calls"
- description: "Block agents from calling external APIs without approval"
- condition_type: "tool_match"
- condition_operator: "contains"
- condition_value: "external_api"
- action: "block"
- severity: "high"
```

## Data Storage

Audit logs are stored locally at `~/.agent-audit-trail/audit-logs.json` by default with full hash chaining. Configure a custom path with the `AUDIT_DATA_DIR` environment variable.

**Production note:** Local JSON storage works for single-instance deployments. For multi-agent or distributed setups, swap to Supabase/PostgreSQL for scalable, cloud-hosted storage with the same hash chain guarantees (documentation coming soon).

## Regulatory Context

This tool helps businesses demonstrate compliance with:

- **Colorado SB 205** (effective Feb 2026) - Requires impact assessments and consumer notifications for AI-driven consequential decisions
- **EU AI Act** (high-risk enforcement Aug 2026) - Requires transparency, documentation, and human oversight for AI in critical sectors
- **Emerging US state AI legislation** - Multiple states have pending AI governance requirements

**Note:** Agent Audit Trail provides logging and reporting infrastructure. It does not constitute legal compliance certification. Consult legal counsel for your compliance program.

## Built By

[DANZUS Holdings LLC](https://danzusholdings.com)

## License

MIT
