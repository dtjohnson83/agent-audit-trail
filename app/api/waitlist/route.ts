import { NextRequest, NextResponse } from "next/server";

// In-memory store (resets on cold start — fine for gauging interest)
const emails = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const normalized = email.toLowerCase().trim();
    if (emails.has(normalized)) {
      return NextResponse.json({ success: true, duplicate: true });
    }

    emails.add(normalized);
    console.log(`[waitlist] New signup: ${normalized} (total: ${emails.size})`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[waitlist] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ count: emails.size });
}
