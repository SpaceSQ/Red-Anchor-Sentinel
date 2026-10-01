import { NextResponse } from "next/server";
import { activeProfile, clearActive, createProfile, listProfiles, publishProfile, saveProfile } from "@/server/lab-store";
import type { LabProfile } from "@/lib/lab-rules";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const view = new URL(request.url).searchParams.get("view");
  if (view === "active") return NextResponse.json({ profile: activeProfile() });
  return NextResponse.json(listProfiles());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action?: string; customName?: string; profile?: LabProfile; id?: string };
    if (body.action === "create") return NextResponse.json({ profile: createProfile(String(body.customName || "")) });
    if (body.action === "save") return NextResponse.json({ profile: saveProfile(body.profile as LabProfile) });
    if (body.action === "publish") return NextResponse.json(publishProfile(String(body.id || "")));
    if (body.action === "clear") {
      clearActive();
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "未知实验室操作" }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "实验室没有保存";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
