import { execFile } from "node:child_process";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir, hostname, cpus, networkInterfaces } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { askAlign, checkClamp, readCard } from "./ask.mjs";
import { scanAnnouncements } from "./discover.mjs";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

const AI_PORTS = {
  11434: ["Ollama", "本地推理"],
  1234: ["LM Studio", "本地推理"],
  8188: ["ComfyUI", "图像生成"],
};

const WAN_HOSTS = [
  "api.openai.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
  "api.groq.com",
  "api.mistral.ai",
  "openrouter.ai",
];

function sha256(text) {
  return createHash("sha256").update(text).digest();
}

export function encryptVault(plaintext, entropy) {
  const key = sha256(String(entropy));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from("RAV1"), iv, tag, body]).toString("base64");
}

export function decryptVault(payload, entropy) {
  const raw = Buffer.from(payload, "base64");
  if (raw.subarray(0, 4).toString() !== "RAV1") throw new Error("金库格式无法识别");
  const iv = raw.subarray(4, 16);
  const tag = raw.subarray(16, 32);
  const body = raw.subarray(32);
  const decipher = createDecipheriv("aes-256-gcm", sha256(String(entropy)), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

async function run(command, args, timeout = 4000) {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout, maxBuffer: 2_000_000 });
    return stdout;
  } catch {
    return "";
  }
}

export async function hardwareProfile() {
  const ioreg = await run("ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"]);
  const uuid = (ioreg.match(/"IOPlatformUUID" = "([^"]+)"/) || [])[1] || "";
  const serial = (ioreg.match(/"IOPlatformSerialNumber" = "([^"]+)"/) || [])[1] || "";
  let mac = "";
  try {
    for (const entries of Object.values(networkInterfaces())) {
      for (const entry of entries || []) {
        if (!entry.internal && entry.mac && entry.mac !== "00:00:00:00:00:00") {
          mac = entry.mac;
          break;
        }
      }
      if (mac) break;
    }
  } catch {
    mac = "";
  }
  const docker = await fileExists("/.dockerenv");
  const cpu = cpus()[0]?.model || "";
  let hostClass = "physical";
  if (docker) hostClass = "container";
  else if (!uuid && !serial) hostClass = "virtual";
  const entropy = createHash("sha256").update([uuid, serial, mac, cpu, hostname()].join("|")).digest("hex");
  return {
    hostClass,
    hostname: hostname(),
    entropy,
  };
}

async function fileExists(file) {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
}

function resolveVaultDir(input) {
  const home = homedir();
  const raw = String(input || "").trim();
  if (!raw) throw new Error("需要选择金库目录");
  const expanded = raw.startsWith("~/") ? path.join(home, raw.slice(2)) : raw;
  const dir = path.resolve(expanded);
  const homeResolved = path.resolve(home);
  if (dir !== homeResolved && !dir.startsWith(homeResolved + path.sep)) {
    throw new Error("金库目录必须位于当前用户主目录内");
  }
  return dir;
}

export async function saveActivation(body) {
  const dir = resolveVaultDir(body.dir || "~/RedAnchorVault");
  const entropy = String(body.entropy || "");
  if (entropy.length < 32) throw new Error("缺少硬件熵");
  const record = {
    activated: true,
    email: String(body.email || "").slice(0, 120),
    username: String(body.username || "").slice(0, 40),
    at: String(body.at || new Date().toISOString()),
  };
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "activation.vault"), encryptVault(JSON.stringify(record), entropy), { mode: 0o600 });
  return { ok: true, dir };
}

export async function saveVault(body) {
  const dir = resolveVaultDir(body.dir);
  const entropy = String(body.entropy || "");
  if (entropy.length < 32) throw new Error("缺少硬件熵");
  const secret = {
    profile: body.profile,
    apiKey: String(body.apiKey || ""),
  };
  const encoded = JSON.stringify(secret);
  if (encoded.length > 200_000) throw new Error("金库内容过大");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "sentinel.vault"), encryptVault(encoded, entropy), { mode: 0o600 });
  return { ok: true, dir };
}

export async function loadVault(body) {
  const dir = resolveVaultDir(body.dir);
  const entropy = String(body.entropy || "");
  const raw = await readFile(path.join(dir, "sentinel.vault"), "utf8");
  const decoded = JSON.parse(decryptVault(raw.trim(), entropy));
  return {
    profile: decoded.profile,
    hasKey: Boolean(decoded.apiKey),
  };
}

export async function writeOutbox(body) {
  const dir = resolveVaultDir(body.dir);
  const name = String(body.name || "agent").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 40) || "agent";
  const text = String(body.text || "").slice(0, 20_000);
  const folder = path.join(dir, "outbox");
  await mkdir(folder, { recursive: true });
  const file = path.join(folder, `SOUL-${name}.md`);
  await writeFile(file, text, { mode: 0o600 });
  return { ok: true, file };
}

function allowedProbe(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "169.254.169.254" || host === "metadata.google.internal") return false;
  return true;
}

