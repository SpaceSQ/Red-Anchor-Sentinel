import assert from "node:assert/strict";
import test from "node:test";
import { acceptRadar, isPrivateAddress, startLink } from "./link.mjs";

function once(ws, pred) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("等待主机应答超时")), 3000);
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!pred(message)) return;
      clearTimeout(timer);
      resolve(message);
    });
  });
}

test("only private addresses may open the host socket", () => {
  assert.equal(isPrivateAddress("192.168.1.20"), true);
  assert.equal(isPrivateAddress("10.0.0.4"), true);
  assert.equal(isPrivateAddress("172.16.0.2"), true);
  assert.equal(isPrivateAddress("127.0.0.1"), true);
  assert.equal(isPrivateAddress("8.8.8.8"), false);
  assert.equal(isPrivateAddress("1.1.1.1"), false);
});

test("account mail requests answer with JSON and do not send before privacy is accepted", async () => {
  const link = await startLink({ port: 0, controlPort: 0, mdns: false, persist: false, host: "127.0.0.1", hostName: "测试主机" });
  try {
    const health = await fetch(`http://127.0.0.1:${link.port}/account/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);
    const response = await fetch(`http://127.0.0.1:${link.port}/account/send-code`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "pilot@example.com", privacy: false, locale: "en" }),
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.match(body.error, /privacy/i);
  } finally {
    await link.close();
  }
});

test("radar frames keep the fourteen dimensions and drop extra inventory", () => {
  const dims = Object.fromEntries(["light", "atmos", "sound", "wave", "power", "vision", "air", "pressure", "odor", "tactile", "magnetic", "gravity", "water", "food"].map((key) => [key, { level: "SAFE", value: "1", note: "ok" }]));
  dims.atmos = { level: "WARNING", value: "30°C", note: "暖通" };
  const frame = acceptRadar({ type: "radar", dims, points: [{ id: "x", ring: "lan", level: "WARNING", label: "客厅暖通", address: "10.0.0.9" }] });
  assert.equal(Object.keys(frame.dims).length, 14);
  assert.equal(frame.points[0].label, "客厅暖通");
  assert.equal("address" in frame.points[0], false);
});

test("pairing grants a token only after the desktop confirms", async () => {
  const link = await startLink({ port: 0, controlPort: 0, mdns: false, persist: false, host: "127.0.0.1", hostName: "测试主机" });
  try {
    const ticket = link.ticket();
    const ws = new WebSocket(`ws://127.0.0.1:${link.port}/ras`);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    const denied = once(ws, (message) => message.op === "deny");
    ws.send(JSON.stringify({ op: "pair", nonce: "wrong-nonce" }));
    assert.match((await denied).detail, /不一致/);

    const pending = once(ws, (message) => message.op === "pending");
    ws.send(JSON.stringify({ op: "pair", nonce: ticket.nonce }));
    assert.equal((await pending).op, "pending");
    const status = await (await fetch(`http://127.0.0.1:${link.controlPort}/status`)).json();
    assert.equal(status.pending.length, 1);

    const granted = once(ws, (message) => message.op === "grant");
    const radar = once(ws, (message) => message.type === "radar");
    const confirmed = await fetch(`http://127.0.0.1:${link.controlPort}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: status.pending[0].address }),
    });
    assert.equal((await confirmed.json()).ok, true);
    const grant = await granted;
    assert.equal(grant.scope.includes("control"), true);
    assert.equal(Object.keys((await radar).dims).length, 14);

    const rejected = once(ws, (message) => message.op === "reject");
    ws.send(JSON.stringify({ op: "tighten", token: grant.token, soundDb: 80, o2Percent: 19.5, heatCelsius: 40 }));
    ws.send(JSON.stringify({ op: "tighten", token: grant.token, soundDb: 90 }));
    const first = await rejected;
    assert.match(first.detail, /收紧|45|80|放宽/);
    ws.close();
  } finally {
    await link.close();
  }
});
