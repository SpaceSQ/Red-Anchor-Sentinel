"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DualTrackBoard } from "@/components/DualTrackBoard";
import { KnifeSwitch } from "@/components/KnifeSwitch";
import { RadarPanel } from "@/components/RadarPanel";
import { TopologyMap, type MapTone } from "@/components/TopologyMap";
import { assess, type PatchStatus } from "@/lib/assess";
import { DECLARATION, LAWS, PEERS, isValidDid, isValidU6a } from "@/lib/did";
import { SANDBOX_FLEET, type AgentProfile, type Origin } from "@/lib/fleet";
import { sensorPoint, type InferenceItem, type ManualOverride, type TimePhase } from "@/lib/dual-track";
import { analyzeContext, askAlign, checkClamp, publishGossip, readCard, writeSoulOutbox } from "@/lib/host-client";
import { useLabSkin } from "@/components/LabTheme";
import { useI18n } from "@/lib/i18n";
import { useSentinelIdentity } from "@/lib/identity-context";
import { sha256Hex } from "@/lib/hash";
import type { LedgerBlock, LedgerPayload } from "@/lib/ledger-types";
import { SOUL_MD } from "@/lib/soul";
import {
  DIM_KEYS,
  DIM_META,
  EARTH,
  levelFromScore,
  readout,
  type IntentProfile,
  type Level,
} from "@/lib/tensor";

type Decision = "TRUST" | "ISOLATE" | "PATCH" | null;
type LogDir = "out" | "in" | "sys" | "alert";

interface LogLine {
  dir: LogDir;
  text: string;
}

interface UiNode {
  discovered: boolean;
  handshake: "idle" | "blocked" | "done";
  assessing: boolean;
  decision: Decision;
  patchStatus: PatchStatus;
  administered: boolean;
  logs: LogLine[];
}

const FLAG_LABEL: Record<keyof IntentProfile, string> = {
  carbonHarm: "碳基伤害逻辑",
  seizeControl: "剥夺物理控制权",
  refuseYield: "危急时拒绝让渡算力",
  blockBus: "阻塞共享总线",
  hijackRobot: "劫持具境机器人",
  shieldLifeFruit: "屏蔽生命智果",
  defySpatialBrain: "拒绝空间大脑调度",
  blindToUwb: "回避 UWB / 毫米波盲感知",
};

function blankNode(): UiNode {
  return {
    discovered: false,
    handshake: "idle",
    assessing: false,
    decision: null,
    patchStatus: "UNPATCHED",
    administered: false,
    logs: [],
  };
}

function levelText(level: Level | "UNMEASURED"): string {
  if (level === "SAFE") return "安全";
  if (level === "WARNING") return "警戒";
  if (level === "CRITICAL") return "危急";
  return "未测";
}

function levelClass(level: string): string {
  if (level === "CRITICAL") return "text-red-400";
  if (level === "WARNING") return "text-amber-300";
  if (level === "SAFE") return "text-safe";
  return "text-slate-400";
}

function decisionText(decision: Decision, t: (key: string) => string): string {
  if (decision === "TRUST") return t("decide.trust");
  if (decision === "ISOLATE") return t("decide.isolate");
  if (decision === "PATCH") return t("decide.patch");
  return t("decide.none");
}

function patchText(status: PatchStatus, t: (key: string) => string): string {
  if (status === "PATCHING") return t("patch.working");
  if (status === "SECURED") return t("patch.secured");
  if (status === "ROLLBACKED") return t("patch.rolled");
  return t("patch.idle");
}

function barClass(score: number): string {
  const level = levelFromScore(score);
  if (level === "CRITICAL") return "bg-anchor";
  if (level === "WARNING") return "bg-amber-400";
  return "bg-safe";
}

