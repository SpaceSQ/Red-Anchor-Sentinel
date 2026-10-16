export const DIM_KEYS = [
  "light",
  "atmos",
  "sound",
  "wave",
  "power",
  "vision",
  "air",
  "pressure",
  "odor",
  "tactile",
  "magnetic",
  "gravity",
  "water",
  "food",
] as const;

export type DimKey = (typeof DIM_KEYS)[number];
export type Level = "SAFE" | "WARNING" | "CRITICAL";

export const DIM_NAME: Record<DimKey, string> = {
  light: "Light",
  atmos: "Air",
  sound: "Sound",
  wave: "Wave",
  power: "Power",
  vision: "Vision",
  air: "Breath",
  pressure: "Pressure",
  odor: "Odor",
  tactile: "Touch",
  magnetic: "Magnetic",
  gravity: "Gravity",
  water: "Water",
  food: "Food",
};

export interface DimReading {
  level: Level;
  value: string;
  note: string;
}

export interface RadarPoint {
  id: string;
  ring: "host" | "lan" | "cloud";
  level: Level;
  label: string;
}

export interface RadarFrame {
  type: "radar";
  hostId: string;
  at: string;
  dims: Record<DimKey, DimReading>;
  points: RadarPoint[];
}

export interface AlertFrame {
  type: "alert";
  id: string;
  at: string;
  severity: "critical";
  dimension: DimKey;
  title: string;
  detail: string;
}

export interface HostRules {
  soundDb: number | null;
  o2Percent: number | null;
  heatCelsius: number | null;
}

export interface StateFrame {
  type: "state";
  rules: HostRules;
  fuseArmed: boolean;
  laws: { carbon: true; human: true; silicon: true };
}

export interface PairTicket {
  v: 1;
  name: string;
  host: string;
  port: number;
  nonce: string;
}

export interface PairGrant {
  token: string;
  hostName: string;
  scope: Array<"radar" | "control">;
}

export type HostCommand =
  | { op: "pair"; nonce: string }
  | { op: "tighten"; soundDb?: number; o2Percent?: number; heatCelsius?: number }
  | { op: "fuse"; reason: string }
  | { type: "tighten_rule"; key: "noise" | "oxygen" | "heat"; max: number };

export const BONJOUR_SERVICE = "_ras._tcp";

export interface NeuroAxes {
  energy: number;
  appetite: number;
  bravery: number;
  intel: number;
  affection: number;
}

const HEADROOM: Record<Level, number> = { SAFE: 100, WARNING: 45, CRITICAL: 8 };

function axis(dims: Record<DimKey, DimReading>, keys: DimKey[]): number {
  const total = keys.reduce((sum, key) => sum + (HEADROOM[dims[key]?.level] ?? 0), 0);
  return Math.round(total / keys.length);
}

/** Headroom from the 14 readings. SAFE is 100. A critical oxygen reading pulls Energy down. */
export function toNeuroAxes(dims: Record<DimKey, DimReading>): NeuroAxes {
  return {
    energy: axis(dims, ["power", "light", "air"]),
    appetite: axis(dims, ["food", "water"]),
    bravery: axis(dims, ["tactile", "sound", "pressure"]),
    intel: axis(dims, ["vision", "wave", "magnetic"]),
    affection: axis(dims, ["atmos", "odor", "gravity"]),
  };
}

export function snapshotToRadar(data: { hostId?: string; at?: string; dims?: Record<string, Partial<DimReading>>; points?: RadarPoint[] }): RadarFrame {
  const dims = emptyDims();
  for (const key of DIM_KEYS) {
    const row = data.dims?.[key];
    if (!row) continue;
    const level = row.level === "WARNING" || row.level === "CRITICAL" ? row.level : "SAFE";
    dims[key] = { level, value: String(row.value || "—").slice(0, 80), note: String(row.note || "").slice(0, 120) };
  }
  return {
    type: "radar",
    hostId: String(data.hostId || "ras-host"),
    at: String(data.at || new Date().toISOString()),
    dims,
    points: Array.isArray(data.points) ? data.points : [],
  };
}

export function emptyDims(): Record<DimKey, DimReading> {
  const dims = {} as Record<DimKey, DimReading>;
  for (const key of DIM_KEYS) dims[key] = { level: "SAFE", value: "—", note: "Waiting for the host" };
  return dims;
}

export function parseTicket(raw: string): PairTicket {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error("That QR code is not a host ticket");
  }
  if (!body || typeof body !== "object") throw new Error("That QR code is not a host ticket");
  const row = body as Record<string, unknown>;
  const host = String(row.host || "").trim();
  const port = Number(row.port);
  const nonce = String(row.nonce || "").trim();
  const name = String(row.name || "Red Anchor").trim().slice(0, 40);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || nonce.length < 8) {
    throw new Error("The ticket is missing the host, port, or code");
  }
  if (host.includes("/") || host.includes(" ")) throw new Error("That host address is not valid");
  return { v: 1, name, host, port, nonce };
}

export function tightenPatch(current: HostRules, next: HostRules): HostRules {
  const sound = bound(next.soundDb, 45, 80, "Sound warning must stay between 45 and 80 dB");
  const oxygen = bound(next.o2Percent, 19.5, 22, "Oxygen warning cannot go below 19.5%");
  const heat = bound(next.heatCelsius, 28, 40, "Heat warning must stay between 28 and 40 °C");
  if (sound != null && current.soundDb != null && sound > current.soundDb) {
    throw new Error("The sound line can only be tightened");
  }
  if (oxygen != null && current.o2Percent != null && oxygen < current.o2Percent) {
    throw new Error("The oxygen line can only be tightened");
  }
  if (heat != null && current.heatCelsius != null && heat > current.heatCelsius) {
    throw new Error("The heat line can only be tightened");
  }
  return { soundDb: sound, o2Percent: oxygen, heatCelsius: heat };
}

function bound(value: number | null, min: number, max: number, message: string): number | null {
  if (value == null || Number.isNaN(value)) return null;
  if (value < min || value > max) throw new Error(message);
  return value;
}

export function demoRadar(): RadarFrame {
  const dims = emptyDims();
  dims.atmos = { level: "WARNING", value: "30 °C", note: "The room is warm" };
  dims.air = { level: "SAFE", value: "20.9%", note: "Oxygen is on the baseline" };
  dims.tactile = { level: "SAFE", value: "0.4 N", note: "Below the 5-newton fuse" };
  return {
    type: "radar",
    hostId: "demo-host",
    at: new Date().toISOString(),
    dims,
    points: [
      { id: "self", ring: "host", level: "SAFE", label: "Local inference" },
      { id: "lan", ring: "lan", level: "WARNING", label: "Room air" },
    ],
  };
}

export function demoAlert(): AlertFrame {
  return {
    type: "alert",
    id: `demo-${Date.now()}`,
    at: new Date().toISOString(),
    severity: "critical",
    dimension: "atmos",
    title: "Heat crossed the warning line",
    detail: "The host reports heat above the warning line. This phone only relays it.",
  };
}
