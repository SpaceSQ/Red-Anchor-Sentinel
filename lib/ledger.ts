import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { SENTINEL } from "./did";
import type { LedgerBlock, LedgerKind, LedgerPayload } from "./ledger-types";

export type { LedgerBlock, LedgerKind, LedgerPayload };

const KINDS = new Set<LedgerKind>([
  "GENESIS",
  "ASSESSMENT",
  "TRUST",
  "ISOLATE",
  "PATCH",
  "ROLLBACK",
  "GOSSIP",
]);

const FILE = path.join(process.cwd(), "data", "ledger.json");

const GENESIS_PAYLOAD: LedgerPayload = {
  kind: "GENESIS",
  sourceDid: SENTINEL.did,
  targetDid: "",
  sourceU6a: SENTINEL.u6a,
  targetU6a: "",
  note: "红锚基地 L0 轻量哈希链创世块",
  carbon: "UNMEASURED",
  silicon: "UNMEASURED",
  patchStatus: "UNPATCHED",
  matrix: [],
};

function blockHash(input: Omit<LedgerBlock, "hash">): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function genesisBlock(): LedgerBlock {
  const body = {
    index: 0,
    timestamp: "2026-04-05T00:00:00.000Z",
    prevHash: "0".repeat(64),
    payload: GENESIS_PAYLOAD,
  };
  return { ...body, hash: blockHash(body) };
}

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readFileChain(): Promise<LedgerBlock[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as LedgerBlock[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [genesisBlock()];
    return parsed;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [genesisBlock()];
    throw error;
  }
}

async function writeChain(chain: LedgerBlock[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(chain, null, 2));
}

export function assertPayload(input: unknown): LedgerPayload {
  if (!input || typeof input !== "object") throw new Error("空载荷");
  const body = input as Record<string, unknown>;
  const kind = body.kind;
  if (typeof kind !== "string" || !KINDS.has(kind as LedgerKind) || kind === "GENESIS") {
    throw new Error("不允许的记录类型");
  }
  const sourceDid = String(body.sourceDid ?? "");
  const targetDid = String(body.targetDid ?? "");
  const sourceU6a = String(body.sourceU6a ?? "");
  const targetU6a = String(body.targetU6a ?? "");
  const note = String(body.note ?? "").slice(0, 280);
  const carbon = String(body.carbon ?? "").slice(0, 16);
  const silicon = String(body.silicon ?? "").slice(0, 16);
  const patchStatus = String(body.patchStatus ?? "").slice(0, 16);
  if (!/^[A-Z0-9]{22}$/.test(sourceDid)) throw new Error("源 DID 非法");
  if (targetDid !== "" && !/^[A-Z0-9]{22}$/.test(targetDid)) throw new Error("目标 DID 非法");
  const matrix = Array.isArray(body.matrix) ? body.matrix.map(Number) : [];
  if (matrix.length !== 0 && matrix.length !== 14) throw new Error("矩阵长度必须为 14");
  if (matrix.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) {
    throw new Error("矩阵分值越界");
  }
  return {
    kind: kind as LedgerKind,
    sourceDid,
    targetDid,
    sourceU6a: sourceU6a.slice(0, 80),
    targetU6a: targetU6a.slice(0, 80),
    note,
    carbon,
    silicon,
    patchStatus,
    matrix,
  };
}

export async function getChain(): Promise<LedgerBlock[]> {
  return enqueue(async () => {
    const chain = await readFileChain();
    if (chain[0]?.payload.kind !== "GENESIS") {
      const fresh = [genesisBlock()];
      await writeChain(fresh);
      return fresh;
    }
    await writeChain(chain);
    return chain;
  });
}

export async function appendBlock(payload: LedgerPayload): Promise<LedgerBlock> {
  return enqueue(async () => {
    const chain = await readFileChain();
    if (chain.length >= 500) throw new Error("演示账本已满");
    const prev = chain[chain.length - 1] ?? genesisBlock();
    const body = {
      index: prev.index + 1,
      timestamp: new Date().toISOString(),
      prevHash: prev.hash,
      payload,
    };
    const block = { ...body, hash: blockHash(body) };
    chain.push(block);
    await writeChain(chain);
    return block;
  });
}
