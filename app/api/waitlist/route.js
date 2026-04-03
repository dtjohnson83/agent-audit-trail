import { NextResponse } from "next/server";
import { writeFileSync, existsSync, readFileSync } from "fs";
export async function POST(req) {
    try {
        const { email } = await req.json();
        if (!email || !email.includes("@")) {
            return NextResponse.json({ error: "Invalid email" }, { status: 400 });
        }
        const filePath = "/tmp/waitlist.json";
        let emails = [];
        if (existsSync(filePath)) {
            try {
                emails = JSON.parse(readFileSync(filePath, "utf-8"));
            }
            catch {
                emails = [];
            }
        }
        if (!emails.includes(email)) {
            emails.push(email);
            writeFileSync(filePath, JSON.stringify(emails));
        }
        return NextResponse.json({ ok: true });
    }
    catch {
        return NextResponse.json({ ok: true });
    }
}
//# sourceMappingURL=route.js.map