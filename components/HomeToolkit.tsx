"use client";

import { useEffect, useState } from "react";
import { CommercialNote } from "@/components/CommercialNote";
import { useLabSkin } from "@/components/LabTheme";
import { useI18n } from "@/lib/i18n";
import type { LabRules } from "@/lib/lab-rules";
import { assess } from "@/lib/assess";
import { isValidDid } from "@/lib/did";
import { downloadText, fleetCsv, redact, simplePdf } from "@/lib/desk-tools";
import type { AgentProfile } from "@/lib/fleet";

const PROMPT_KEY = "red-anchor-prompt";
const ACCENT_KEY = "red-anchor-accent";
const INTERVAL_KEY = "red-anchor-interval";

export function plainLine(
  fleet: AgentProfile[],
  rules: LabRules | null | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (fleet.length === 0) return t("home.none");
  const danger = fleet.filter((agent) => {
    if (!agent.s2Did || !isValidDid(agent.s2Did)) return false;
    const report = assess(agent.tensor, agent.intents, "UNPATCHED", rules);
    return report.carbon === "CRITICAL" || report.silicon === "CRITICAL";
  });
  const unsigned = fleet.filter((agent) => !agent.s2Did || !isValidDid(agent.s2Did));
  if (danger[0]) return t("home.danger", { name: danger[0].name });
  if (unsigned[0]) return t("home.yellow", { count: unsigned.length });
  return t("home.ok");
}

