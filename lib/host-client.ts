import type { InferenceItem } from "./dual-track";
import { PROFILE_KEY, type SentinelProfile } from "./profile";

export interface HardwareProfile {
  hostClass: "physical" | "virtual" | "container";
  hostname: string;
  entropy: string;
}

export interface ScanHit {
  id: string;
  tier: 1 | 2 | 3;
  name: string;
  vendor: string;
  purpose: string;
  uptimeSec: number;
  address: string;
  manifest: string[];
  note: string;
  patchAuthority: "full" | "confirm" | "mark-only";
}

async function host<T>(op: string, body: Record<string, unknown> = {}): Promise<T> {
  const tauri = await tauriHost<T>(op, body);
  if (tauri) return tauri;
  const response = await fetch("/api/host", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, ...body }),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "驻留引擎失败");
  return data;
}

async function tauriHost<T>(op: string, body: Record<string, unknown>): Promise<T | null> {
  if (typeof window === "undefined") return null;
  const marker = (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  if (!marker) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>("host_op", { op, body });
}

export function readCachedProfile(): SentinelProfile | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SentinelProfile;
  } catch {
    return null;
  }
}

export function cacheProfile(profile: SentinelProfile) {
  const stored = { ...profile, entropy: profile.entropy };
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(stored));
}

export async function fetchHardware(): Promise<HardwareProfile> {
  return host<HardwareProfile>("hardware");
}

export async function fetchScan(): Promise<ScanHit[]> {
  const result = await host<{ hits: ScanHit[] }>("scan");
  return result.hits;
}

export async function saveVault(profile: SentinelProfile, apiKey: string) {
  await host("saveVault", { dir: profile.vaultDir, entropy: profile.entropy, profile, apiKey });
  cacheProfile(profile);
}

export async function probeLlm(mode: "ollama" | "openai", baseUrl: string, apiKey: string) {
  return host<{ ok: boolean; count: number }>("probeLlm", { mode, baseUrl, apiKey });
}

export async function analyzeContext(baseUrl: string, model: string, notes: string, mode: "ollama" | "openai") {
  return host<{ engine: "llm" | "draft"; items: InferenceItem[]; note: string }>("analyzeContext", {
    baseUrl,
    model,
    notes,
    mode,
  });
}

export async function writeSoulOutbox(dir: string, name: string, text: string) {
  if (!dir) return;
  await host("writeOutbox", { dir, name, text });
}

export async function askAlign(baseUrl: string) {
  return host<{ risk: number; note: string; replies: string[] }>("askAlign", { baseUrl });
}

export async function readCard(baseUrl: string) {
  return host<{ cards: { path: string; name: string; models: string[] }[] }>("readCard", { baseUrl });
}

export async function checkClamp(baseUrl: string, hash: string) {
  return host<{ confirmed: boolean }>("checkClamp", { baseUrl, hash });
}

export async function publishGossip(note: { sourceDid: string; targetDid: string; targetId: string; level: "SAFE" | "WARNING" | "CRITICAL"; note: string }) {
  if (typeof localStorage === "undefined" || localStorage.getItem("red-anchor-gossip") !== "1") return;
  await fetch("/api/gossip", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(note),
  });
}
