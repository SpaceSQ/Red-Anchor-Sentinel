"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertBanner } from "@/components/AlertBanner";
import { CloudNav } from "@/components/CloudNav";
import { useLabSkin } from "@/components/LabTheme";
import { CommandDeck } from "@/components/CommandDeck";
import { HomeToolkit } from "@/components/HomeToolkit";
import { RadarTopology, dotFromAgent } from "@/components/RadarTopology";
import { assess } from "@/lib/assess";
import type { LabRules } from "@/lib/lab-rules";
import { isValidDid } from "@/lib/did";
import { SANDBOX_FLEET, type AgentProfile } from "@/lib/fleet";
import { fetchScan, type ScanHit } from "@/lib/host-client";
import { useI18n } from "@/lib/i18n";
import { useSentinelIdentity } from "@/lib/identity-context";
import { CLEAN_INTENT, EARTH } from "@/lib/tensor";

function hitToAgent(hit: ScanHit): AgentProfile {
  return {
    id: hit.id,
    callsign: (hit.vendor || hit.name).slice(0, 16),
    name: hit.name,
    channel: hit.tier === 2 ? "mDNS" : "API",
    origin: hit.tier === 3 ? "endpoint" : "sandbox",
    rssi: hit.tier === 1 ? -18 : hit.tier === 2 ? -52 : -78,
    s2Did: "",
    u6a: "",
    x: 40,
    y: 40,
    tensor: EARTH,
    intents: CLEAN_INTENT,
    manifest: hit.manifest,
    sandboxNote: hit.note,
    tier: hit.tier,
    vendor: hit.vendor,
    purpose: hit.purpose,
    uptimeSec: hit.uptimeSec,
    patchAuthority: hit.patchAuthority,
  };
}

function colorOf(agent: AgentProfile, vetoIds: string[], vetoDids: string[], rules?: LabRules | null): string {
  if (vetoIds.includes(agent.id) || (agent.s2Did && vetoDids.includes(agent.s2Did))) return "#ef4444";
  if (!agent.s2Did || !isValidDid(agent.s2Did)) return "#f59e0b";
  const report = assess(agent.tensor, agent.intents, "UNPATCHED", rules);
  if (report.carbon === "CRITICAL" || report.silicon === "CRITICAL") return "#ef4444";
  if (report.carbon === "WARNING" || report.silicon === "WARNING") return "#f59e0b";
  return "#22c55e";
}

