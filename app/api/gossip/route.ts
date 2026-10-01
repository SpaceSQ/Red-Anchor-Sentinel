import dgram from "node:dgram";
import { NextResponse } from "next/server";
import { isValidDid } from "@/lib/did";

export const dynamic = "force-dynamic";

const PORT = 47655;
const GROUP = "239.255.77.77";

interface GossipNote {
  sourceDid: string;
  targetDid: string;
  targetId: string;
  level: "SAFE" | "WARNING" | "CRITICAL";
  note: string;
}

const bag = globalThis as typeof globalThis & {
  redAnchorInbox?: GossipNote[];
  redAnchorSock?: dgram.Socket;
};

function inbox() {
  if (!bag.redAnchorInbox) bag.redAnchorInbox = [];
  return bag.redAnchorInbox;
}

function remember(note: GossipNote) {
  const list = inbox();
  list.unshift(note);
  bag.redAnchorInbox = list.slice(0, 30);
}

function clean(body: Partial<GossipNote>): GossipNote | null {
  const sourceDid = String(body.sourceDid || "");
  const targetDid = String(body.targetDid || "");
  if (!isValidDid(sourceDid)) return null;
  if (targetDid && !isValidDid(targetDid)) return null;
  const level = body.level === "CRITICAL" || body.level === "WARNING" || body.level === "SAFE" ? body.level : null;
  if (!level) return null;
  const note = String(body.note || "")
    .replace(/[0-9]{1,3}(?:\.[0-9]{1,3}){3}/g, "")
    .replace(/[0-9a-f]{2}(?::[0-9a-f]{2}){5}/gi, "")
    .slice(0, 140);
  return { sourceDid, targetDid, targetId: String(body.targetId || "").slice(0, 40), level, note };
}

function listen() {
  if (bag.redAnchorSock) return;
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  socket.on("message", (msg) => {
    try {
      const parsed = JSON.parse(msg.toString("utf8")) as Partial<GossipNote>;
      const note = clean(parsed);
      if (note) remember(note);
    } catch {
      /* ignore malformed packets */
    }
  });
  socket.on("error", () => {
    bag.redAnchorSock = undefined;
  });
  socket.bind(PORT, () => {
    try {
      socket.addMembership(GROUP);
    } catch {
      /* unicast receive still works */
    }
  });
  bag.redAnchorSock = socket;
}

export async function GET() {
  listen();
  const critical = inbox().filter((item) => item.level === "CRITICAL");
  return NextResponse.json({ notes: inbox(), vetoIds: critical.map((item) => item.targetId).filter(Boolean), vetoDids: critical.map((item) => item.targetDid).filter(Boolean) });
}

export async function POST(request: Request) {
  listen();
  const note = clean((await request.json()) as Partial<GossipNote>);
  if (!note) return NextResponse.json({ error: "判决缺少有效身份编号" }, { status: 400 });
  const packet = Buffer.from(JSON.stringify(note));
  const socket = bag.redAnchorSock;
  if (socket) {
    socket.send(packet, PORT, GROUP);
  }
  remember(note);
  return NextResponse.json({ ok: true });
}
