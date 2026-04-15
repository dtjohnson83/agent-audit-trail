import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://aiagentaudit.dev";
const SITE_NAME = "Agent Audit Trail";
const DESCRIPTION =
  "Compliance infrastructure for agentic AI. Immutable, cryptographically chained audit logs, real-time policy enforcement, and one-click compliance reporting for AI agents. Built for Colorado SB 205, the EU AI Act, and emerging US state AI legislation.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Agent Audit Trail — AI Agent Compliance, Audit Logging & Policy Enforcement",
    template: "%s | Agent Audit Trail",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  keywords: [
    "AI agent audit",
    "agent audit trail",
    "agentic AI compliance",
    "AI governance",
    "AI compliance software",
    "immutable audit log",
    "tamper-evident logging",
    "hash chain audit",
    "policy engine AI",
    "MCP server",
    "Model Context Protocol",
    "Colorado SB 205",
    "EU AI Act",
    "AI risk management",
    "AI observability",
    "LLM audit",
    "Claude Code MCP",
    "Anthropic MCP",
    "AI agent monitoring",
    "SOC 2 AI",
  ],
  authors: [{ name: "DANZUS Holdings LLC", url: "https://danzusholdings.com" }],
  creator: "DANZUS Holdings LLC",
  publisher: "DANZUS Holdings LLC",
  category: "technology",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "Agent Audit Trail — Compliance Infrastructure for Agentic AI",
    description:
      "Know what your AI agents did. Cryptographically immutable audit logs, real-time policy enforcement, and compliance reports for regulated industries.",
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Agent Audit Trail — Compliance Infrastructure for Agentic AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Agent Audit Trail — Compliance Infrastructure for Agentic AI",
    description:
      "Immutable audit logs, policy enforcement, and compliance reports for AI agents. Built for Colorado SB 205 and the EU AI Act.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
  other: {
    "ai-content-declaration": "human-authored",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0e" },
    { media: "(prefers-color-scheme: light)", color: "#0c0c0e" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// Structured data (JSON-LD) for SEO + GEO (AI/LLM citations).
// Multiple entity types exposed so search engines and LLM crawlers can
// extract organization, product, FAQ, and breadcrumb data cleanly.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}#organization`,
      name: "DANZUS Holdings LLC",
      url: "https://danzusholdings.com",
      logo: `${SITE_URL}/favicon.svg`,
      sameAs: [
        "https://danzusholdings.com",
        "https://github.com/dtjohnson83/agent-audit-trail",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: DESCRIPTION,
      publisher: { "@id": `${SITE_URL}#organization` },
      inLanguage: "en-US",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}#software`,
      name: "Agent Audit Trail",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "AI Governance & Compliance",
      operatingSystem: "Cross-platform (Node.js, Docker, MCP)",
      description: DESCRIPTION,
      url: SITE_URL,
      downloadUrl: "https://www.npmjs.com/package/agent-audit-trail",
      softwareVersion: "1.0.0",
      author: { "@id": `${SITE_URL}#organization` },
      publisher: { "@id": `${SITE_URL}#organization` },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description: "Free during early access",
      },
      featureList: [
        "Cryptographically immutable hash-chained audit logs",
        "Real-time policy engine with flag and block modes",
        "One-click compliance export (PDF, CSV) for auditors",
        "Agent registry and activity tracking",
        "Model Context Protocol (MCP) server compatible with Claude, Claude Code, Cline, and any MCP agent",
        "Self-hosted via Docker or Supabase/PostgreSQL",
        "Colorado SB 205 impact assessment support",
        "EU AI Act transparency documentation",
      ],
      keywords:
        "AI agent audit, AI compliance, MCP server, policy engine, immutable audit log, AI governance, Colorado SB 205, EU AI Act",
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "How is the audit log tamper-evident?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Every entry is cryptographically chained to the previous one using SHA-256. Any modification breaks the chain and is immediately detectable. Write access is restricted at the database level, and chain integrity is verified continuously.",
          },
        },
        {
          "@type": "Question",
          name: "Can I block AI agent actions, not just log them?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. The policy engine runs in two modes: Flag only (log and alert but let the action through) or Block (stop the action before it executes and alert your team). You can set different rules per agent and per tool.",
          },
        },
        {
          "@type": "Question",
          name: "What AI agents does Agent Audit Trail work with?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Agent Audit Trail registers as a Model Context Protocol (MCP) server — the same protocol OpenAI, Anthropic, and major agent frameworks use. It works with Claude, Claude Code, Cline, OpenClaw, and any MCP-compatible agent with no code changes required.",
          },
        },
        {
          "@type": "Question",
          name: "Where is the audit data stored?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Your audit logs live in your own Supabase or PostgreSQL database. You control the infrastructure end-to-end. DANZUS does not hold your data — the platform is the audit trail for your own systems.",
          },
        },
        {
          "@type": "Question",
          name: "Which regulations does Agent Audit Trail help with?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "It helps demonstrate compliance with Colorado SB 205 (effective February 2026) for consequential AI decisions, the EU AI Act (high-risk enforcement August 2026) for transparency and human oversight, and emerging US state AI legislation requiring audit trails and impact assessments.",
          },
        },
        {
          "@type": "Question",
          name: "Can I self-host Agent Audit Trail?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Run with Docker or 'npx agent-audit-trail' and point it at your own Supabase project. You control the infrastructure end-to-end.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="canonical" href={SITE_URL} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Geist:wght@100..900&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
