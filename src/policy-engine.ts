/**
 * Agent Audit Trail - Policy Engine
 * Evaluates configurable rules against agent actions.
 * Returns violations that should be logged, flagged, or used to block actions.
 */

import { v4 as uuidv4 } from "uuid";
import type { PolicyRule, PolicyCondition, PolicyViolation } from "./types.js";

export class PolicyEngine {
  private rules: Map<string, PolicyRule> = new Map();

  constructor() {
    this.loadDefaultRules();
  }

  /**
   * Evaluate all enabled rules against an incoming action.
   */
  evaluate(context: {
    tool_name: string;
    tool_action: string;
    parameters: Record<string, unknown>;
    data_fields_accessed: string[];
  }): PolicyViolation[] {
    const violations: PolicyViolation[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const triggered = this.checkCondition(rule.condition, context);
      if (triggered) {
        violations.push({
          rule_id: rule.id,
          rule_name: rule.name,
          severity: rule.severity,
          action_taken: rule.action === "block" ? "blocked" : rule.action === "alert" ? "alerted" : "flagged",
          details: `Rule "${rule.name}" triggered: ${rule.description}`,
        });
      }
    }

    return violations;
  }

  /**
   * Check if any violation requires blocking the action.
   */
  shouldBlock(violations: PolicyViolation[]): boolean {
    return violations.some((v) => v.action_taken === "blocked");
  }

  /**
   * Add a new policy rule.
   */
  addRule(rule: Omit<PolicyRule, "id" | "created_at">): PolicyRule {
    const fullRule: PolicyRule = {
      ...rule,
      id: uuidv4(),
      created_at: new Date().toISOString(),
    };
    this.rules.set(fullRule.id, fullRule);
    return fullRule;
  }

  /**
   * Update an existing rule.
   */
  updateRule(id: string, updates: Partial<PolicyRule>): PolicyRule | null {
    const rule = this.rules.get(id);
    if (!rule) return null;
    const updated = { ...rule, ...updates, id: rule.id };
    this.rules.set(id, updated);
    return updated;
  }

  /**
   * Remove a rule.
   */
  removeRule(id: string): boolean {
    return this.rules.delete(id);
  }

  /**
   * List all rules.
   */
  listRules(): PolicyRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get a single rule.
   */
  getRule(id: string): PolicyRule | undefined {
    return this.rules.get(id);
  }

  private checkCondition(
    condition: PolicyCondition,
    context: {
      tool_name: string;
      tool_action: string;
      parameters: Record<string, unknown>;
      data_fields_accessed: string[];
    }
  ): boolean {
    switch (condition.type) {
      case "tool_match":
        return this.matchValue(context.tool_name, condition.operator, condition.value);

      case "parameter_match":
        if (!condition.field) return false;
        const paramValue = this.getNestedValue(context.parameters, condition.field);
        if (paramValue === undefined) return false;
        return this.matchValue(String(paramValue), condition.operator, condition.value);

      case "data_field_match":
        return context.data_fields_accessed.some((field) =>
          this.matchValue(field, condition.operator, condition.value)
        );

      case "threshold":
        if (!condition.field) return false;
        const numValue = Number(this.getNestedValue(context.parameters, condition.field));
        if (isNaN(numValue)) return false;
        return this.matchValue(numValue, condition.operator, condition.value);

      default:
        return false;
    }
  }

  private matchValue(
    actual: string | number,
    operator: PolicyCondition["operator"],
    expected: string | number
  ): boolean {
    switch (operator) {
      case "equals":
        return String(actual).toLowerCase() === String(expected).toLowerCase();
      case "contains":
        return String(actual).toLowerCase().includes(String(expected).toLowerCase());
      case "greater_than":
        return Number(actual) > Number(expected);
      case "less_than":
        return Number(actual) < Number(expected);
      case "matches_regex":
        try {
          return new RegExp(String(expected), "i").test(String(actual));
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((current: unknown, key) => {
      if (current && typeof current === "object") {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Load sensible default rules that most compliance-aware businesses will want.
   */
  private loadDefaultRules(): void {
    // PII access detection
    this.addRule({
      name: "PII Field Access",
      description: "Flags when an agent accesses fields commonly associated with personally identifiable information.",
      enabled: true,
      condition: {
        type: "data_field_match",
        operator: "matches_regex",
        value: "(ssn|social_security|date_of_birth|dob|email|phone|address|passport|driver_license|credit_card)",
      },
      action: "flag",
      severity: "high",
    });

    // Financial threshold
    this.addRule({
      name: "High-Value Financial Action",
      description: "Flags financial actions exceeding $1,000.",
      enabled: true,
      condition: {
        type: "threshold",
        field: "amount",
        operator: "greater_than",
        value: 1000,
      },
      action: "flag",
      severity: "high",
    });

    // Database deletion detection
    this.addRule({
      name: "Destructive Action Detection",
      description: "Flags tool calls that appear to delete or drop data.",
      enabled: true,
      condition: {
        type: "parameter_match",
        field: "query",
        operator: "matches_regex",
        value: "(DELETE|DROP|TRUNCATE|REMOVE)",
      },
      action: "flag",
      severity: "critical",
    });
  }
}
