import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Agent Audit - Compliance Infrastructure for Agentic AI",
  description: "Immutable audit logging, policy enforcement, and compliance reporting for AI agent workflows.",
  openGraph: {
    title: "AI Agent Audit",
    description: "Know what your AI agents did.",
    url: "https://aiagentaudit.dev",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet" />
      </head>
      <body style={{ background: "#000" }}>{children}</body>
    </html>
  );
}
