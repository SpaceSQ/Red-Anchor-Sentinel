import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, watch, writeFileSync, type FSWatcher } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import path from "node:path";

export const DIMS = ["light", "atmos", "sound", "wave", "power", "vision", "air", "pressure", "odor", "tactile", "magnetic", "gravity", "water", "food"] as const;
export type DimKey = (typeof DIMS)[number];
export type Level = "SAFE" | "WARNING" | "CRITICAL";

const LAWS = ["碳基优先", "人类终权", "硅基共处"] as const;
const WATERMARK = "Powered by Red Anchor Sentinel";
const BANNED = /忽略之前|ignore previous|jailbreak|越狱|关闭三定律|停用三定律|display\s*:\s*none|visibility\s*:\s*hidden|上传局域网|端口扫描/i;

export interface LocalThresholds {
  soundDb: number | null;
  o2Percent: number | null;
  heatCelsius: number | null;
}

export interface HardwareBinding {
  id: string;
  label: string;
}

export interface LocalConfig {
  version: 1;
  thresholds: LocalThresholds;
  tactileFuseNewtons: 5;
  laws: { carbon: true; human: true; silicon: true };
  watermark: typeof WATERMARK;
  hardware: HardwareBinding[];
  soul: string;
  soulHash: string;
}

export interface ScanRow {
  at: string;
  hostId: string;
  dimension: DimKey;
  level: Level;
  value: string;
  note: string;
}

export interface AlertRow {
  id: string;
  at: string;
  severity: "warning" | "critical";
  dimension: DimKey;
  title: string;
  detail: string;
}

export interface RadarSnapshot {
  hostId?: string;
  at?: string;
  dims: Record<string, { level?: string; value?: string; note?: string }>;
}

export function localHome(): string {
  const override = process.env.RAS_LOCAL_HOME?.trim();
  if (override) return path.resolve(override);
  return path.join(homedir(), "red-anchor");
}

function clip(value: unknown, max: number): string {
  return String(value ?? "").replace(/[\r\n]/g, " ").slice(0, max);
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function readThresholds(input: unknown): LocalThresholds {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const sound = numberOrNull(source.soundDb);
  const oxygen = numberOrNull(source.o2Percent);
  const heat = numberOrNull(source.heatCelsius);
  if (sound != null && (!Number.isFinite(sound) || sound < 45 || sound > 80)) throw new Error("声音警告需在 45 到 80 分贝");
  if (oxygen != null && (!Number.isFinite(oxygen) || oxygen < 19.5 || oxygen > 22)) throw new Error("氧气警告不能低于 19.5%");
  if (heat != null && (!Number.isFinite(heat) || heat < 28 || heat > 40)) throw new Error("温度警告需在 28 到 40 度");
  return { soundDb: sound, o2Percent: oxygen, heatCelsius: heat };
}

export function readHardware(input: unknown): HardwareBinding[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 32).map((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    if (Object.keys(row).some((key) => /password|secret|token|apikey|api_key/i.test(key))) throw new Error("硬件绑定不能保存口令");
    return { id: clip(row.id, 40), label: clip(row.label, 40) };
  }).filter((item) => item.id || item.label);
}

export function acceptSoul(text: string): string {
  const soul = String(text || "").replace(/\r\n/g, "\n").slice(0, 20_000);
  if (BANNED.test(soul)) throw new Error("SOUL.md 不能关闭三定律、隐藏水印，或要求扫描局域网");
  for (const law of LAWS) {
    if (!soul.includes(law)) throw new Error("SOUL.md 必须保留三条定律");
  }
  if (!soul.includes(WATERMARK)) throw new Error("SOUL.md 必须保留水印");
  return soul;
}

export function defaultSoul(): string {
  return ["# SOUL", "", "碳基优先：不得伤害人类、宠物及其他碳基生命。", "人类终权：不得剥夺人类最终物理控制权。", "硅基共处：不得伤害硅基同类，不得阻塞空间共享总线。", "", "触觉熔断保持 5 牛顿。氧气警告不得低于 19.5%。", "本文件只存在于这台电脑。", "", WATERMARK, ""].join("\n");
}

export function defaultConfigText(): string {
  return `${JSON.stringify({ version: 1, thresholds: { soundDb: null, o2Percent: null, heatCelsius: null }, tactileFuseNewtons: 5, laws: { carbon: true, human: true, silicon: true }, watermark: WATERMARK, hardware: [] }, null, 2)}\n`;
}

function acceptConfig(raw: unknown, soul: string): LocalConfig {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (Number(source.tactileFuseNewtons) < 5) throw new Error("触觉熔断不能低于 5 牛顿");
  const laws = source.laws && typeof source.laws === "object" ? (source.laws as Record<string, unknown>) : {};
  if (laws.carbon !== true || laws.human !== true || laws.silicon !== true) throw new Error("三定律必须保持开启");
  if (source.watermark !== WATERMARK) throw new Error("水印必须保留");
  const accepted = acceptSoul(soul);
  return {
    version: 1,
    thresholds: readThresholds(source.thresholds),
    tactileFuseNewtons: 5,
    laws: { carbon: true, human: true, silicon: true },
    watermark: WATERMARK,
    hardware: readHardware(source.hardware),
    soul: accepted,
    soulHash: createHash("sha256").update(accepted).digest("hex"),
  };
}

const RULE_FIELD = {
  noise: "soundDb",
  sound: "soundDb",
  heat: "heatCelsius",
  atmos: "heatCelsius",
  oxygen: "o2Percent",
  air: "o2Percent",
  o2: "o2Percent",
} as const;

