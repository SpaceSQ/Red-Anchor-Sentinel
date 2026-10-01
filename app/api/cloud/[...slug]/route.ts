import { NextResponse } from "next/server";
import {
  acceptPrivacy,
  adminOk,
  allFeedback,
  allTickets,
  bindDid,
  checkAdminPassword,
  createTicket,
  fleetOverview,
  listBroadcasts,
  listTickets,
  publishBroadcast,
  recordHeartbeat,
  replyTicket,
  saveFeedback,
  sendCode,
  setRelease,
  verifyCode,
  adminToken,
} from "@/server/cloud";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "母港没有完成这次请求";
  return NextResponse.json({ error: message }, { status: 400 });
}

function pathOf(request: Request, slug: string[]) {
  return slug.join("/") || new URL(request.url).pathname.replace(/^.*\/api\/cloud\//, "");
}

export async function POST(request: Request, context: { params: { slug: string[] } }) {
  const name = pathOf(request, context.params.slug);
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (name === "send-code") {
      const delivery = await sendCode(String(body.email || ""), body.privacy === true);
      return NextResponse.json({ ok: true, delivery });
    }
    if (name === "verify-code") {
      const user = verifyCode(String(body.email || ""), String(body.code || ""), String(body.username || ""), body.privacy === true);
      return NextResponse.json({ ok: true, ...user });
    }
    if (name === "bind-did") {
      bindDid(String(body.email || ""), String(body.s2Did || ""));
      return NextResponse.json({ ok: true });
    }
    if (name === "consent") {
      if (body.privacy !== true) return NextResponse.json({ error: "请先勾选隐私与遥测协议" }, { status: 400 });
      acceptPrivacy(String(body.email || ""), String(body.username || ""));
      return NextResponse.json({ ok: true });
    }
    if (name === "heartbeat") {
      const update = recordHeartbeat({
        s2Did: String(body.s2Did || ""),
        version: String(body.version || ""),
        uptimeSec: Number(body.uptimeSec || 0),
        faultCodes: body.faultCodes,
        currentVersion: String(body.version || ""),
      });
      return NextResponse.json(update);
    }
    if (name === "tickets") {
      const ticket = createTicket({
        email: String(body.email || ""),
        s2Did: String(body.s2Did || ""),
        subject: String(body.subject || ""),
        description: String(body.description || ""),
        severity: String(body.severity || ""),
      });
      return NextResponse.json(ticket);
    }
    if (name === "tickets/reply") {
      replyTicket(String(body.id || ""), String(body.body || ""), "user", String(body.email || ""));
      return NextResponse.json({ ok: true });
    }
    if (name === "feedback") {
      saveFeedback({
        kind: String(body.kind || ""),
        name: String(body.name || ""),
        email: String(body.email || ""),
        subject: String(body.subject || ""),
        content: String(body.content || ""),
      });
      return NextResponse.json({ ok: true });
    }
    if (name === "admin/login") {
      if (!checkAdminPassword(String(body.password || ""))) return NextResponse.json({ error: "口令不正确" }, { status: 401 });
      const response = NextResponse.json({ ok: true });
      response.cookies.set("ra_fleet", adminToken(), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86_400 });
      return response;
    }
    if (!adminOk(request.headers.get("cookie"))) return NextResponse.json({ error: "需要母港口令" }, { status: 401 });
    if (name === "admin/reply") {
      replyTicket(String(body.id || ""), String(body.body || ""), "admin");
      return NextResponse.json({ ok: true });
    }
    if (name === "admin/release") {
      setRelease(String(body.version || ""), String(body.downloadUrl || ""));
      return NextResponse.json({ ok: true });
    }
    if (name === "broadcasts") {
      return NextResponse.json(publishBroadcast({ title: String(body.title || ""), severity: String(body.severity || ""), content: String(body.content || "") }));
    }
    return NextResponse.json({ error: "未知母港路径" }, { status: 404 });
  } catch (error) {
    return fail(error);
  }
}

export async function GET(request: Request, context: { params: { slug: string[] } }) {
  const name = pathOf(request, context.params.slug);
  try {
    if (name === "tickets") {
      const email = new URL(request.url).searchParams.get("email") || "";
      return NextResponse.json({ tickets: listTickets(email) });
    }
    if (name === "broadcasts") return NextResponse.json({ broadcasts: listBroadcasts() });
    if (!adminOk(request.headers.get("cookie"))) return NextResponse.json({ error: "需要母港口令" }, { status: 401 });
    if (name === "admin/overview") return NextResponse.json(fleetOverview());
    if (name === "admin/tickets") return NextResponse.json({ tickets: allTickets() });
    if (name === "admin/feedback") return NextResponse.json({ feedbacks: allFeedback() });
    return NextResponse.json({ error: "未知母港路径" }, { status: 404 });
  } catch (error) {
    return fail(error);
  }
}
