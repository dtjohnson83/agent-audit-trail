"use client";

import { useEffect } from "react";
import { getAuditedWebSummary } from "@/lib/webmcp";

export default function WebMcpProvider() {
  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) return;

    const controller = new AbortController();

    void modelContext.registerTool(
      {
        name: "get_audit_summary",
        title: "Get Agent Audit Trail summary",
        description:
          "Return aggregate Agent Audit Trail activity and create a tamper-evident audit record of this WebMCP invocation. This read-only tool does not return individual log entries or personal data.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
        execute: getAuditedWebSummary,
      },
      { signal: controller.signal },
    );

    return () => controller.abort();
  }, []);

  return null;
}

