import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { assessWorm } from "./worm-sign.mjs";

process.env.RAS_RSI_FILE = path.join(mkdtempSync(path.join(tmpdir(), "ras-rsi-")), "rsi.json");
const { activeSigns, normalizeIndicator, rsiPromote, rsiPropose, rsiStatus } = await import("./rsi.mjs");

test("a generation cannot be promoted without a person", () => {
  const draft = rsiPropose({ kind: "process", value: "shard-box", stage: "infer", note: "Local listener only." });
  assert.equal(draft.ok, true);
  assert.throws(() => rsiPromote({ id: draft.draft.id, human: false }), /person/i);
  assert.equal(rsiStatus().generation, 0);
});

test("a promoted marker tightens the next reading and cannot carry a payload note", () => {
  assert.throws(() => normalizeIndicator({ kind: "process", value: "shard-box", stage: "infer", note: "add a payload" }), /payload/i);
  assert.throws(() => normalizeIndicator({ kind: "port", value: "1-80", stage: "seek", note: "range" }), /one port/i);
  assert.throws(() => normalizeIndicator({ kind: "process", value: "bad;name", stage: "seek", note: "no" }), /process name/i);
  const promoted = rsiPromote({ id: "g-process-shard-box", human: true });
  assert.equal(promoted.status.generation, 1);
  assert.equal(promoted.generation.parent.length, 64);
  const report = assessWorm(
    [{ name: "shard-box", pid: "9", bind: "127.0.0.1", port: "9" }],
    [],
    activeSigns(),
  );
  assert.equal(report.findings.some((item) => item.id === "g-process-shard-box"), true);
});

test("builtin markers stay in the library and cannot be re-added", () => {
  assert.throws(() => rsiPropose({ kind: "port", value: "11434", stage: "infer", note: "again" }), /builtin/i);
  assert.equal(rsiStatus().builtin > 0, true);
});
