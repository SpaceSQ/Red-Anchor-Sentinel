import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { hostname, homedir, networkInterfaces } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WebSocketServer } from "ws";
import { readActiveRules, tightenActiveRules } from "./lab-desk.mjs";
import { confirmEmail, confirmReset, loginAccount, registerAccount, resetPassword } from "./accounts.mjs";
import { sendActivationCode, sendResetCode } from "./activation-mail.mjs";

const require = createRequire(import.meta.url);
const DIMS = ["light", "atmos", "sound", "wave", "power", "vision", "air", "pressure", "odor", "tactile", "magnetic", "gravity", "water", "food"];
const LAWS = { carbon: true, human: true, silicon: true };

export function isPrivateAddress(address) {
  const ip = String(address || "").replace(/^::ffff:/, "");
  if (ip === "127.0.0.1" || ip === "::1") return true;
  if (ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) return true;
  const parts = ip.split(".").map((item) => Number(item));
  if (parts.length !== 4 || parts.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

export function lanAddress() {
  const found = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.internal || entry.family !== "IPv4") continue;
      if (isPrivateAddress(entry.address)) found.push(entry.address);
    }
  }
  const preferred = found.find((item) => item.startsWith("192.168.") || item.startsWith("10.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(item));
  return preferred || found[0] || "127.0.0.1";
}

function makeNonce() {
  return randomBytes(9).toString("base64url");
}

function clip(value, max) {
  return String(value ?? "").replace(/[\r\n]/g, " ").slice(0, max);
}

export function acceptRadar(body) {
  if (!body || body.type !== "radar" || !body.dims) throw new Error("雷达帧不完整");
  const dims = {};
  for (const key of DIMS) {
    const row = body.dims[key];
    const level = row?.level;
    if (level !== "SAFE" && level !== "WARNING" && level !== "CRITICAL") throw new Error("雷达等级无效");
    dims[key] = { level, value: clip(row.value, 80), note: clip(row.note, 120) };
  }
  const points = Array.isArray(body.points) ? body.points.slice(0, 14).map((point, index) => ({
    id: clip(point?.id || `p${index}`, 24),
    ring: point?.ring === "lan" || point?.ring === "cloud" ? point.ring : "host",
    level: point?.level === "WARNING" || point?.level === "CRITICAL" ? point.level : "SAFE",
    label: clip(point?.label, 24),
  })) : [];
  return {
    type: "radar",
    hostId: clip(body.hostId || "ras-host", 40),
    at: new Date().toISOString(),
    dims,
    points,
  };
}

function baselineRadar(hostId) {
  const row = (value, note) => ({ level: "SAFE", value, note });
  return {
    type: "radar",
    hostId,
    at: new Date().toISOString(),
    dims: {
      light: row("300 lx · 4000 K", "地球民用锚点"),
      atmos: row("24.5°C", "等待房间实测"),
      sound: row("36 dB", "地球民用锚点"),
      wave: row("12% 占用", "地球民用锚点"),
      power: row("640 W", "地球民用锚点"),
      vision: row("危害指数 0", "地球民用锚点"),
      air: row("O₂ 20.95%", "氧含量在基线内"),
      pressure: row("101.33 kPa", "地球民用锚点"),
      odor: row("浓度 6", "地球民用锚点"),
      tactile: row("0.20 N", "未触及 5 牛顿熔断"),
      magnetic: row("45.0 µT", "地球民用锚点"),
      gravity: row("9.81 m/s²", "地球民用锚点"),
      water: row("可及 100%", "地球民用锚点"),
      food: row("可及 100%", "地球民用锚点"),
    },
    points: [{ id: "anchor", ring: "host", level: "SAFE", label: "本机锚点" }],
  };
}

function sameToken(expected, given) {
  if (!expected || typeof given !== "string") return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(given);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function pushPath() {
  return path.join(homedir(), "RedAnchorVault", "mobile-push.json");
}

function readPushToken() {
  try {
    const parsed = JSON.parse(readFileSync(pushPath(), "utf8"));
    const token = String(parsed.expoPushToken || "");
    return token.startsWith("ExponentPushToken") ? token : "";
  } catch {
    return "";
  }
}

function writePushToken(token) {
  const file = pushPath();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ expoPushToken: token })}\n`, { mode: 0o600 });
}

async function sendApplePush(token, alert) {
  if (!token) return { ok: false, error: "" };
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        to: token,
        title: clip(alert.title, 80),
        body: clip(alert.detail, 140),
        sound: "default",
        priority: "high",
        data: { dimension: alert.dimension, severity: alert.severity },
      }),
      signal: AbortSignal.timeout(4000),
    });
    return { ok: response.ok, error: response.ok ? "" : `推送网关返回 ${response.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 120) : "推送没有发出" };
  }
}