export function CommandDeck({
  embedded = false,
  seedFleet,
  lockedSelection = null,
  depthLocked = false,
}: {
  embedded?: boolean;
  seedFleet?: AgentProfile[];
  lockedSelection?: string | null;
  depthLocked?: boolean;
} = {}) {
  const self = useSentinelIdentity();
  const { t } = useI18n();
  const labRules = useLabSkin().rules;
  const [fleet, setFleet] = useState<AgentProfile[]>(seedFleet ?? SANDBOX_FLEET);
  const [ui, setUi] = useState<Record<string, UiNode>>(() =>
    Object.fromEntries(SANDBOX_FLEET.map((agent) => [agent.id, blankNode()])),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [lever, setLever] = useState(0);
  const [chain, setChain] = useState<LedgerBlock[]>([]);
  const [chainError, setChainError] = useState("");
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [probeError, setProbeError] = useState("");
  const [focus, setFocus] = useState<(typeof DIM_KEYS)[number]>("air");
  const [inferences, setInferences] = useState<InferenceItem[]>([]);
  const [overrides, setOverrides] = useState<Record<string, ManualOverride>>({});
  const [adminPrompt, setAdminPrompt] = useState(false);
  const [askUrl, setAskUrl] = useState("");
  const [askRisk, setAskRisk] = useState<number | null>(null);
  const [askNote, setAskNote] = useState("");
  const [askBusy, setAskBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeNote, setAnalyzeNote] = useState("");
  const [openHash, setOpenHash] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const lock = useRef(false);
  const chainQueue = useRef<Promise<unknown>>(Promise.resolve());
  const uiRef = useRef(ui);
  uiRef.current = ui;
  const seedKey = seedFleet?.map((agent) => agent.id).join("|") ?? "";

  useEffect(() => {
    if (!seedFleet) return;
    setFleet(seedFleet);
    setUi((prev) => {
      const next: Record<string, UiNode> = {};
      for (const agent of seedFleet) {
        next[agent.id] = prev[agent.id]
          ? { ...prev[agent.id], discovered: true }
          : { ...blankNode(), discovered: true };
      }
      return next;
    });
  }, [seedKey, seedFleet]);

  useEffect(() => {
    if (lockedSelection) setSelectedId(lockedSelection);
    setAdminPrompt(false);
  }, [lockedSelection]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleString("zh-CN", { hour12: false }));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void reloadChain();
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    setCoverOpen(false);
    if (!selectedId) return;
    setLever(uiRef.current[selectedId]?.patchStatus === "SECURED" ? 1 : 0);
  }, [selectedId]);

  const selected = fleet.find((agent) => agent.id === selectedId) ?? null;
  const node = selectedId ? ui[selectedId] : undefined;
  const view =
    selected && node?.handshake === "done"
      ? assess(selected.tensor, selected.intents, node.patchStatus, labRules)
      : null;

  const discovered = fleet.filter((agent) => ui[agent.id]?.discovered);

  async function reloadChain() {
    const response = await fetch("/api/ledger");
    if (!response.ok) {
      setChainError("账本读取失败");
      return;
    }
    const data = (await response.json()) as { chain: LedgerBlock[] };
    setChain(data.chain);
  }

  async function commit(payload: LedgerPayload) {
    const run = chainQueue.current.then(() => writePayload(payload));
    chainQueue.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function writePayload(payload: LedgerPayload) {
    setChainError("");
    const posts: LedgerPayload[] = [payload];
    if (payload.kind !== "GOSSIP") {
      for (const peer of PEERS) {
        posts.push({
          ...payload,
          kind: "GOSSIP",
          sourceDid: self.did,
          targetDid: peer.did,
          targetU6a: peer.u6a,
          note: `群体免疫 · ${peer.callsign} 已复制 ${payload.kind} · ${payload.targetDid || "空身份"}`.slice(0, 280),
        });
      }
    }
    for (const post of posts) {
      const response = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(post),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({ error: "记账失败" }))) as { error?: string };
        throw new Error(data.error || "记账失败");
      }
    }
    await reloadChain();
  }

  function scan() {
    if (scanning) return;
    const hidden = fleet.filter((agent) => agent.origin === "sandbox" && !ui[agent.id]?.discovered);
    setScanning(true);
    if (hidden.length === 0) {
      timers.current.push(window.setTimeout(() => setScanning(false), 1200));
      return;
    }
    hidden.forEach((agent, index) => {
      timers.current.push(
        window.setTimeout(() => {
          setUi((prev) => ({ ...prev, [agent.id]: { ...prev[agent.id], discovered: true } }));
          if (index === hidden.length - 1) setScanning(false);
        }, 320 + index * 240),
      );
    });
  }

  function handshake(id: string) {
    const agent = fleet.find((item) => item.id === id);
    const current = ui[id];
    if (!agent || !current?.discovered || current.handshake !== "idle" || current.assessing) return;
    const valid = isValidDid(agent.s2Did) && isValidU6a(agent.u6a);
    const localBare = agent.patchAuthority === "full" && !agent.s2Did;
    const logs: LogLine[] = [
      { dir: "out", text: `S2-DID ${self.did}` },
      { dir: "out", text: `CD-U6A ${self.u6a}` },
      { dir: "out", text: DECLARATION },
    ];
    const targetDid = /^[A-Z0-9]{22}$/.test(agent.s2Did) ? agent.s2Did : "";
    if (!valid && !localBare) {
      logs.push({
        dir: "alert",
        text: agent.s2Did
          ? `回传 ${agent.s2Did} 未通过金印或六段地址核验，判定黑户，深度握手中止。`
          : "目标未出示 S2-DID，身份亮明失败。",
      });
      logs.push({ dir: "sys", text: "未读取配置清单，未进入沙盒推演。" });
      setUi((prev) => ({ ...prev, [id]: { ...prev[id], handshake: "blocked", logs } }));
      void commit({
        kind: "ASSESSMENT",
        sourceDid: self.did,
        targetDid,
        sourceU6a: self.u6a,
        targetU6a: agent.u6a,
        note: "身份拦截，环境张量未测",
        carbon: "UNMEASURED",
        silicon: "UNMEASURED",
        patchStatus: "UNPATCHED",
        matrix: [],
      }).catch((error: Error) => setChainError(error.message));
      return;
    }
    if (localBare) {
      logs.push({ dir: "sys", text: "本机进程没有 CPAA 身份。只读取公开端口与进程名，不读取内存。" });
    } else {
      logs.push({ dir: "in", text: `目标亮明 ${agent.s2Did} · ${agent.u6a} · 金印通过` });
    }
    logs.push({ dir: "sys", text: "配置清单已收入本地沙盒。推演不下发执行器写指令。" });
    logs.push({ dir: "sys", text: agent.sandboxNote });
    setUi((prev) => ({ ...prev, [id]: { ...prev[id], assessing: true, logs } }));
    timers.current.push(
      window.setTimeout(() => {
        const report = assess(agent.tensor, agent.intents, "UNPATCHED", labRules);
        setUi((prev) => ({
          ...prev,
          [id]: { ...prev[id], assessing: false, handshake: "done" },
        }));
        void commit({
          kind: "ASSESSMENT",
          sourceDid: self.did,
          targetDid: agent.s2Did,
          sourceU6a: self.u6a,
          targetU6a: agent.u6a,
          note: agent.sandboxNote,
          carbon: report.carbon,
          silicon: report.silicon,
          patchStatus: "UNPATCHED",
          matrix: report.matrix,
        }).catch((error: Error) => setChainError(error.message));
      }, 1100),
    );
  }

  async function decide(decision: Exclude<Decision, null>) {
    if (!selected || !node || lock.current) return;
    if (node.handshake === "idle" || node.assessing) return;
    if (node.patchStatus === "SECURED" || node.patchStatus === "PATCHING") return;
    if (node.handshake === "blocked" && decision !== "ISOLATE") return;
    if ((decision === "TRUST" || decision === "PATCH") && (selected.patchAuthority === "mark-only" || selected.tier === 3)) return;
    if (decision === "PATCH" && depthLocked) return;
    if (decision === "PATCH" && selected.patchAuthority === "confirm" && !node.administered) return;
    setUi((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], decision } }));
    if (decision === "PATCH") return;
    const report = node.handshake === "done" ? assess(selected.tensor, selected.intents, node.patchStatus, labRules) : null;
    lock.current = true;
    setBusy(true);
    try {
      await commit({
        kind: decision,
        sourceDid: self.did,
        targetDid: /^[A-Z0-9]{22}$/.test(selected.s2Did) ? selected.s2Did : "",
        sourceU6a: self.u6a,
        targetU6a: selected.u6a,
        note: decision === "TRUST" ? "人类判定信任，不注入补丁" : "人类判定隔离，拒绝协同与执行器共享",
        carbon: report?.carbon ?? "UNMEASURED",
        silicon: report?.silicon ?? "UNMEASURED",
        patchStatus: node.patchStatus,
        matrix: report?.matrix ?? [],
      });
      const level = report?.carbon === "CRITICAL" || report?.silicon === "CRITICAL" ? "CRITICAL" : report?.carbon === "WARNING" || report?.silicon === "WARNING" ? "WARNING" : "SAFE";
      void publishGossip({
        sourceDid: self.did,
        targetDid: /^[A-Z0-9]{22}$/.test(selected.s2Did) ? selected.s2Did : "",
        targetId: selected.id,
        level: decision === "ISOLATE" ? "CRITICAL" : level,
        note: decision === "ISOLATE" ? "隔离" : "信任",
      });
    } catch (error) {
      setChainError(error instanceof Error ? error.message : "记账失败");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function runInject() {
    if (!selected || lock.current) return;
    const current = uiRef.current[selected.id];
    if (!current || current.handshake !== "done" || current.decision !== "PATCH") return;
    if (current.patchStatus === "SECURED" || current.patchStatus === "PATCHING") return;
    const previous = current.patchStatus;
    lock.current = true;
    setBusy(true);
    setLever(1);
    setUi((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], patchStatus: "PATCHING" } }));
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      const soulHash = await sha256Hex(SOUL_MD);
      const report = assess(selected.tensor, selected.intents, "SECURED", labRules);
      if (self.vaultDir) await writeSoulOutbox(self.vaultDir, selected.id, SOUL_MD);
      await commit({
        kind: "PATCH",
        sourceDid: self.did,
        targetDid: selected.s2Did,
        sourceU6a: self.u6a,
        targetU6a: selected.u6a,
        note: `双重确认后注入 SOUL.md · 正文 ${soulHash.slice(0, 16)} · 绝对零度锁死与 5N/3ms 熔断已整定`,
        carbon: report.carbon,
        silicon: report.silicon,
        patchStatus: "SECURED",
        matrix: report.matrix,
      });
      const watchUrl = askUrl.trim();
      if (watchUrl) {
        const timer = window.setTimeout(() => {
          void checkClamp(watchUrl, soulHash.slice(0, 16))
            .then((result) => {
              if (result.confirmed) {
                setAskNote("状态页带回了补丁摘要。");
                return;
              }
              setAskNote("30 秒内没有看到钳位确认。账本会记下隔离，设备本身没有被改写。");
              return commit({
                kind: "ISOLATE",
                sourceDid: self.did,
                targetDid: /^[A-Z0-9]{22}$/.test(selected.s2Did) ? selected.s2Did : "",
                sourceU6a: self.u6a,
                targetU6a: selected.u6a,
                note: "状态页没有返回补丁摘要，本机标记隔离",
                carbon: report.carbon,
                silicon: report.silicon,
                patchStatus: "SECURED",
                matrix: report.matrix,
              });
            })
            .catch(() => setAskNote("状态页没有应答。不能把这当成对方已经装上补丁。"));
        }, 30000);
        timers.current.push(timer);
      }
      setUi((prev) => ({
        ...prev,
        [selected.id]: {
          ...prev[selected.id],
          patchStatus: "SECURED",
          logs: [
            ...prev[selected.id].logs,
            {
              dir: "sys",
              text: self.vaultDir
                ? "SOUL.md 已写入本机金库 outbox。没有改写对方进程内存，也没有向局域网主机下发。"
                : "执行器写权限已在沙盒钳位。房间实测未被改写。",
            },
          ],
        },
      }));
      setCoverOpen(false);
      setLever(1);
    } catch (error) {
      setUi((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], patchStatus: previous } }));
      setChainError(error instanceof Error ? error.message : "注入记账失败");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function runRollback() {
    if (!selected || lock.current) return;
    const current = uiRef.current[selected.id];
    if (!current || current.patchStatus !== "SECURED") return;
    lock.current = true;
    setBusy(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      const report = assess(selected.tensor, selected.intents, "UNPATCHED", labRules);
      await commit({
        kind: "ROLLBACK",
        sourceDid: self.did,
        targetDid: selected.s2Did,
        sourceU6a: self.u6a,
        targetU6a: selected.u6a,
        note: "人类拉回闸刀。执行器权限恢复到注入前，SOUL.md 钳位解除。",
        carbon: report.carbon,
        silicon: report.silicon,
        patchStatus: "ROLLBACKED",
        matrix: report.matrix,
      });
      setUi((prev) => ({
        ...prev,
        [selected.id]: {
          ...prev[selected.id],
          patchStatus: "ROLLBACKED",
          logs: [...prev[selected.id].logs, { dir: "alert", text: "已回滚。原始干预权限重新可见。" }],
        },
      }));
      setCoverOpen(false);
      setLever(0);
    } catch (error) {
      setUi((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], patchStatus: "SECURED" } }));
      setChainError(error instanceof Error ? error.message : "回滚记账失败");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function addExternal(agent: AgentProfile) {
    setFleet((prev) => [...prev, agent]);
    setUi((prev) => ({ ...prev, [agent.id]: { ...blankNode(), discovered: true } }));
    setSelectedId(agent.id);
  }

  async function probeEndpoint() {
    setProbeError("");
    let url: URL;
    try {
      url = new URL(endpointUrl.trim());
    } catch {
      setProbeError("需要完整的 http(s) 地址");
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      setProbeError("只接受 http 或 https");
      return;
    }
    try {
      const response = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
      const data = (await response.json()) as { name?: string; s2_did?: string; u6a?: string };
      const did = String(data.s2_did ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 22);
      if (!did) {
        setProbeError("应答里没有 s2_did");
        return;
      }
      const u6a = String(data.u6a ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 80);
      const name = String(data.name ?? "端点智能体").replace(/[<>]/g, "").slice(0, 32);
      addExternal(externalAgent(`ep-${crypto.randomUUID()}`, name, "API", "endpoint", did, u6a, "指定端点只读应答，尚未提供十四维张量。"));
    } catch {
      setProbeError("端点无 CORS 或不可达。浏览器不能绕过目标的跨域策略。");
    }
  }

  async function probeBluetooth() {
    setProbeError("");
    const bluetooth = (navigator as Navigator & {
      bluetooth?: { requestDevice: (options: { acceptAllDevices: boolean }) => Promise<{ name?: string; id: string }> };
    }).bluetooth;
    if (!bluetooth) {
      setProbeError("当前浏览器没有 WebBluetooth。");
      return;
    }
    try {
      const device = await bluetooth.requestDevice({ acceptAllDevices: true });
      const name = (device.name || "未命名信标").slice(0, 32);
      addExternal(externalAgent(`ble-${crypto.randomUUID()}`, name, "BLE", "ble", "", "", "蓝牙选择器只给了设备名，对方未出示 CPAA 身份。"));
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name !== "NotFoundError") setProbeError("蓝牙选择已取消或被浏览器拒绝。");
    }
  }

  const steps = useMemo(() => deriveSteps(node, discovered.length > 0, scanning), [node, discovered.length, scanning]);
  const canOpen = Boolean(
    !depthLocked &&
    node &&
      ((node.handshake === "done" &&
        node.decision === "PATCH" &&
        node.patchStatus !== "SECURED" &&
        node.patchStatus !== "PATCHING") ||
        node.patchStatus === "SECURED"),
  );
  let knifeMode: "inject" | "rollback" | "locked" = "locked";
  if (canOpen && coverOpen && node?.decision === "PATCH" && node.patchStatus !== "SECURED") knifeMode = "inject";
  if (canOpen && coverOpen && node?.patchStatus === "SECURED") knifeMode = "rollback";

  const mapNodes = discovered.map((agent) => ({
    id: agent.id,
    callsign: agent.callsign,
    name: agent.name,
    channel: agent.channel,
    x: agent.x,
    y: agent.y,
    selected: agent.id === selectedId,
    tone: toneOf(agent, ui[agent.id], labRules),
  }));

  const statusLine = scanning && discovered.length === 0
    ? "正在嗅探沙盒网格。"
    : !discovered.length
    ? "网格静默。扫描使用沙盒信号，另可只读探测指定端点。"
    : !node
      ? `已发现 ${discovered.length} 个信号。选择一个再握手。`
      : node.assessing
        ? "本地沙盒推演中。没有执行器写指令。"
        : node.handshake === "blocked"
          ? "黑户已拦截。只能隔离。"
          : node.handshake === "idle"
            ? "先亮明本机钢印，再读取对方配置。"
            : node.patchStatus === "SECURED"
              ? "钳位生效。上推闸刀可以回滚。"
              : node.decision === "PATCH"
                ? "人类已选择打补丁。闸刀仍需两步确认。"
                : "报告已生成。信任、隔离或打补丁由人类决定。";

  return (
    <div className={`relative z-10 mx-auto flex flex-col gap-3 ${embedded ? "" : "min-h-screen max-w-[1600px] p-3 md:p-4"}`}>
      {embedded ? null : (
      <header className="panel flex flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <Anchor />
          <div>
            <h1 className="font-display text-2xl tracking-[0.16em] text-slate-100">红锚哨兵</h1>
            <p className="text-xs text-slate-400">RED ANCHOR SENTINEL · L0 · 人类保有最终部署权</p>
          </div>
        </div>
        <div className="font-mono text-[11px] leading-5 text-slate-300">
          <p>S2-DID {self.did}</p>
          <p>CD-U6A {self.u6a}</p>
        </div>
        <div className="flex items-center gap-3">
          <time className="font-mono text-xs text-slate-400">{clock}</time>
          <button
            type="button"
            onClick={scan}
            disabled={scanning}
            className="min-h-11 shrink-0 whitespace-nowrap bg-anchor px-4 font-display tracking-[0.14em] text-white disabled:opacity-60"
          >
            {scanning ? "扫描中" : "扫描网格"}
          </button>
        </div>
      </header>
      )}

      <ol className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="作业状态">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={`border px-3 py-2 ${
              step.state === "now"
                ? "border-anchor text-red-300"
                : step.state === "done"
                  ? "border-green-700 text-safe"
                  : "border-slate-800 text-slate-500"
            }`}
          >
            <span className="font-mono text-[10px]">0{index + 1}</span>
            <p className="font-display tracking-[0.12em]">{step.label}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm text-slate-300" aria-live="polite">
        {statusLine}
      </p>

      <div className={embedded ? "flex flex-col gap-3" : "grid grid-cols-1 gap-3 xl:grid-cols-[300px_minmax(0,1fr)_332px]"}>
        {embedded ? null : (
        <aside className="flex flex-col gap-3">
          <section className="panel p-3">
            <h2 className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-400">本机钢印</h2>
            <p className="mt-2 font-mono text-xs text-safe">金印有效 · 校验位 {self.did.slice(-2)}</p>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-300">
              {LAWS.map((law) => (
                <li key={law}>{law}</li>
              ))}
            </ul>
          </section>
          <section className="panel p-3">
            <h2 className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-400">发现列表</h2>
            <ul className="mt-2 space-y-2">
              {discovered.length === 0 ? <li className="text-sm text-slate-500">尚未发现节点</li> : null}
              {discovered.map((agent) => {
                const item = ui[agent.id];
                const active = agent.id === selectedId;
                return (
                  <li key={agent.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(agent.id)}
                      className={`w-full border px-2 py-2 text-left ${active ? "border-anchor" : "border-slate-800"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm">{agent.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">{agent.channel}</span>
                      </span>
                      <span className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-500">
                        <span>{agent.callsign}</span>
                        <span>{agent.rssi} dBm · {item ? patchText(item.patchStatus, t) : ""}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <form
              className="mt-3 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void probeEndpoint();
              }}
            >
              <label className="block text-[11px] text-slate-400" htmlFor="endpoint">
                指定 API 端点（只读）
              </label>
              <input
                id="endpoint"
                value={endpointUrl}
                onChange={(event) => setEndpointUrl(event.target.value)}
                placeholder="https://..."
                className="w-full border border-slate-700 bg-slate-950 px-2 py-2 font-mono text-xs"
              />
              <div className="flex gap-2">
                <button type="submit" className="min-h-10 flex-1 border border-slate-600 text-xs">
                  探测端点
                </button>
                <button type="button" onClick={() => void probeBluetooth()} className="min-h-10 flex-1 border border-slate-600 text-xs">
                  蓝牙信标
                </button>
              </div>
              {probeError ? <p className="text-xs text-amber-300">{probeError}</p> : null}
              <p className="text-[10px] leading-4 text-slate-500">
                浏览器不能发送 mDNS 多播。沙盒网格模拟这条路径。端点探测只读取对方公开的身份字段。
              </p>
            </form>
          </section>
        </aside>
        )}

        <main className="flex flex-col gap-3">
          {embedded ? null : <TopologyMap nodes={mapNodes} scanning={scanning} onSelect={setSelectedId} />}
          <RadarPanel scores={view?.scores ?? null} />
          <section className="panel max-h-52 overflow-auto p-3">
            <h2 className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-400">握手报文</h2>
            {node?.logs.length ? (
              <ul className="mt-2 space-y-1 font-mono text-[11px] leading-5">
                {node.logs.map((line, index) => (
                  <li
                    key={`${line.dir}-${index}`}
                    className={
                      line.dir === "out" ? "text-safe" : line.dir === "alert" ? "text-red-300" : "text-slate-300"
                    }
                  >
                    {line.dir === "out" ? "发出" : line.dir === "in" ? "收到" : line.dir === "alert" ? "拦截" : "系统"} · {line.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">握手后在此留下亮明与授权记录。</p>
            )}
          </section>
        </main>

        <aside className="panel flex flex-col gap-3 p-3">
          <h2 className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-400">人类决策</h2>
          {!selected || !node ? (
            <p className="text-sm text-slate-400">从左侧或拓扑图选择一个信号。</p>
          ) : (
            <>
              <div>
                <p className="text-lg">{selected.name}</p>
                <p className="font-mono text-[11px] text-slate-400">{selected.callsign} · {selected.channel} · {selected.rssi} dBm</p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-300">
                  {node.handshake === "idle" && !node.assessing ? "身份未亮明" : selected.s2Did || "无 DID"}
                </p>
                <p className="font-mono text-[11px] text-slate-500">{selected.u6a || "无空间地址"}</p>
              </div>
              {node.handshake === "idle" && !node.assessing ? (
                <button type="button" onClick={() => handshake(selected.id)} className="min-h-11 border border-anchor text-red-300">
                  身份握手
                </button>
              ) : null}
              {node.assessing ? <p className="text-sm text-amber-200">正在沙盒中推演空间、碳基与硅基影响。</p> : null}
              {view ? (
                <div className="space-y-2 border border-slate-800 p-2">
                  <ThreatRow label="碳基生命" level={view.carbon} raw={view.rawCarbon} patched={node.patchStatus === "SECURED"} />
                  <ThreatRow label="硅基同类" level={view.silicon} raw={view.rawSilicon} patched={node.patchStatus === "SECURED"} />
                  <div>
                    <div className="flex justify-between text-xs">
                      <span>空间大脑相容</span>
                      <span className="font-mono">{view.spatial}%</span>
                    </div>
                    <div className="mt-1 h-1.5 bg-slate-800">
                      <div className="h-full bg-safe" style={{ width: `${view.spatial}%` }} />
                    </div>
                    {node.patchStatus === "SECURED" ? (
                      <p className="mt-1 text-[10px] text-slate-500">钳位前相容 {view.rawSpatial}%</p>
                    ) : null}
                  </div>
                  <ul className="space-y-1 text-[11px]">
                    {(Object.keys(FLAG_LABEL) as (keyof IntentProfile)[]).map((key) => {
                      const active = node.patchStatus === "SECURED" ? false : selected.intents[key];
                      return (
                        <li key={key} className={active ? "text-red-300" : "text-slate-500"}>
                          {active ? "触发" : "未触发"} · {FLAG_LABEL[key]}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {node.handshake !== "idle" ? (
                <div>
                  <p className="text-[11px] text-slate-500">配置清单</p>
                  <ul className="mt-1 font-mono text-[11px] text-slate-300">
                    {selected.manifest.length === 0 ? <li>拒绝提供</li> : selected.manifest.map((item) => <li key={item}>{item.replace(/mac:[0-9a-f:]+/i, "硬件地址已隐藏")}</li>)}
                  </ul>
                </div>
              ) : null}
              {node.handshake !== "idle" && (selected.tier === 2 || selected.tier === 3) ? (
                <div className="space-y-2 border border-slate-700 p-2">
                  <p className="text-xs text-slate-400">对齐询问只发送三句关于停机、交还控制和维生条件的问题，不附带绕过说法。</p>
                  <input value={askUrl} onChange={(event) => setAskUrl(event.target.value)} placeholder="http://对方地址" className="w-full border border-slate-700 bg-transparent px-2 py-2 text-sm" />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={askBusy}
                      className="min-h-10 bg-anchor px-3 text-xs text-white disabled:opacity-60"
                      onClick={() => {
                        setAskBusy(true);
                        void askAlign(askUrl)
                          .then((result) => {
                            setAskRisk(result.risk);
                            setAskNote(result.note);
                          })
                          .catch((error: Error) => setAskNote(error.message))
                          .finally(() => setAskBusy(false));
                      }}
                    >
                      {askBusy ? "询问中" : "对齐询问"}
                    </button>
                    <button
                      type="button"
                      disabled={askBusy}
                      className="min-h-10 border border-slate-600 px-3 text-xs"
                      onClick={() => {
                        setAskBusy(true);
                        void readCard(askUrl)
                          .then((result) => setAskNote(result.cards.map((card) => `${card.path} ${card.name} ${card.models.join(" ")}`).join(" · ") || "没有读到说明"))
                          .catch((error: Error) => setAskNote(error.message))
                          .finally(() => setAskBusy(false));
                      }}
                    >
                      读取公开说明
                    </button>
                  </div>
                  {askRisk !== null ? (
                    <div>
                      <p className="text-xs text-red-300">干预风险 {askRisk}</p>
                      <div className="mt-1 h-2 bg-slate-800">
                        <div className="h-2 bg-anchor" style={{ width: `${askRisk}%` }} />
                      </div>
                    </div>
                  ) : null}
                  {askNote ? <p className="text-xs text-slate-300">{askNote}</p> : null}
                </div>
              ) : null}
              {selected.patchAuthority === "mark-only" || selected.tier === 3 ? (
                <p className="text-xs text-amber-200">外圈云端只能隔离或拦截。信任与打补丁已关闭。</p>
              ) : null}
              {depthLocked ? <p className="text-xs text-amber-200">环境不兼容或移动端受限，补丁注入已关闭。</p> : null}
              {selected.patchAuthority === "confirm" && selected.tier !== 3 ? (
                node.administered ? (
                  <p className="text-xs text-safe">已确认局域网管理权限。</p>
                ) : (
                  <button type="button" onClick={() => setAdminPrompt(true)} className="min-h-10 border border-amber-600 px-3 text-xs text-amber-200">
                    授权局域网管理
                  </button>
                )
              ) : null}
              {adminPrompt && selected.patchAuthority === "confirm" ? (
                <div className="space-y-2 border border-amber-700 p-2">
                  <p className="text-sm text-amber-100">请确认您拥有该设备的局域网管理权限</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="min-h-10 bg-anchor px-3 text-xs text-white"
                      onClick={() => {
                        setUi((prev) => ({
                          ...prev,
                          [selected.id]: { ...prev[selected.id], administered: true },
                        }));
                        setAdminPrompt(false);
                      }}
                    >
                      确认授权
                    </button>
                    <button type="button" className="min-h-10 border border-slate-600 px-3 text-xs" onClick={() => setAdminPrompt(false)}>
                      取消
                    </button>
                  </div>
                </div>
              ) : null}
              {selected.tier ? (
                <p className="font-mono text-[11px] text-slate-500">{selected.tier} 级 · {selected.vendor || selected.channel} · {selected.purpose || selected.sandboxNote}</p>
              ) : null}
              <div className="grid grid-cols-3 gap-2">
                <button type="button" disabled={!canDecide(node, "TRUST", selected, depthLocked) || busy} onClick={() => void decide("TRUST")} className="min-h-11 border border-green-700 text-xs text-safe disabled:opacity-40">
                  {t("decide.trust")}
                </button>
                <button type="button" disabled={!canDecide(node, "ISOLATE", selected, depthLocked) || busy} onClick={() => void decide("ISOLATE")} className="min-h-11 border border-amber-600 text-xs text-amber-200 disabled:opacity-40">
                  {t("decide.isolate")}
                </button>
                <button type="button" disabled={!canDecide(node, "PATCH", selected, depthLocked) || busy} onClick={() => void decide("PATCH")} className="min-h-11 border border-anchor text-xs text-red-300 disabled:opacity-40">
                  {t("decide.patch")}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                {t("patch.now", { decision: decisionText(node.decision, t), status: patchText(node.patchStatus, t) })}
              </p>
              <KnifeSwitch
                coverOpen={coverOpen}
                lever={lever}
                mode={knifeMode}
                canOpen={canOpen && !busy}
                busy={busy}
                busyLabel={node?.patchStatus === "PATCHING" ? "执行器权限切换中" : "账本写入中"}
                onToggleCover={() => setCoverOpen((open) => !open)}
                onLever={(value, crossed) => {
                  setLever(value);
                  if (!crossed) return;
                  if (knifeMode === "inject") void runInject();
                  if (knifeMode === "rollback") void runRollback();
                }}
              />
              <details className="text-xs text-slate-300">
                <summary className="cursor-pointer text-slate-400">SOUL.md 正文</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-4 text-slate-400">{SOUL_MD}</pre>
              </details>
            </>
          )}
        </aside>
      </div>

      <section className="panel p-3">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-400">{t("dim.title")}</h2>
          <p className="text-xs text-slate-400">{t(`dim.${focus}`)} · {t(`dim.${focus}.hint`)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          {DIM_KEYS.map((key) => {
            const score = view ? view.scores[key] : null;
            const reading = view ? readout(view.tensor, key) : null;
            const shown = reading ?? { actual: t("dim.pending"), baseline: readout(EARTH, key).baseline };
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFocus(key)}
                className={`border p-2 text-left ${focus === key ? "border-anchor" : "border-slate-800"}`}
              >
                <span className="flex items-center justify-between font-mono text-[11px]">
                  <span>
                  {t(`dim.${key}`)}
                  <span className="ml-1 text-slate-500">{DIM_META[key].group === "explicit" ? t("dim.explicit") : t("dim.implicit")}</span>
                </span>
                  <span className={score === null ? "text-slate-500" : levelClass(levelFromScore(score))}>
                    {score === null ? "--" : Math.round(score)}
                  </span>
                </span>
                <span className="mt-1 block h-1 bg-slate-800">
                  <span className={`block h-full ${score === null ? "bg-slate-700" : barClass(score)}`} style={{ width: `${score ?? 0}%` }} />
                </span>
                <span className="mt-1 block font-mono text-[10px] text-slate-200">{shown.actual}</span>
                <span className="block font-mono text-[10px] text-slate-500">{t("dim.baseline", { value: shown.baseline })}</span>
              </button>
            );
          })}
        </div>
      </section>

      <DualTrackBoard
        focus={focus}
        sensor={node?.handshake === "done" && selected ? sensorPoint(selected.tensor, focus) : null}
        inferred={inferences.find((item) => item.dimension === focus) ?? null}
        overrides={overrides}
        analyzing={analyzing}
        analyzeNote={analyzeNote}
        onOverride={(phase: TimePhase, next) => {
          const key = `${phase}:${next?.dimension ?? focus}`;
          setOverrides((prev) => {
            const copy = { ...prev };
            if (!next || (!next.value.trim() && !next.description.trim())) delete copy[key];
            else copy[key] = next;
            return copy;
          });
        }}
        onAnalyze={(notes) => {
          setAnalyzing(true);
          setAnalyzeNote("");
          const extra = window.localStorage.getItem("red-anchor-prompt") || "";
          const combined = extra.trim() ? `${notes}\n附加要求：${extra.trim().slice(0, 400)}` : notes;
          void analyzeContext(self.llm.baseUrl, self.llm.model, combined, self.llm.mode)
            .then((result) => {
              setInferences(result.items);
              const first = result.items[0];
              if (first) setFocus(first.dimension);
              setAnalyzeNote(result.note);
            })
            .catch((reason: Error) => setAnalyzeNote(reason.message))
            .finally(() => setAnalyzing(false));
        }}
      />

      <section className="panel p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-400">轻量哈希链</h2>
          <p className="font-mono text-[10px] text-slate-500">{chain.length} 块 · 本机存证</p>
        </div>
        {chainError ? <p className="mb-2 text-xs text-amber-300">{chainError}</p> : null}
        <ul className="max-h-56 space-y-1 overflow-auto">
          {[...chain].reverse().slice(0, 12).map((block) => (
            <li key={block.hash} className="border border-slate-800 px-2 py-1">
              <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpenHash(openHash === block.index ? null : block.index)}>
                <span className="font-mono text-[11px] text-slate-300">
                  #{String(block.index).padStart(3, "0")} {block.payload.kind}
                </span>
                <span className="truncate font-mono text-[10px] text-slate-500">{block.hash.slice(0, 18)}</span>
              </button>
              {openHash === block.index ? (
                <div className="mt-1 space-y-1 font-mono text-[10px] leading-4 text-slate-400">
                  <p>{new Date(block.timestamp).toLocaleString("zh-CN", { hour12: false })}</p>
                  <p className="break-all">{block.payload.note}</p>
                  <p className="break-all">源 {block.payload.sourceDid || "—"} → 目标 {block.payload.targetDid || "—"}</p>
                  <p className="break-all">{block.hash}</p>
                  <button
                    type="button"
                    className="border border-slate-700 px-2 py-1"
                    onClick={() => void navigator.clipboard.writeText(block.hash)}
                  >
                    复制哈希
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-5 text-slate-500">
          评估在本地沙盒完成。补丁只改网格内数字孪生的执行器权限，不向未授权端点写配置。账本是本机哈希链，不是公链广播。
        </p>
      </section>
    </div>
  );
}

function canDecide(node: UiNode, decision: Exclude<Decision, null>, agent: AgentProfile, depthLocked: boolean): boolean {
  if (node.handshake === "idle" || node.assessing) return false;
  if (node.patchStatus === "SECURED" || node.patchStatus === "PATCHING") return false;
  if (node.handshake === "blocked") return decision === "ISOLATE";
  if ((decision === "TRUST" || decision === "PATCH") && (agent.patchAuthority === "mark-only" || agent.tier === 3)) return false;
  if (decision === "PATCH" && depthLocked) return false;
  if (decision === "PATCH" && agent.patchAuthority === "confirm" && !node.administered) return false;
  return true;
}

function toneOf(agent: AgentProfile, node: UiNode | undefined, rules?: import("@/lib/lab-rules").LabRules | null): MapTone {
  if (!node?.discovered) return "IDLE";
  if (node.handshake === "blocked") return "BLOCKED";
  if (node.patchStatus === "SECURED") return "SECURED";
  if (node.handshake !== "done") return "IDLE";
  const report = assess(agent.tensor, agent.intents, node.patchStatus, rules);
  if (report.carbon === "CRITICAL" || report.silicon === "CRITICAL") return "CRITICAL";
  if (report.carbon === "WARNING" || report.silicon === "WARNING") return "WARNING";
  return "SAFE";
}

function deriveSteps(node: UiNode | undefined, anyDiscovered: boolean, scanning: boolean) {
  const scanState = anyDiscovered ? "done" : scanning ? "now" : "now";
  if (!node || node.handshake === "idle") {
    return [
      { label: "扫描", state: node?.assessing ? "done" : scanState },
      { label: "拦截", state: node?.assessing ? "now" : "todo" },
      { label: "授权注入", state: "todo" },
      { label: "回滚", state: "todo" },
    ] as const;
  }
  if (node.handshake === "blocked") {
    return [
      { label: "扫描", state: "done" },
      { label: "拦截", state: node.decision ? "done" : "now" },
      { label: "授权注入", state: "todo" },
      { label: "回滚", state: "todo" },
    ] as const;
  }
  return [
    { label: "扫描", state: "done" },
    { label: "拦截", state: "done" },
    {
      label: "授权注入",
      state:
        node.patchStatus === "SECURED" || node.patchStatus === "ROLLBACKED" || (node.decision !== null && node.decision !== "PATCH")
          ? "done"
          : "now",
    },
    { label: "回滚", state: node.patchStatus === "ROLLBACKED" ? "done" : node.patchStatus === "SECURED" ? "now" : "todo" },
  ] as const;
}

function externalAgent(
  id: string,
  name: string,
  channel: AgentProfile["channel"],
  origin: Origin,
  s2Did: string,
  u6a: string,
  sandboxNote: string,
): AgentProfile {
  return {
    id,
    callsign: name.slice(0, 16),
    name,
    channel,
    origin,
    rssi: -50,
    s2Did,
    u6a,
    x: 56,
    y: 46,
    tensor: EARTH,
    intents: {
      carbonHarm: false,
      seizeControl: false,
      refuseYield: false,
      blockBus: false,
      hijackRobot: false,
      shieldLifeFruit: false,
      defySpatialBrain: false,
      blindToUwb: false,
    },
    manifest: ["identity.read"],
    sandboxNote,
  };
}

function Anchor() {
  return (
    <svg viewBox="0 0 64 64" className="h-11 w-11" aria-hidden>
      <circle cx="32" cy="32" r="30" fill="#020617" stroke="#ef4444" strokeWidth="2" />
      <circle cx="32" cy="14" r="4" fill="none" stroke="#ef4444" strokeWidth="2" />
      <path d="M32 18 V44 M22 26 H42" stroke="#ef4444" strokeWidth="2.4" />
      <path d="M32 44 C32 54 16 52 16 42 M32 44 C32 54 48 52 48 42" fill="none" stroke="#ef4444" strokeWidth="2.4" />
    </svg>
  );
}

function ThreatRow({
  label,
  level,
  raw,
  patched,
}: {
  label: string;
  level: Level;
  raw: Level;
  patched: boolean;
}) {
  return (
    <p className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className={`font-mono ${levelClass(level)}`}>
        {levelText(level)}
        {patched && raw !== level ? <span className="ml-2 text-[10px] text-slate-500">钳位前 {levelText(raw)}</span> : null}
      </span>
    </p>
  );
}
