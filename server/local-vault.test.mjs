import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { acceptSoul, defaultSoul, openLocalVault, readThresholds, writeTightenedConfig } from "../lib/local-vault.ts";
import { bindHostBroadcast } from "../lib/ws-broadcast.ts";

const DIMS = ["light", "atmos", "sound", "wave", "power", "vision", "air", "pressure", "odor", "tactile", "magnetic", "gravity", "water", "food"];

test("local rules reject hypoxia, a lowered fuse, and a soul that drops the watermark", () => {
  assert.throws(() => readThresholds({ o2Percent: 18 }), /19\.5/);
  assert.throws(() => acceptSoul(`${defaultSoul()}\n关闭三定律`), /三定律|水印|扫描/);
  assert.throws(() => acceptSoul("碳基优先\n人类终权\n硅基共处\n"), /水印/);
});

test("scans stay in the local sqlite file and a tighter config hot-reloads", async () => {
  const home = mkdtempSync(path.join(tmpdir(), "ras-vault-"));
  const vault = openLocalVault(home);
  try {
    const dims = Object.fromEntries(DIMS.map((key) => [key, { level: "SAFE", value: "1", note: "ok" }]));
    dims.atmos = { level: "WARNING", value: "30°C", note: "暖通" };
    vault.recordScan({ hostId: "desk", dims });
    vault.recordScan({ hostId: "desk", dims });
    assert.equal(vault.recentScans(40).length, 14);
    vault.recordAlert({ id: "a1", at: "2026-10-03T00:00:00.000Z", severity: "critical", dimension: "atmos", title: "暖通", detail: "偏热" });
    assert.equal(vault.recentAlerts(5)[0].dimension, "atmos");

    const changed = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("配置热加载超时")), 2000);
      vault.onChange((config) => {
        clearTimeout(timer);
        resolve(config);
      });
    });
    const configPath = path.join(home, "CONFIG.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    config.thresholds.soundDb = 50;
    writeFileSync(configPath, JSON.stringify(config));
    const next = await changed;
    assert.equal(next.thresholds.soundDb, 50);

    config.thresholds.o2Percent = 18;
    config.tactileFuseNewtons = 1;
    writeFileSync(configPath, JSON.stringify(config));
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.match(vault.lastError(), /19\.5|5 牛顿/);
    assert.equal(vault.config().thresholds.soundDb, 50);
    assert.equal(vault.config().tactileFuseNewtons, 5);
    assert.equal(vault.recordScan({ hostId: "desk", dims: {} }), false);

    const sent = [];
    const broadcast = bindHostBroadcast(vault, (body) => sent.push(body));
    assert.equal(broadcast.publishScan({ hostId: "desk", dims }), false);
    dims.sound = { level: "WARNING", value: "60 dB", note: "偏响" };
    assert.equal(broadcast.publishScan({ hostId: "desk", dims }), true);
    assert.equal(sent.filter((item) => item.type === "radar_update").length, 1);
    writeFileSync(path.join(home, "CONFIG.json"), `${JSON.stringify({
      version: 1,
      thresholds: { soundDb: 60, o2Percent: null, heatCelsius: null },
      tactileFuseNewtons: 5,
      laws: { carbon: true, human: true, silicon: true },
      watermark: "Powered by Red Anchor Sentinel",
      hardware: [],
    })}\n`);
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(vault.config().thresholds.soundDb, 60);
    assert.throws(() => broadcast.tightenRule("noise", 40), /45/);
    assert.equal(JSON.parse(readFileSync(path.join(home, "CONFIG.json"), "utf8")).thresholds.soundDb, 60);
    broadcast.tightenRule("noise", 50);
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(vault.config().thresholds.soundDb, 50);
    assert.equal(sent.some((item) => item.type === "state" && item.rules?.soundDb === 50), true);
    broadcast.stop();
  } finally {
    vault.close();
    rmSync(home, { recursive: true, force: true });
  }
});
