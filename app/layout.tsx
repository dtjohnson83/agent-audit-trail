import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Agent Audit - Immutable Audit Logging for AI Agents",
  description: "Compliance infrastructure for agentic AI. Immutable audit logging, policy enforcement, and compliance reporting via MCP.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
