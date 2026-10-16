"use client";

import { useState } from "react";
import { fetchWormWatch, promoteWormSign, type WormReport } from "@/lib/host-client";
import { useI18n } from "@/lib/i18n";

export function WormWatch() {
  const { t, lang } = useI18n();
  const [report, setReport] = useState<WormReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    try {
      setReport(await fetchWormWatch());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("worm.fail"));
    } finally {
      setBusy(false);
    }
  }

  async function promote(id: string) {
    setBusy(true);
    setError("");
    try {
      await promoteWormSign(id);
      setReport(await fetchWormWatch());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("worm.fail"));
    } finally {
      setBusy(false);
    }
  }

  const severity = report?.severity || "clear";

  return (
    <section className="panel px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h2 className="font-display text-sm tracking-[0.16em] text-red-200">{t("worm.title")}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">{t("worm.lead")}</p>
        </div>
        <button type="button" disabled={busy} onClick={() => void run()} className="min-h-11 shrink-0 whitespace-nowrap border border-red-800 px-4 text-sm text-red-100 disabled:opacity-60">
          {busy ? t("worm.scanning") : t("worm.scan")}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-amber-300">{error}</p> : null}
      {report ? (
        <div className="mt-3 grid gap-2">
          <p className="font-mono text-[11px] text-slate-300">
            <span className={severity === "critical" ? "text-red-300" : severity === "clear" ? "text-emerald-300" : "text-amber-200"}>
              {t(`worm.severity.${severity}`)}
            </span>
            {" · "}
            {t("worm.generation", {
              n: report.rsi.generation,
              builtin: report.rsi.builtin,
              added: report.rsi.added,
              drafts: report.rsi.drafts,
            })}
          </p>
          {report.findings.length === 0 ? <p className="text-sm text-slate-500">{t("worm.clear")}</p> : null}
          <ul className="grid gap-2">
            {report.findings.map((item) => (
              <li key={`${item.id}-${item.evidence}`} className="border border-slate-800 px-3 py-2">
                <p className="text-sm text-slate-100">{t(`worm.stage.${item.stage}`)} · {lang === "zh" ? item.titleZh || item.title : item.title}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">{item.evidence}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{lang === "zh" ? item.noteZh || item.note : item.note}</p>
              </li>
            ))}
          </ul>
          <div>
            <p className="text-xs tracking-[0.12em] text-slate-500">{t("worm.drafts")}</p>
            {report.drafts.length === 0 ? <p className="mt-1 text-sm text-slate-500">{t("worm.emptyDrafts")}</p> : null}
            <ul className="mt-1 grid gap-2">
              {report.drafts.map((draft) => (
                <li key={draft.id} className="flex flex-wrap items-center justify-between gap-2 border border-slate-800 px-3 py-2">
                  <div>
                    <p className="text-sm">{t(`worm.stage.${draft.stage}`)} · {lang === "zh" ? draft.titleZh || draft.title : draft.title}</p>
                    <p className="text-xs text-slate-500">{lang === "zh" ? draft.noteZh || draft.note : draft.note}</p>
                  </div>
                  <button type="button" disabled={busy} onClick={() => void promote(draft.id)} className="min-h-10 border border-slate-600 px-3 text-xs disabled:opacity-60">
                    {t("worm.promote")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
