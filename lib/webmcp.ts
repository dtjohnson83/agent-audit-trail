type McpTextContent = { type: "text"; text: string };

export type WebMcpToolResult = {
  content: McpTextContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

async function requestAuditedSummary(): Promise<Record<string, unknown>> {
  const response = await fetch("/api/webmcp/summary", { method: "POST" });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error || `Audit service returned HTTP ${response.status}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

export async function getAuditedWebSummary(): Promise<WebMcpToolResult> {
  try {
    const structuredContent = await requestAuditedSummary();
    return {
      content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown WebMCP error";
    return {
      isError: true,
      content: [{ type: "text", text: `Unable to retrieve the audited summary: ${message}` }],
    };
  }
}