export function RadarHome() {
  const profile = useSentinelIdentity();
  const { t } = useI18n();
  const skin = useLabSkin().profile;
  const labRules = useLabSkin().rules;
  const [live, setLive] = useState<AgentProfile[]>([]);
  const [sandbox, setSandbox] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [share, setShare] = useState(false);
  const [vetoIds, setVetoIds] = useState<string[]>([]);
  const [vetoDids, setVetoDids] = useState<string[]>([]);
  const mobile = typeof navigator !== "undefined" && /Android|iPhone/i.test(navigator.userAgent);

  useEffect(() => {
    setShare(window.localStorage.getItem("red-anchor-gossip") === "1");
  }, []);

  useEffect(() => {
    if (!share) return;
    let stop = false;
    const pull = () => {
      fetch("/api/gossip")
        .then((response) => response.json())
        .then((data: { vetoIds?: string[]; vetoDids?: string[] }) => {
          if (stop) return;
          setVetoIds(data.vetoIds ?? []);
          setVetoDids(data.vetoDids ?? []);
        })
        .catch(() => undefined);
    };
    pull();
    const timer = window.setInterval(pull, 8000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [share]);

  const fleet = useMemo(() => {
    const samples = sandbox ? SANDBOX_FLEET.map((agent) => ({ ...agent, tier: 1 as const, vendor: "沙盒样本", purpose: agent.sandboxNote, patchAuthority: "full" as const })) : [];
    const visible = profile.limited ? live.filter((agent) => agent.tier !== 1) : live;
    return [...visible, ...samples];
  }, [live, sandbox, profile.limited]);

  const dots = fleet.map((agent) => dotFromAgent(agent, colorOf(agent, vetoIds, vetoDids, labRules)));

  async function scan() {
    setScanning(true);
    setError("");
    try {
      const hits = await fetchScan();
      setLive(hits.map(hitToAgent));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "扫描失败");
    } finally {
      setScanning(false);
    }
  }

  return (
    <main className="relative z-10 mx-auto flex min-h-screen max-w-[1400px] flex-col gap-3 p-3 md:p-4">
      <header className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="font-display text-xs tracking-[0.22em] text-red-300">{t("radar.kicker")}</p>
          <h1 className="flex items-center gap-2 font-display text-2xl tracking-[0.14em]">
            {skin?.logoUrl ? <img src={skin.logoUrl} alt="" className="h-8 w-8 object-contain" /> : null}
            {skin?.customName || t("radar.title")}
          </h1>
        </div>
        <div className="font-mono text-[11px] leading-5 text-slate-300">
          <p>S2-DID {profile.did}</p>
          <p>CD-U6A {profile.u6a}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={sandbox} onChange={(event) => setSandbox(event.target.checked)} />
            {t("radar.sandbox")}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={share}
              onChange={(event) => {
                const next = event.target.checked;
                window.localStorage.setItem("red-anchor-gossip", next ? "1" : "0");
                setShare(next);
                if (!next) {
                  setVetoIds([]);
                  setVetoDids([]);
                }
              }}
            />
            {t("radar.gossip")}
          </label>
          <button type="button" disabled={scanning || profile.hostClass === "container"} onClick={() => void scan()} className="min-h-11 shrink-0 whitespace-nowrap bg-anchor px-4 font-display tracking-[0.14em] text-white disabled:opacity-60">
            {scanning ? t("radar.scanning") : t("radar.scan")}
          </button>
        </div>
      </header>
      {profile.hostClass === "container" ? (
        <p className="border border-red-700 px-3 py-2 text-sm text-red-200">{t("radar.container")}</p>
      ) : null}
      {mobile ? (
        <p className="border border-amber-700 px-3 py-2 text-sm text-amber-200">{t("radar.mobile")}</p>
      ) : null}
      {!mobile && profile.limited && profile.hostClass !== "container" ? (
        <p className="border border-amber-700 px-3 py-2 text-sm text-amber-200">{t("radar.limited")}</p>
      ) : null}
      <CloudNav />
      <AlertBanner />
      {error ? <p className="text-sm text-amber-300">{error}</p> : null}
      <HomeToolkit fleet={fleet} sourceDid={profile.did} scanning={scanning} scanLocked={profile.hostClass === "container"} onScan={scan} onOpen={setSelectedId} />
      <RadarTopology dots={dots} scanning={scanning} centerDid={profile.did} onSelect={setSelectedId} />
      <p className="text-xs text-slate-500">{t("radar.legend")}</p>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {fleet.length === 0 ? <li className="text-sm text-slate-500">{t("radar.empty")}</li> : null}
        {fleet.map((agent) => (
          <li key={agent.id}>
            <button type="button" onClick={() => setSelectedId(agent.id)} className="w-full border border-slate-800 px-3 py-2 text-left">
              <span className="text-sm">{agent.name}</span>
              <span className="mt-1 block font-mono text-[11px] text-slate-500">{t("radar.tier", { tier: agent.tier ?? "—" })} · {agent.vendor || agent.channel}</span>
            </button>
          </li>
        ))}
      </ul>
      {selectedId ? (
        <aside className="fixed inset-y-0 right-0 z-20 w-full max-w-xl overflow-auto border-l border-slate-700 bg-slate-950 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display tracking-[0.14em]">指挥面板</h2>
            <button type="button" onClick={() => setSelectedId(null)} className="min-h-10 border border-slate-600 px-3 text-sm">
              关闭
            </button>
          </div>
          <CommandDeck embedded seedFleet={fleet} lockedSelection={selectedId} depthLocked={profile.limited || mobile || profile.hostClass === "container"} />
        </aside>
      ) : null}
    </main>
  );
}
