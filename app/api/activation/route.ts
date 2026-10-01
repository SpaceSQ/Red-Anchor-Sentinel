import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const pending = new Map<string, { code: string; expires: number }>();

function cleanEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120;
}

export async function POST(request: Request) {
  const body = (await request.json()) as { action?: string; email?: string; code?: string };
  const email = cleanEmail(body.email);
  if (!validEmail(email)) return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  if (body.action === "send") {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    pending.set(email, { code, expires: Date.now() + 10 * 60 * 1000 });
    console.log(`[red-anchor] 核验码 ${email} ${code}`);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "verify") {
    const code = String(body.code || "").replace(/\D/g, "");
    const row = pending.get(email);
    if (!row || row.expires < Date.now() || row.code !== code) {
      return NextResponse.json({ error: "核验码不正确或已过期" }, { status: 400 });
    }
    pending.delete(email);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