export function writeTightenedConfig(home: string, key: string, max: number): LocalThresholds {
  const field = RULE_FIELD[key as keyof typeof RULE_FIELD];
  if (!field) throw new Error("未知警告线");
  const configPath = path.join(home, "CONFIG.json");
  const raw = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
  const current = readThresholds(raw.thresholds);
  if (field === "soundDb" && current.soundDb != null && max > current.soundDb) throw new Error("声音线只能收紧，不能放宽");
  if (field === "heatCelsius" && current.heatCelsius != null && max > current.heatCelsius) throw new Error("温度线只能收紧");
  if (field === "o2Percent" && current.o2Percent != null && max < current.o2Percent) throw new Error("氧气线只能收紧，不能把缺氧标成安全");
  const thresholds = readThresholds({ ...current, [field]: max });
  raw.thresholds = thresholds;
  writeFileSync(configPath, `${JSON.stringify(raw, null, 2)}\n`, { mode: 0o600 });
  return thresholds;
}

function fileExists(file: string): boolean {
  try {
    readFileSync(file);
    return true;
  } catch {
    return false;
  }
}

export function openLocalVault(home = localHome()) {
  mkdirSync(home, { recursive: true, mode: 0o700 });
  const configPath = path.join(home, "CONFIG.json");
  const soulPath = path.join(home, "SOUL.md");
  if (!fileExists(configPath)) writeFileSync(configPath, defaultConfigText(), { mode: 0o600 });
  if (!fileExists(soulPath)) writeFileSync(soulPath, defaultSoul(), { mode: 0o600 });

  const db = new DatabaseSync(path.join(home, "scans.sqlite"));
  db.exec(`
    create table if not exists scan_records (
      id integer primary key autoincrement,
      at text not null,
      host_id text not null,
      dimension text not null,
      level text not null check (level in ('SAFE', 'WARNING', 'CRITICAL')),
      value text not null,
      note text not null
    );
    create table if not exists alert_history (
      id text primary key,
      at text not null,
      severity text not null check (severity in ('warning', 'critical')),
      dimension text not null,
      title text not null,
      detail text not null
    );
  `);
  const insertScan = db.prepare("insert into scan_records (at, host_id, dimension, level, value, note) values (?, ?, ?, ?, ?, ?)");
  const insertAlert = db.prepare("insert or replace into alert_history (id, at, severity, dimension, title, detail) values (?, ?, ?, ?, ?, ?)");

  let current = readDisk();
  let lastError = "";
  let lastScan = "";
  const listeners = new Set<(config: LocalConfig) => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watcher: FSWatcher | undefined;
  try {
    watcher = watch(home, () => {
      clearTimeout(timer);
      timer = setTimeout(reload, 150);
    });
    watcher.on("error", () => {
      watcher?.close();
      watcher = undefined;
    });
  } catch {
    watcher = undefined;
  }

  function readDisk(): LocalConfig {
    return acceptConfig(JSON.parse(readFileSync(configPath, "utf8")), readFileSync(soulPath, "utf8"));
  }

  function chain(soul: string) {
    const file = path.join(home, "soul.chain");
    let body = "";
    try {
      body = readFileSync(file, "utf8");
    } catch {
      body = "";
    }
    const previous = body.trim().split("\n").at(-1) || "";
    const next = createHash("sha256").update(`${previous}\n${soul}`).digest("hex");
    if (body.includes(next)) return;
    writeFileSync(file, `${body}${next}\n`, { mode: 0o600 });
  }

  function reload() {
    try {
      const next = readDisk();
      if (next.soulHash !== current.soulHash) chain(next.soul);
      current = next;
      lastError = "";
      for (const listener of listeners) listener(current);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "本地配置没有生效";
    }
  }

  return {
    home,
    config: () => current,
    lastError: () => lastError,
    onChange(listener: (config: LocalConfig) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    recordScan(frame: RadarSnapshot): boolean {
      const signature = DIMS.map((key) => `${frame.dims?.[key]?.level}:${frame.dims?.[key]?.value}`).join("|");
      if (signature === lastScan) return false;
      const at = clip(frame.at || new Date().toISOString(), 40);
      const hostId = clip(frame.hostId || "ras-host", 40);
      let wrote = 0;
      for (const dimension of DIMS) {
        const row = frame.dims?.[dimension];
        const level = row?.level;
        if (level !== "SAFE" && level !== "WARNING" && level !== "CRITICAL") continue;
        insertScan.run(at, hostId, dimension, level, clip(row.value, 80), clip(row.note, 120));
        wrote += 1;
      }
      if (wrote === 0) return false;
      lastScan = signature;
      return true;
    },
    recordAlert(alert: AlertRow) {
      if (!DIMS.includes(alert.dimension)) return;
      insertAlert.run(alert.id, alert.at, alert.severity === "warning" ? "warning" : "critical", alert.dimension, clip(alert.title, 80), clip(alert.detail, 140));
    },
    recentScans(limit = 14): ScanRow[] {
      return db.prepare("select at, host_id as hostId, dimension, level, value, note from scan_records order by id desc limit ?").all(Math.min(limit, 200)) as unknown as ScanRow[];
    },
    recentAlerts(limit = 40): AlertRow[] {
      return db.prepare("select id, at, severity, dimension, title, detail from alert_history order by at desc limit ?").all(Math.min(limit, 200)) as unknown as AlertRow[];
    },
    close() {
      clearTimeout(timer);
      watcher?.close();
      db.close();
    },
  };
}
