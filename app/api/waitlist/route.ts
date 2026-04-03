import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const filePath = "/tmp/waitlist.json";
    let emails: string[] = [];
    if (existsSync(filePath)) {
      try {
        emails = JSON.parse(readFileSync(filePath, "utf-8"));
      } catch {
        emails = [];
      }
    }
    if (!emails.includes(email)) {
      emails.push(email);
      writeFileSync(filePath, JSON.stringify(emails));
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
