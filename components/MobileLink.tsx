"use client";

import { useEffect, useState } from "react";
import { ensureMobileLink } from "@/lib/host-client";
import { hostRadarFrame } from "@/lib/mobile-radar";
import type { LabRules } from "@/lib/lab-rules";
import { useI18n } from "@/lib/i18n";

const CONTROL = "http://127.0.0.1:8788";

interface LinkStatus {
  host: string;
  port: number;
  nonce: string;
  qrDataUrl: string;
  pending: { address: string; at: string }[];
  mdns: boolean;
  fuseArmed: boolean;
  fuseNote: string;
  pushRegistered: boolean;
}

export function MobileLink({ rules }: { rules?: LabRules | null }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const response = await fetch(`${CONTROL}/status`);
        if (!response.ok) throw new Error(t("link.down"));
        const data = (await response.json()) as LinkStatus;
        if (stop) return;
        setStatus(data);
        setError("");
        await fetch(`${CONTROL}/radar`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(hostRadarFrame(rules)),
        });
      } catch {
        if (stop) return;
        try {
          await ensureMobileLink();
        } catch {
          setError(t("link.needNode"));
        }
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 3000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [rules, t]);

  return (
    <section className="border border-slate-800 bg-slate-950 p-3">
      <h2 className="font-display tracking-[0.14em] text-slate-100">{t("link.title")}</h2>
      <p className="mt-2 text-sm text-slate-400">{t("link.lead")}</p>
      {error ? <p className="mt-2 text-sm text-amber-300">{error}</p> : null}
      {status ? (
        <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
          {status.qrDataUrl ? <img src={status.qrDataUrl} alt={t("link.qr")} className="h-44 w-44 bg-slate-900" /> : <div className="h-44 w-44 border border-slate-700" />}
          <div className="text-sm text-slate-300">
            <p>{t("link.host", { host: status.host, port: status.port })}</p>
            <p className="mt-1">{status.mdns ? t("link.mdnsOn") : t("link.mdnsOff")}</p>
            <p className="mt-2 font-mono text-lg tracking-[0.2em] text-cyan-300">{status.nonce}</p>
            <p className="mt-1 text-slate-500">{t("link.nonce")}</p>
            <p className="mt-2 text-slate-500">{status.pushRegistered ? t("link.pushOn") : t("link.pushOff")}</p>
            <button type="button" onClick={() => void fetch(`${CONTROL}/rotate`, { method: "POST" })} className="mt-3 min-h-10 border border-slate-600 px-3">
              {t("link.rotate")}
            </button>
          </div>
        </div>
      ) : null}
      {status?.pending.map((row) => (
        <div key={`${row.address}-${row.at}`} className="mt-3 flex items-center justify-between gap-3 border border-amber-700 px-3 py-2">
          <p className="text-sm text-amber-200">{t("link.pending", { address: row.address })}</p>
          <button type="button" onClick={() => void fetch(`${CONTROL}/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: row.address }) })} className="min-h-10 shrink-0 bg-anchor px-3 text-white">
            {t("link.confirm")}
          </button>
        </div>
      ))}
      {status?.fuseArmed ? (
        <div className="mt-3 border border-red-700 px-3 py-2 text-sm text-red-200">
          <p>{status.fuseNote || t("link.fuse")}</p>
          <button type="button" onClick={() => void fetch(`${CONTROL}/fuse-clear`, { method: "POST" })} className="mt-2 min-h-10 border border-red-700 px-3">
            {t("link.fuseDone")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
