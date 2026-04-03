import { NextRequest, NextResponse } from "next/server";

const waitlistEmails: string[] = [];

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (email && email.includes("@") && !waitlistEmails.includes(email)) {
      waitlistEmails.push(email);
    }
  } catch {}
  return NextResponse.json({ ok: true });
}
