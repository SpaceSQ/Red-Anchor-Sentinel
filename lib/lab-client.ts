import { inDesktopShell } from "@/lib/desktop-nav";
import type { LabProfile } from "@/lib/lab-rules";

const OPS = {
  list: "labList",
  active: "labActive",
  create: "labCreate",
  save: "labSave",
  publish: "labPublish",
  clear: "labClear",
} as const;

export type LabAction = keyof typeof OPS;

function readable(error: unknown): Error {
  const message = error instanceof Error ? error.message : "";
  if (/expected pattern|Unexpected token|Unexpected end|JSON/i.test(message)) {
    return new Error("实验室接口没有返回档案");
  }
  return error instanceof Error ? error : new Error("实验室没有完成这次操作");
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) throw new Error("实验室接口没有返回档案");
  let data: T & { error?: string };
  try {
    data = JSON.parse(text) as T & { error?: string };
  } catch (error) {
    throw readable(error);
  }
  if (!response.ok) throw new Error(data.error || "实验室没有完成这次操作");
  return data;
}

export async function labCall<T>(action: LabAction, body: Record<string, unknown> = {}): Promise<T> {
  if (inDesktopShell()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<T>("host_op", { op: OPS[action], body });
    } catch (error) {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : "实验室没有完成这次操作";
      throw new Error(message);
    }
  }
  if (action === "list" || action === "active") {
    const query = action === "active" ? "/api/lab?view=active" : "/api/lab";
    return readJson<T>(await fetch(query));
  }
  return readJson<T>(
    await fetch("/api/lab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    }),
  );
}

export type { LabProfile };
