import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { BUILTIN_SIGNS } from "./worm-sign.mjs";

const STAGES = new Set(["seek", "execute", "infer", "spread"]);
const PROCESS = /^[a-z0-9][a-z0-9._-]{1,31}$/i;
const FILE = process.env.RAS_RSI_FILE || path.join(homedir(), "RedAnchorVault", "rsi.json");

function empty() {
  return { chain: [], drafts: [] };
}

function load() {
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8"));
    return {
      chain: Array.isArray(parsed.chain) ? parsed.chain : [],
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
    };
  } catch {
    return empty();
  }
}

function save(state) {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(state, null, 2));
}

export function builtinHash() {
  return createHash("sha256").update(JSON.stringify(BUILTIN_SIGNS.map((sign) => sign.id))).digest("hex");
}

function generationHash(parent, signs) {
  return createHash("sha256").update(JSON.stringify({ parent, signs })).digest("hex");
}

export function activeSigns() {
  const state = load();
  return state.chain.flatMap((generation) => generation.signs || []);
}

export function rsiStatus() {
  const state = load();
  const head = state.chain[state.chain.length - 1];
  return {
    generation: state.chain.length,
    parent: head ? head.hash : builtinHash(),
    builtin: BUILTIN_SIGNS.length,
    added: state.chain.reduce((sum, generation) => sum + (generation.signs || []).length, 0),
    drafts: state.drafts.length,
    law: "A generation may only add a local process name or a single port. It cannot scan the WAN, copy this program, read process memory, or loosen a bound. A person promotes every generation.",
  };
}

export function normalizeIndicator(body) {
  const kind = body?.kind === "port" ? "port" : body?.kind === "process" ? "process" : "";
  const stage = String(body?.stage || "");
  const note = String(body?.note || "").replace(/\s+/g, " ").trim().slice(0, 180);
  const noteZh = String(body?.noteZh || "").replace(/\s+/g, " ").trim().slice(0, 180);
  if (!kind || !STAGES.has(stage)) {
    throw new Error("A marker needs kind process or port, and a stage of seek, execute, infer, or spread.");
  }
  if (/\b(sweep|payload|exploit|password|credential)\b/i.test(`${note} ${noteZh}`)) {
    throw new Error("A marker note cannot carry a sweep, a payload, or a credential.");
  }
  let value = "";
  if (kind === "port") {
    const port = Number(body.value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("A port marker is one port, not a range.");
    value = String(port);
  } else {
    value = String(body.value || "").trim();
    if (!PROCESS.test(value)) throw new Error("A process marker is a short process name.");
  }
  return {
    id: `g-${kind}-${value.toLowerCase()}`,
    stage,
    kind,
    value,
    title: kind === "port" ? `Port ${value}` : value,
    titleZh: kind === "port" ? `端口 ${value}` : value,
    note: note || "Promoted from a local observation.",
    noteZh: noteZh || "由本机观察确认后加入。",
  };
}

export function rsiPropose(body) {
  const sign = normalizeIndicator(body);
  const state = load();
  if (BUILTIN_SIGNS.some((item) => item.id === sign.id || (item.kind === sign.kind && String(item.value) === sign.value))) {
    throw new Error("That marker is already in the builtin library.");
  }
  if (state.chain.some((generation) => (generation.signs || []).some((item) => item.id === sign.id))) {
    throw new Error("That marker is already in a promoted generation.");
  }
  state.drafts = state.drafts.filter((item) => item.id !== sign.id);
  state.drafts.push({ ...sign, draftedAt: new Date().toISOString() });
  save(state);
  return { ok: true, draft: sign, status: rsiStatus() };
}

export function rsiProposeMany(indicators) {
  const added = [];
  for (const indicator of indicators) {
    try {
      added.push(rsiPropose(indicator).draft);
    } catch {
      /* already known or not a legal marker */
    }
  }
  return added;
}

export function rsiPromote(body) {
  if (body?.human !== true) throw new Error("A person must confirm this generation.");
  const id = String(body?.id || "");
  const state = load();
  const draft = state.drafts.find((item) => item.id === id);
  if (!draft) throw new Error("That draft does not exist.");
  const sign = normalizeIndicator(draft);
  const parent = state.chain.length ? state.chain[state.chain.length - 1].hash : builtinHash();
  const generation = {
    id: `g${state.chain.length + 1}`,
    parent,
    hash: generationHash(parent, [sign]),
    signs: [sign],
    promotedAt: new Date().toISOString(),
  };
  state.chain.push(generation);
  state.drafts = state.drafts.filter((item) => item.id !== id);
  save(state);
  return { ok: true, generation, status: rsiStatus() };
}
