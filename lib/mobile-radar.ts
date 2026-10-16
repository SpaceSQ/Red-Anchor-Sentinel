import { assess } from "./assess";
import type { LabRules } from "./lab-rules";
import { CLEAN_INTENT, DIM_KEYS, DIM_META, EARTH, levelFromScore, readout, type DimKey, type Level } from "./tensor";

export interface MobileRadarFrame {
  type: "radar";
  hostId: string;
  at: string;
  dims: Record<DimKey, { level: Level; value: string; note: string }>;
  points: { id: string; ring: "host"; level: Level; label: string }[];
}

/** Room anchor only. The phone does not receive the LAN device list. */
export function hostRadarFrame(rules?: LabRules | null): MobileRadarFrame {
  const report = assess(EARTH, CLEAN_INTENT, "UNPATCHED", rules);
  const dims = {} as MobileRadarFrame["dims"];
  const points: MobileRadarFrame["points"] = [];
  for (const key of DIM_KEYS) {
    const level = levelFromScore(report.scores[key]);
    const reading = readout(report.tensor, key);
    dims[key] = { level, value: reading.actual, note: reading.baseline };
    if (level !== "SAFE") points.push({ id: key, ring: "host", level, label: DIM_META[key].name });
  }
  if (points.length === 0) points.push({ id: "anchor", ring: "host", level: "SAFE", label: "本机锚点" });
  return { type: "radar", hostId: "ras-host", at: new Date().toISOString(), dims, points };
}