export function HomeToolkit({
  fleet,
  sourceDid,
  scanning,
  onScan,
  onOpen,
  scanLocked,
}: {
  fleet: AgentProfile[];
  sourceDid: string;
  scanning: boolean;
  onScan: () => Promise<void>;
  onOpen: (id: string) => void;
  scanLocked: boolean;
}) {
  const labRules = useLabSkin().rules;
  const { t } = useI18n();
  const [speech, setSpeech] = useState(() => plainLine(fleet, labRules, t));
  const [repairNote, setRepairNote] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [prompt, setPrompt] = useState("");
  const [minutes, setMinutes] = useState("0");
  const [accent, setAccent] = useState("red");

  useEffect(() => {
    setSpeech(plainLine(fleet, labRules, t));
  }, [fleet, labRules, t]);

  useEffect(() => {
    const storedPrompt = window.localStorage.getItem(PROMPT_KEY) || "";
    const storedMinutes = window.localStorage.getItem(INTERVAL_KEY) || "0";
    const storedAccent = window.localStorage.getItem(ACCENT_KEY) || "red";
    setPrompt(storedPrompt);
    setMinutes(storedMinutes);
    setAccent(storedAccent);
    document.body.dataset.accent = storedAccent;
  }, []);

  useEffect(() => {
    const gap = Number(minutes);
    if (!Number.isFinite(gap) || gap < 5 || scanLocked) return;
    const timer = window.setInterval(() => {
      void onScan();
    }, gap * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [minutes, onScan, scanLocked]);

  const critical = fleet.filter((agent) => {
    if (!isValidDid(agent.s2Did)) return false;
    const report = assess(agent.tensor, agent.intents, "UNPATCHED", labRules);
    return report.carbon === "CRITICAL" || report.silicon === "CRITICAL";
  }).length;
  const unsigned = fleet.filter((agent) => !isValidDid(agent.s2Did)).length;
  const calm = Math.max(fleet.length - critical - unsigned, 0);

  async function repair() {
    const targets = fleet.filter((agent) => !isValidDid(agent.s2Did)).slice(0, 8);
    for (const agent of targets) {
      await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "ISOLATE",
          sourceDid,
          targetDid: "",
          sourceU6a: "",
          targetU6a: agent.u6a,
          note: `一键标记隔离 ${agent.name}。只写入本机账本，没有向该设备下发指令。`,
          carbon: "UNMEASURED",
          silicon: "UNMEASURED",
          patchStatus: "UNPATCHED",
          matrix: [],
        }),
      });
    }
    setRepairNote(targets.length ? `已把 ${targets.length} 个未亮明身份的信号记入隔离账本。有金印的设备仍要你自己拉闸刀。` : "没有需要标记的未亮明信号。");
    if (targets[0]) onOpen(targets[0].id);
  }

  function exportReport() {
    const pdf = simplePdf("Red Anchor Sentinel", [
      `nodes ${fleet.length}`,
      `critical ${critical}`,
      `unsigned ${unsigned}`,
      `calm ${calm}`,
      "freeware trial",
    ]);
    downloadText("red-anchor-report.pdf", pdf, "application/pdf");
  }

  return (
    <section className="space-y-3">
      <div className="panel flex flex-wrap items-center gap-3 p-4">
        <button type="button" disabled={scanning || scanLocked} onClick={() => void onScan().then(() => setSpeech(plainLine(fleet, labRules, t)))} className="min-h-14 bg-anchor px-6 font-display text-lg tracking-[0.14em] text-white disabled:opacity-50">
          {scanning ? t("home.checking") : t("home.check")}
        </button>
        <button type="button" onClick={() => void repair()} className="min-h-14 border border-amber-600 px-4 text-amber-100">
          {t("home.isolate")}
        </button>
        <p className="max-w-xl text-sm leading-6 text-slate-200">{speech}</p>
      </div>
      {repairNote ? <p className="text-sm text-amber-200">{repairNote}</p> : null}
      <div className="grid grid-cols-3 gap-2 text-center">
        <p className="border border-red-900 px-2 py-3"><span className="block font-display text-2xl text-red-300">{critical}</span><span className="text-xs text-slate-400">{t("home.critical")}</span></p>
        <p className="border border-amber-800 px-2 py-3"><span className="block font-display text-2xl text-amber-200">{unsigned}</span><span className="text-xs text-slate-400">{t("home.unsigned")}</span></p>
        <p className="border border-green-900 px-2 py-3"><span className="block font-display text-2xl text-safe">{calm}</span><span className="text-xs text-slate-400">{t("home.calm")}</span></p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-10 border border-slate-600 px-3 text-sm" onClick={() => downloadText("red-anchor-fleet.csv", fleetCsv(fleet), "text/csv")}>导出 CSV</button>
        <button type="button" className="min-h-10 border border-slate-600 px-3 text-sm" onClick={() => downloadText("red-anchor-fleet.json", JSON.stringify(fleet.map((agent) => ({ name: agent.name, tier: agent.tier, vendor: redact(agent.vendor || ""), purpose: redact(agent.purpose || agent.sandboxNote) })), null, 2), "application/json")}>导出 JSON</button>
        <button type="button" className="min-h-10 border border-slate-600 px-3 text-sm" onClick={exportReport}>导出 PDF 摘要</button>
        <button type="button" className="min-h-10 border border-slate-600 px-3 text-sm" onClick={() => setFeedbackOpen(true)}>极客反馈</button>
        <button type="button" className="min-h-10 border border-slate-600 px-3 text-sm" onClick={() => setSettingsOpen((open) => !open)}>高级设置</button>
      </div>
      {settingsOpen ? (
        <div className="panel space-y-2 p-3">
          <label className="block text-xs text-slate-400">
            附加推理提示
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm" />
          </label>
          <label className="block text-xs text-slate-400">
            自动体检间隔（分钟，0 为关闭，最少 5）
            <input value={minutes} onChange={(event) => setMinutes(event.target.value.replace(/[^\d]/g, "").slice(0, 3))} className="mt-1 w-24 border border-slate-700 bg-slate-950 px-2 py-2 font-mono text-sm" />
          </label>
          <div className="flex gap-2">
            {(["red", "amber", "green"] as const).map((item) => (
              <button key={item} type="button" onClick={() => { setAccent(item); document.body.dataset.accent = item; }} className={`min-h-10 border px-3 text-sm ${accent === item ? "border-anchor text-red-200" : "border-slate-700"}`}>
                {item === "red" ? "锚红" : item === "amber" ? "警戒黄" : "安全绿"}
              </button>
            ))}
          </div>
          <button type="button" className="min-h-10 bg-anchor px-3 text-sm text-white" onClick={() => { window.localStorage.setItem(PROMPT_KEY, prompt.slice(0, 400)); window.localStorage.setItem(INTERVAL_KEY, minutes || "0"); window.localStorage.setItem(ACCENT_KEY, accent); setSettingsOpen(false); }}>
            保存设置
          </button>
        </div>
      ) : null}
      {feedbackOpen ? (
        <div className="panel space-y-2 p-3">
          <p className="text-sm text-slate-300">建议留在本机导出文件里。页面不会把日志自动寄出。</p>
          <textarea value={suggestion} onChange={(event) => setSuggestion(event.target.value)} rows={3} className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm" placeholder="扫描或补丁方面的建议" />
          <button
            type="button"
            className="min-h-10 border border-slate-600 px-3 text-sm"
            onClick={() => {
              const payload = {
                suggestion: redact(suggestion).slice(0, 500),
                nodes: fleet.map((agent) => ({ name: agent.name, tier: agent.tier, note: redact(agent.sandboxNote) })),
              };
              downloadText("red-anchor-feedback.json", JSON.stringify(payload, null, 2), "application/json");
            }}
          >
            导出脱敏日志
          </button>
          <button type="button" className="ml-2 min-h-10 border border-slate-600 px-3 text-sm" onClick={() => setFeedbackOpen(false)}>关闭</button>
        </div>
      ) : null}
      <CommercialNote />
    </section>
  );
}
