import { DIM_KEYS, EARTH, readout, type DimKey, type Tensor14 } from "./tensor";

export type TimePhase = "past" | "present" | "future";
export type Trend = "up" | "down" | "unknown";
export type Magnitude = "low" | "med" | "high";
export type TrackSource = "override" | "sensor" | "inferred";

export interface InferenceItem {
  dimension: DimKey;
  trend: Trend;
  magnitude: Magnitude;
  summary: string;
  start: string;
  end: string;
  icon: "water" | "food" | "wave" | "none";
}

export interface SensorPoint {
  value: number;
  baseline: number;
  unit: string;
  label: string;
}

export interface ManualOverride {
  phase: TimePhase;
  dimension: DimKey;
  value: string;
  description: string;
}

export interface ResolvedTrack {
  source: TrackSource;
  sensor: SensorPoint | null;
  inferred: InferenceItem | null;
  override: ManualOverride | null;
}

const DIM_SET = new Set<string>(DIM_KEYS);

export function isDimKey(value: string): value is DimKey {
  return DIM_SET.has(value);
}

export function sensorPoint(tensor: Tensor14, key: DimKey): SensorPoint | null {
  if (key === "water" || key === "food") return null;
  if (JSON.stringify(tensor[key]) === JSON.stringify(EARTH[key])) return null;
  const label = readout(tensor, key).actual;
  switch (key) {
    case "light":
      return { value: tensor.light.lux, baseline: EARTH.light.lux, unit: "lx", label };
    case "atmos":
      return { value: tensor.atmos.celsius, baseline: EARTH.atmos.celsius, unit: "°C", label };
    case "sound":
      return { value: tensor.sound.db, baseline: EARTH.sound.db, unit: "dB", label };
    case "wave":
      return { value: tensor.wave.occupancy, baseline: EARTH.wave.occupancy, unit: "%", label };
    case "power":
      return { value: tensor.power.watts, baseline: EARTH.power.watts, unit: "W", label };
    case "vision":
      return { value: tensor.vision.hazard, baseline: EARTH.vision.hazard, unit: "", label };
    case "air":
      return { value: tensor.air.o2, baseline: EARTH.air.o2, unit: "% O₂", label };
    case "pressure":
      return { value: tensor.pressure.kpa, baseline: EARTH.pressure.kpa, unit: "kPa", label };
    case "odor":
      return { value: tensor.odor.concentration, baseline: EARTH.odor.concentration, unit: "", label };
    case "tactile":
      return { value: tensor.tactile.newtons, baseline: EARTH.tactile.newtons, unit: "N", label };
    case "magnetic":
      return { value: tensor.magnetic.microtesla, baseline: EARTH.magnetic.microtesla, unit: "µT", label };
    case "gravity":
      return { value: tensor.gravity.ms2, baseline: EARTH.gravity.ms2, unit: "m/s²", label };
    default:
      return null;
  }
}

export function resolveTrack(input: {
  sensor: SensorPoint | null;
  inferred: InferenceItem | null;
  override: ManualOverride | null;
}): ResolvedTrack {
  if (input.override && (input.override.value.trim() || input.override.description.trim())) {
    return { source: "override", sensor: input.sensor, inferred: input.inferred, override: input.override };
  }
  if (input.sensor) return { source: "sensor", sensor: input.sensor, inferred: input.inferred, override: null };
  if (input.inferred) return { source: "inferred", sensor: null, inferred: input.inferred, override: null };
  return { source: "inferred", sensor: null, inferred: null, override: null };
}

function windowFromNow(minutes: number): { start: string; end: string } {
  const start = new Date();
  const end = new Date(start.getTime() + minutes * 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function draftFromNotes(notes: string, now = new Date()): InferenceItem[] {
  const text = notes.slice(0, 4000);
  const items: InferenceItem[] = [];
  const stamp = (minutes: number) => {
    const end = new Date(now.getTime() + minutes * 60_000);
    return { start: now.toISOString(), end: end.toISOString() };
  };
  if (/洗衣|水表|淋浴|洗碗/.test(text)) {
    items.push({
      dimension: "water",
      trend: "up",
      magnitude: "med",
      summary: "中低幅度消耗",
      icon: "water",
      ...stamp(45),
    });
  }
  if (/生鲜|冷链|外卖|买菜|食物|京东/.test(text)) {
    items.push({
      dimension: "food",
      trend: "up",
      magnitude: "low",
      summary: "食物储备小幅上升",
      icon: "food",
      ...stamp(240),
    });
  }
  if (/掉线|断网|信号波动|wifi/i.test(text)) {
    items.push({
      dimension: "wave",
      trend: "unknown",
      magnitude: "med",
      summary: "环境信号波动，原因待查",
      icon: "wave",
      ...stamp(30),
    });
  }
  if (/聚会|嘈杂|施工/.test(text)) {
    items.push({
      dimension: "sound",
      trend: "up",
      magnitude: "med",
      summary: "声环境预期抬升",
      icon: "none",
      ...stamp(180),
    });
  }
  return items;
}

export function normalizeItems(raw: unknown, now = new Date()): InferenceItem[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : [];
  const fallback = windowFromNow(60);
  const items: InferenceItem[] = [];
  for (const entry of list.slice(0, 14)) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const dimension = String(row.dimension || "");
    if (!isDimKey(dimension)) continue;
    const trend = row.trend === "up" || row.trend === "down" || row.trend === "unknown" ? row.trend : "unknown";
    const magnitude = row.magnitude === "low" || row.magnitude === "med" || row.magnitude === "high" ? row.magnitude : "low";
    const icon = row.icon === "water" || row.icon === "food" || row.icon === "wave" ? row.icon : dimension === "water" ? "water" : dimension === "food" ? "food" : dimension === "wave" ? "wave" : "none";
    items.push({
      dimension,
      trend,
      magnitude,
      summary: String(row.summary || "模型未给出描述").replace(/[<>]/g, "").slice(0, 80),
      start: typeof row.start === "string" ? row.start : now.toISOString(),
      end: typeof row.end === "string" ? row.end : fallback.end,
      icon,
    });
  }
  return items;
}
