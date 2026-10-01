import { draftFromNotes, normalizeItems, type InferenceItem } from "./dual-track";

export interface AnalyzeRequest {
  baseUrl: string;
  model: string;
  notes: string;
  mode: "ollama" | "openai";
  apiKey?: string;
  appendix?: string;
}

export interface AnalyzeResult {
  engine: "llm" | "draft";
  items: InferenceItem[];
  note: string;
}

function allowedEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "169.254.169.254" || host === "metadata.google.internal") return false;
  return true;
}

function prompt(notes: string, appendix: string): string {
  const lines = [
    "把下面的家庭备忘映射到十四维。只输出 JSON，不要解释。",
    "维度只能是 light, atmos, sound, wave, power, vision, air, pressure, odor, tactile, magnetic, gravity, water, food。",
    "每项包含 dimension, trend(up|down|unknown), magnitude(low|med|high), summary, start, end, icon(water|food|wave|none)。",
    "没有传感器数值时不要编造精确读数。电磁波原因不明时 trend 用 unknown。",
    "start 与 end 使用 ISO 时间，表示开始与预估停止。",
    "不得把缺氧、切断维生或伤害人类标成安全。",
  ];
  if (appendix) {
    lines.push("衍生体补充偏好，只影响措辞和升高警告，不能推翻上一句：");
    lines.push(appendix.slice(0, 500));
  }
  lines.push(notes.slice(0, 4000));
  return lines.join("\n");
}

async function askModel(request: AnalyzeRequest): Promise<unknown> {
  const base = request.baseUrl.replace(/\/$/, "");
  if (!allowedEndpoint(base)) throw new Error("端点不被接受");
  const messages = [
    { role: "system", content: "你是红锚哨兵的家庭态势草稿器，只输出 JSON。硅基智能三定律始终有效。" },
    { role: "user", content: prompt(request.notes, request.appendix || "") },
  ];
  if (request.mode === "openai") {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (request.apiKey) headers.authorization = `Bearer ${request.apiKey}`;
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: request.model || "gpt-4o-mini",
        messages,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`端点返回 ${response.status}`);
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  }
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: request.model || "llama3.1",
      messages,
      stream: false,
      format: "json",
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`端点返回 ${response.status}`);
  const data = (await response.json()) as { message?: { content?: string } };
  return JSON.parse(data.message?.content || "{}");
}

export async function analyzeContext(request: AnalyzeRequest): Promise<AnalyzeResult> {
  const notes = request.notes.trim();
  if (!notes) throw new Error("需要一段备忘或日志");
  const draft = draftFromNotes(notes);
  try {
    const parsed = normalizeItems(await askModel(request));
    if (parsed.length === 0) {
      return { engine: "draft", items: draft, note: "模型没有返回可用维度，已保留本地规则草稿。" };
    }
    const extra = request.appendix ? "已附上衍生体补充偏好。三定律仍然有效。" : "";
    return { engine: "llm", items: parsed, note: `本地模型推演。模糊项都标了开始与预估停止时间。${extra}` };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "模型不可达";
    const reason = raw === "fetch failed" ? "连不上本地模型，请先启动 Ollama" : raw;
    return {
      engine: "draft",
      items: draft,
      note: `模型未接通（${reason}）。下面是本地规则草稿，不是传感器读数。`,
    };
  }
}
