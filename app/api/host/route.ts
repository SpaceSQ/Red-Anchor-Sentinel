import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";
import { analyzeContext } from "@/lib/context-analyzer";
import { readAppendix } from "@/server/lab-store";

export const dynamic = "force-dynamic";

const OPS = new Set(["hardware", "scan", "saveVault", "loadVault", "writeOutbox", "probeLlm", "analyzeContext", "saveActivation", "askAlign", "readCard", "checkClamp"]);

function runHost(op: string, body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), "server", "host-cli.mjs"), op], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => {
      out += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      err += String(chunk);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(err.trim() || "驻留引擎失败"));
        return;
      }
      try {
        resolve(JSON.parse(out));
      } catch {
        reject(new Error("驻留引擎返回了无法解析的结果"));
      }
    });
    child.stdin.write(JSON.stringify(body ?? {}));
    child.stdin.end();
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      op?: string;
      baseUrl?: string;
      model?: string;
      notes?: string;
      mode?: string;
      apiKey?: string;
    };
    const op = String(body.op || "");
    if (!OPS.has(op)) return NextResponse.json({ error: "未知操作" }, { status: 400 });
    if (op === "analyzeContext") {
      const result = await analyzeContext({
        baseUrl: String(body.baseUrl || "http://127.0.0.1:11434"),
        model: String(body.model || ""),
        notes: String(body.notes || ""),
        mode: body.mode === "openai" ? "openai" : "ollama",
        apiKey: String(body.apiKey || ""),
        appendix: readAppendix(),
      });
      return NextResponse.json(result);
    }
    const result = await runHost(op, body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "驻留引擎失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