export async function probeLlm(body) {
  const base = String(body.baseUrl || "").replace(/\/$/, "");
  if (!allowedProbe(base)) throw new Error("端点协议不被接受");
  const mode = body.mode === "openai" ? "openai" : "ollama";
  const target = mode === "ollama" ? `${base}/api/tags` : `${base}/v1/models`;
  const headers = {};
  if (mode === "openai" && body.apiKey) headers.authorization = `Bearer ${body.apiKey}`;
  const response = await fetch(target, { headers, signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`端点返回 ${response.status}`);
  const data = await response.json();
  const count = Array.isArray(data.models) ? data.models.length : Array.isArray(data.data) ? data.data.length : 0;
  return { ok: true, count };
}

function pushHit(hits, hit) {
  if (hits.length >= 40) return;
  if (hits.some((item) => item.id === hit.id)) return;
  hits.push(hit);
}

async function scanLocal(hits) {
  const listeners = await run("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN"]);
  for (const line of listeners.split("\n")) {
    const match = line.match(/^(\S+)\s+(\d+)\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+:(\d+)\s/);
    if (!match) continue;
    const port = Number(match[3]);
    const known = AI_PORTS[port];
    if (!known) continue;
    pushHit(hits, {
      id: `local-${match[2]}-${port}`,
      tier: 1,
      name: known[0],
      vendor: known[0],
      purpose: known[1],
      uptimeSec: 0,
      address: `127.0.0.1:${port}`,
      manifest: [`tcp:${port}`, `process:${match[1]}`],
      note: "本机监听端口。只记录进程名与端口，不读取内存。",
      patchAuthority: "full",
    });
  }
}

function browseMdns() {
  return new Promise((resolve) => {
    let create;
    try {
      create = require("multicast-dns");
    } catch {
      resolve([]);
      return;
    }
    const mdns = create({ reuseAddr: true });
    const names = new Map();
    const timer = setTimeout(() => {
      mdns.removeAllListeners();
      mdns.destroy();
      resolve([...names.entries()].map(([name, type]) => ({ name, type })));
    }, 1800);
    mdns.on("response", (packet) => {
      for (const answer of packet.answers || []) {
        if (answer.type === "PTR" && typeof answer.data === "string" && answer.data.includes("._")) {
          names.set(answer.data, answer.name);
        }
      }
      if (names.size > 30) {
        clearTimeout(timer);
        mdns.destroy();
        resolve([...names.entries()].map(([name, type]) => ({ name, type })));
      }
    });
    mdns.on("error", () => {
      clearTimeout(timer);
      resolve([]);
    });
    for (const service of ["_http._tcp.local", "_hap._tcp.local", "_googlecast._tcp.local", "_smb._tcp.local", "_mqtt._tcp.local", "_matter._tcp.local"]) {
      mdns.query({ questions: [{ name: service, type: "PTR" }] });
    }
  });
}

async function scanLan(hits) {
  const services = await browseMdns();
  for (const service of services.slice(0, 16)) {
    const label = service.name.replace(/\..*$/, "").slice(0, 40);
    pushHit(hits, {
      id: `mdns-${createHash("sha256").update(service.name).digest("hex").slice(0, 10)}`,
      tier: 2,
      name: label || "局域网服务",
      vendor: service.type.replace(".local", ""),
      purpose: "mDNS 公布的服务",
      uptimeSec: 0,
      address: service.name,
      manifest: ["mdns.ptr"],
      note: "局域网多播发现。未向该服务发送管理口令。",
      patchAuthority: "confirm",
    });
  }
  const arp = await run("arp", ["-a"]);
  for (const line of arp.split("\n")) {
    if (!line || line.includes("incomplete")) continue;
    const match = line.match(/^(.*?) \(([0-9.]+)\) at ([0-9a-f:]+)/i);
    if (!match) continue;
    const ip = match[2];
    const first = Number(ip.split(".")[0]);
    if (first >= 224 || ip.endsWith(".255")) continue;
    pushHit(hits, {
      id: `arp-${ip}`,
      tier: 2,
      name: match[1].trim() === "?" ? `邻居 ${ip}` : match[1].trim(),
      vendor: "局域网邻居",
      purpose: "本机 ARP 缓存中的邻居，未做端口扫描",
      uptimeSec: 0,
      address: ip,
      manifest: [`mac:${match[3]}`],
      note: "只读取本机已经拥有的邻居缓存。",
      patchAuthority: "confirm",
    });
  }
  try {
    const announced = await scanAnnouncements();
    for (const hit of announced) pushHit(hits, hit);
  } catch {
    /* multicast may be unavailable */
  }
}

async function scanWan(hits) {
  const established = await run("lsof", ["-nP", "-iTCP", "-sTCP:ESTABLISHED"]);
  for (const line of established.split("\n")) {
    const host = WAN_HOSTS.find((item) => line.includes(item));
    if (!host) continue;
    const name = line.split(/\s+/)[0] || "process";
    pushHit(hits, {
      id: `wan-${host}-${name}`,
      tier: 3,
      name: host,
      vendor: host.split(".").slice(-2).join("."),
      purpose: `${name} 正在连接该公网推理端点`,
      uptimeSec: 0,
      address: host,
      manifest: ["tcp.established", "header-only"],
      note: "远场探针只看到本机已建立的连接和对方主机名。不能下发补丁。",
      patchAuthority: "mark-only",
    });
  }
}

export async function scanTiers() {
  const hits = [];
  await scanLocal(hits);
  await scanLan(hits);
  await scanWan(hits);
  return { hits, scannedAt: new Date().toISOString() };
}

export async function dispatch(op, body) {
  if (op === "hardware") return hardwareProfile();
  if (op === "scan") return scanTiers();
  if (op === "saveActivation") return saveActivation(body);
  if (op === "saveVault") return saveVault(body);
  if (op === "loadVault") return loadVault(body);
  if (op === "writeOutbox") return writeOutbox(body);
  if (op === "probeLlm") return probeLlm(body);
  if (op === "askAlign") return askAlign(body);
  if (op === "readCard") return readCard(body);
  if (op === "checkClamp") return checkClamp(body);
  throw new Error("未知操作");
}
