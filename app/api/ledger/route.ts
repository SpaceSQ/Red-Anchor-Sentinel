import { NextResponse } from "next/server";
import { appendBlock, assertPayload, getChain } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function GET() {
  const chain = await getChain();
  return NextResponse.json({ chain });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = assertPayload(body);
    const block = await appendBlock(payload);
    return NextResponse.json({ block });
  } catch (error) {
    const message = error instanceof Error ? error.message : "记账失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