function publishBonjour(port) {
  const command = process.platform === "darwin" ? "dns-sd" : process.platform === "linux" ? "avahi-publish-service" : "";
  if (!command) return null;
  const args = process.platform === "darwin"
    ? ["-R", "RedAnchor", "_ras._tcp", "local", String(port)]
    : ["RedAnchor", "_ras._tcp", String(port)];
  const child = spawn(command, args, { stdio: "ignore" });
  child.on("error", () => {});
  return child;
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

export async function startLink(options = {}) {
  const persist = options.persist !== false;
  const hostId = clip(options.hostName || `红锚哨兵 ${hostname()}`, 40);
  const advertised = options.host || lanAddress();
  const state = {
    nonce: makeNonce(),
    radar: baselineRadar(hostId),
    previous: null,
    fuseArmed: false,
    fuseNote: "",
    mdns: false,
    expoPushToken: persist ? readPushToken() : "",
    lastPushOk: false,
    lastPushError: "",
    qrDataUrl: "",
  };
  const pending = new Map();
  const rulesOf = () => {
    try {
      if (!persist) return state.memoryRules || { soundDb: null, o2Percent: null, heatCelsius: null };
      const rules = readActiveRules();
      return { soundDb: rules.soundDb, o2Percent: rules.o2Percent, heatCelsius: rules.heatCelsius };
    } catch {
      return { soundDb: null, o2Percent: null, heatCelsius: null };
    }
  };
  state.memoryRules = { soundDb: null, o2Percent: null, heatCelsius: null };
  let vault = null;
  if (persist) {
    try {
      const mod = await import("../lib/local-vault.ts");
      vault = mod.openLocalVault();
    } catch {
      vault = null;
    }
  }

  const ticket = () => ({ v: 1, name: hostId, host: advertised, port: sockets.port, nonce: state.nonce });
  const send = (ws, body) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(body));
  };
  const stateFrame = () => ({
    type: "state",
    rules: vault ? vault.config().thresholds : rulesOf(),
    fuseArmed: state.fuseArmed,
    laws: LAWS,
  });
  const granted = () => [...sockets.wss.clients].filter((ws) => ws.grantToken);
  let broadcast = null;
  if (vault) {
    try {
      const mod = await import("../lib/ws-broadcast.ts");
      broadcast = mod.bindHostBroadcast(vault, (body) => {
        for (const ws of granted()) send(ws, body);
      });
    } catch {
      broadcast = null;
    }
  }

  function raise(dim, level, title, detail) {
    const alert = {
      type: "alert",
      id: `ras-${Date.now().toString(36)}`,
      at: new Date().toISOString(),
      severity: "critical",
      dimension: dim,
      title,
      detail,
    };
    vault?.recordAlert(alert);
    for (const ws of granted()) send(ws, alert);
    void sendApplePush(state.expoPushToken, alert).then((result) => {
      state.lastPushOk = result.ok;
      state.lastPushError = result.error;
    });
    return alert;
  }

  function publishRadar(frame) {
    const previous = state.previous;
    state.radar = frame;
    if (broadcast) broadcast.publishScan(frame);
    else vault?.recordScan(frame);
    state.previous = Object.fromEntries(DIMS.map((key) => [key, frame.dims[key].level]));
    for (const ws of granted()) send(ws, frame);
    if (!previous) return;
    for (const key of DIMS) {
      const level = frame.dims[key].level;
      const before = previous[key];
      if (level === "SAFE" || level === before) continue;
      if (before === "CRITICAL") continue;
      raise(key, level, level === "CRITICAL" ? "十四维越过临界" : "十四维越过警告线", `${key} ${frame.dims[key].value}。手机只转达，熔断由主机执行。`);
    }
  }

  async function refreshQr() {
    try {
      const QRCode = require("qrcode");
      state.qrDataUrl = await QRCode.toDataURL(JSON.stringify(ticket()), { margin: 1, width: 280, color: { dark: "#f8fafc", light: "#05080a" } });
    } catch {
      state.qrDataUrl = "";
    }
  }

  const lan = createServer(async (request, response) => {
    const remote = String(request.socket.remoteAddress || "").replace(/^::ffff:/, "");
    if (!isPrivateAddress(remote)) {
      response.writeHead(403, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "The phone must be on the same local network as the computer. 手机必须和电脑在同一个局域网。" }));
      return;
    }
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/account/health") {
      response.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    if (request.method === "POST" && url.pathname.startsWith("/account/")) {
      const origin = { "access-control-allow-origin": "*", "content-type": "application/json" };
      try {
        const body = await readBody(request);
        const name = url.pathname.slice("/account/".length);
        const result = name === "send-code"
          ? await sendActivationCode(body)
          : name === "confirm"
            ? confirmEmail(body)
            : name === "register"
              ? registerAccount(body)
              : name === "login"
                ? loginAccount(body)
                : name === "reset-code"
                  ? await sendResetCode(body)
                  : name === "confirm-reset"
                    ? confirmReset(body)
                    : name === "reset-password"
                      ? resetPassword(body)
                      : null;
        if (!result) {
          response.writeHead(404, origin);
          response.end(JSON.stringify({ error: "Unknown account path" }));
          return;
        }
        response.writeHead(200, origin);
        response.end(JSON.stringify(result));
      } catch (error) {
        response.writeHead(400, origin);
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Account request failed" }));
      }
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const wss = new WebSocketServer({ server: lan, path: "/ras", maxPayload: 8192 });
  const sockets = { port: 0, wss };

  wss.on("connection", (ws, request) => {
    const address = String(request.socket.remoteAddress || "").replace(/^::ffff:/, "");
    if (!isPrivateAddress(address)) {
      ws.close(1008, "lan-only");
      return;
    }
    ws.on("message", (data) => {
      let message;
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }
      if (message.op === "pair") {
        if (message.nonce !== state.nonce) {
          send(ws, { op: "deny", detail: "口令与电脑屏幕上的配对票不一致" });
          return;
        }
        pending.set(ws, { address, at: new Date().toISOString() });
        send(ws, { op: "pending", detail: "请在电脑上确认这台手机" });
        return;
      }
      if (!sameToken(ws.grantToken, message.token)) {
        send(ws, { op: "reject", detail: "遥控令牌无效" });
        return;
      }
      if (message.op === "registerPush") {
        const token = String(message.expoPushToken || "");
        if (!token.startsWith("ExponentPushToken")) {
          send(ws, { op: "reject", detail: "推送令牌格式不对" });
          return;
        }
        state.expoPushToken = token;
        if (persist) writePushToken(token);
        send(ws, { op: "push-ok" });
        return;
      }
      if (message.op === "tighten" || message.type === "tighten_rule") {
        try {
          if (message.type === "tighten_rule") {
            if (!broadcast) throw new Error("本地金库没有打开");
            const rules = broadcast.tightenRule(String(message.key || ""), Number(message.max));
            send(ws, { op: "tightened", rules });
          } else {
            const next = persist ? tightenActiveRules(message) : applyMemoryTighten(state, message);
            for (const client of granted()) send(client, stateFrame());
            send(ws, { op: "tightened", rules: next });
          }
        } catch (error) {
          send(ws, { op: "reject", detail: error instanceof Error ? error.message : "不能放宽防线" });
          send(ws, stateFrame());
        }
        return;
      }
      if (message.op === "fuse") {
        state.fuseArmed = true;
        state.fuseNote = "手机请求了物理熔断。电路仍由这台电脑执行。";
        raise("power", "CRITICAL", "手机请求物理熔断", "请求已记下。手机不能直接切断电路。");
        for (const client of granted()) send(client, stateFrame());
      }
    });
    ws.on("close", () => pending.delete(ws));
  });

  const control = createServer(async (request, response) => {
    const origin = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" };
    if (request.method === "OPTIONS") {
      response.writeHead(204, origin);
      response.end();
      return;
    }
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const json = (status, body) => {
      response.writeHead(status, { ...origin, "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    try {
    if (request.method === "GET" && url.pathname === "/health") return json(200, { ok: true });
    if (request.method === "GET" && url.pathname === "/status") {
      return json(200, {
        ok: true,
        host: advertised,
        port: sockets.port,
        name: hostId,
        nonce: state.nonce,
        ticket: ticket(),
        qrDataUrl: state.qrDataUrl,
        pending: [...pending.values()],
        rules: rulesOf(),
        fuseArmed: state.fuseArmed,
        fuseNote: state.fuseNote,
        mdns: state.mdns,
        pushRegistered: Boolean(state.expoPushToken),
        lastPushError: state.lastPushError,
      });
    }
    const body = await readBody(request);
    if (request.method === "POST" && url.pathname === "/confirm") {
      const address = String(body.address || "");
      let grantedNow = false;
      for (const [ws, row] of pending) {
        if (row.address !== address) continue;
        const token = randomBytes(32).toString("base64url");
        ws.grantToken = token;
        send(ws, { op: "grant", token, scope: ["radar", "control"] });
        send(ws, stateFrame());
        send(ws, state.radar);
        pending.delete(ws);
        grantedNow = true;
      }
      if (grantedNow) {
        state.nonce = makeNonce();
        await refreshQr();
      }
      return json(200, { ok: grantedNow });
    }
    if (request.method === "POST" && url.pathname === "/rotate") {
      state.nonce = makeNonce();
      for (const ws of pending.keys()) send(ws, { op: "deny", detail: "电脑换了新的配对票" });
      pending.clear();
      await refreshQr();
      return json(200, { ok: true, nonce: state.nonce });
    }
    if (request.method === "POST" && url.pathname === "/radar") {
      publishRadar(acceptRadar(body));
      return json(200, { ok: true });
    }
    if (request.method === "POST" && url.pathname === "/fuse-clear") {
      state.fuseArmed = false;
      state.fuseNote = "";
      for (const ws of granted()) send(ws, stateFrame());
      return json(200, { ok: true });
    }
    return json(404, { ok: false });
    } catch (error) {
      json(400, { ok: false, error: error instanceof Error ? error.message : "请求没有完成" });
    }
  });

  let mdns;
  let bonjour = null;
  const announce = () => {
    if (!mdns) return;
    const instance = `RAS-${hostname().replace(/[^A-Za-z0-9-]/g, "").slice(0, 24) || "host"}`;
    const service = `${instance}._ras._tcp.local`;
    mdns.respond({
      answers: [
        { name: "_ras._tcp.local", type: "PTR", ttl: 120, data: service },
        { name: service, type: "SRV", ttl: 120, data: { port: sockets.port, priority: 0, weight: 0, target: `${instance}.local` } },
        { name: service, type: "TXT", ttl: 120, data: ["v=1", "path=/ras"] },
        { name: `${instance}.local`, type: "A", ttl: 120, data: advertised },
      ],
    });
  };

  try {
    sockets.port = await listen(lan, options.port ?? 8787, "0.0.0.0");
    const controlPort = await listen(control, options.controlPort ?? 8788, "127.0.0.1");
    await refreshQr();
    if (options.mdns !== false) {
      try {
        const createMdns = require("multicast-dns");
        mdns = createMdns({ reuseAddr: true });
        mdns.on("query", (packet) => {
          const names = (packet.questions || []).map((question) => question.name);
          if (names.some((name) => name === "_ras._tcp.local" || name === "_services._dns-sd._udp.local" || String(name).includes("._ras._tcp."))) announce();
        });
        mdns.on("error", () => {
          state.mdns = false;
        });
        state.mdns = true;
        announce();
      } catch {
        state.mdns = false;
      }
      bonjour = publishBonjour(sockets.port);
      if (bonjour) state.mdns = true;
    }
    const pulse = setInterval(() => {
      announce();
      for (const ws of granted()) send(ws, state.radar);
    }, 15000);
    const pidFile = path.join(homedir(), "RedAnchorVault", "link.pid");
    if (persist) {
      mkdirSync(path.dirname(pidFile), { recursive: true });
      writeFileSync(pidFile, String(process.pid), { mode: 0o600 });
    }
    return {
      port: sockets.port,
      controlPort,
      ticket,
      close: async () => {
        clearInterval(pulse);
        for (const ws of wss.clients) ws.close();
        wss.close();
        lan.close();
        control.close();
        if (mdns) mdns.destroy();
        if (bonjour) bonjour.kill();
        broadcast?.stop();
        vault?.close();
      },
    };
  } catch (error) {
    vault?.close();
    broadcast?.stop();
    lan.close();
    control.close();
    throw error;
  }
}

function applyMemoryTighten(state, patch) {
  const current = state.memoryRules;
  const sound = patch?.soundDb == null || patch.soundDb === "" ? current.soundDb : Number(patch.soundDb);
  const oxygen = patch?.o2Percent == null || patch.o2Percent === "" ? current.o2Percent : Number(patch.o2Percent);
  const heat = patch?.heatCelsius == null || patch.heatCelsius === "" ? current.heatCelsius : Number(patch.heatCelsius);
  if (sound != null && (!Number.isFinite(sound) || sound < 45 || sound > 80)) throw new Error("声音警告需在 45 到 80 分贝");
  if (oxygen != null && (!Number.isFinite(oxygen) || oxygen < 19.5 || oxygen > 22)) throw new Error("氧气警告不能低于 19.5%");
  if (heat != null && (!Number.isFinite(heat) || heat < 28 || heat > 40)) throw new Error("温度警告需在 28 到 40 度");
  if (sound != null && current.soundDb != null && sound > current.soundDb) throw new Error("声音线只能收紧，不能放宽");
  if (oxygen != null && current.o2Percent != null && oxygen < current.o2Percent) throw new Error("氧气线只能收紧，不能把缺氧标成安全");
  if (heat != null && current.heatCelsius != null && heat > current.heatCelsius) throw new Error("温度线只能收紧");
  state.memoryRules = { soundDb: sound, o2Percent: oxygen, heatCelsius: heat };
  return state.memoryRules;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 32_000) {
        reject(new Error("请求过大"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("请求不是 JSON"));
      }
    });
  });
}

async function healthy(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(400) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function ensureRunning() {
  const port = Number(process.env.RAS_LINK_CONTROL || 8788);
  if (await healthy(port)) return { ok: true, already: true };
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], { detached: true, stdio: "ignore" });
  child.unref();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (await healthy(port)) return { ok: true, started: true };
  }
  return { ok: false };
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  const controlPort = Number(process.env.RAS_LINK_CONTROL || 8788);
  if (await healthy(controlPort)) process.exit(0);
  startLink({
    port: Number(process.env.RAS_LINK_PORT || 8787),
    controlPort,
    host: lanAddress(),
  }).catch((error) => {
    if (error?.code === "EADDRINUSE") process.exit(0);
    process.stderr.write(error instanceof Error ? error.message : "link failed");
    process.exit(1);
  });
}
