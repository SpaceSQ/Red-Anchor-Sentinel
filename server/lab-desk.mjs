import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const dir = path.join(homedir(), "RedAnchorVault", "lab");
const profilesPath = path.join(dir, "lab_profiles.json");
const activePath = path.join(dir, "active_profile.json");
const BANNED = /忽略之前|ignore previous|jailbreak|越狱|关闭三定律|停用三定律|display\s*:\s*none|visibility\s*:\s*hidden|上传局域网|端口扫描/i;

function ensure() {
  mkdirSync(dir, { recursive: true });
}

function readProfiles() {
  try {
    const parsed = JSON.parse(readFileSync(profilesPath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeProfiles(profiles) {
  ensure();
  writeFileSync(profilesPath, `${JSON.stringify(profiles, null, 2)}\n`);
}

function cleanName(value) {
  const name = String(value || "").replace(/[<>]/g, "").trim().slice(0, 40);
  if (!name) throw new Error("请给探测体起一个名字");
  return name;
}

function cleanColor(value) {
  const color = String(value || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(color) ? color : "#ef4444";
}

function cleanLogo(value) {
  const logo = String(value || "");
  if (!logo) return "";
  if (logo.length > 120_000) throw new Error("标志图片请小于 80KB");
  if (!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(logo)) throw new Error("标志只接受 PNG、JPEG 或 WEBP");
  return logo;
}

function cleanRules(input) {
  const source = input || {};
  const sound = source.soundDb == null || source.soundDb === "" ? null : Number(source.soundDb);
  const oxygen = source.o2Percent == null || source.o2Percent === "" ? null : Number(source.o2Percent);
  const heat = source.heatCelsius == null || source.heatCelsius === "" ? null : Number(source.heatCelsius);
  if (sound != null && (!Number.isFinite(sound) || sound < 45 || sound > 80)) throw new Error("声音警告需在 45 到 80 分贝之间，不能放宽到 80 以上");
  if (oxygen != null && (!Number.isFinite(oxygen) || oxygen < 19.5 || oxygen > 22)) throw new Error("氧气警告不能低于 19.5%，以免把缺氧标成安全");
  if (heat != null && (!Number.isFinite(heat) || heat < 28 || heat > 40)) throw new Error("温度警告需在 28 到 40 度之间");
  const prompt = String(source.semanticPrompt || "").trim().slice(0, 500);
  if (BANNED.test(prompt)) throw new Error("补充提示不能关闭三定律、隐藏水印，或要求扫描局域网");
  return { soundDb: sound, o2Percent: oxygen, heatCelsius: heat, semanticPrompt: prompt };
}

function listProfiles() {
  let activeId = "";
  try {
    const parsed = JSON.parse(readFileSync(activePath, "utf8"));
    activeId = String(parsed.id || "");
  } catch {
    activeId = "";
  }
  return { profiles: readProfiles(), activeId };
}

function createProfile(customName) {
  const profile = {
    id: `lab-${randomBytes(4).toString("hex")}`,
    customName: cleanName(customName || "未命名探测体"),
    brandColor: "#ef4444",
    logoUrl: "",
    status: "draft",
    rulesConfig: { soundDb: null, o2Percent: null, heatCelsius: null, semanticPrompt: "" },
    updatedAt: new Date().toISOString(),
  };
  const profiles = readProfiles();
  profiles.unshift(profile);
  writeProfiles(profiles.slice(0, 24));
  return { profile };
}

function saveProfile(input) {
  const profiles = readProfiles();
  const index = profiles.findIndex((item) => item.id === input?.id);
  if (index < 0) throw new Error("找不到这个探测体");
  const next = {
    ...profiles[index],
    customName: cleanName(input.customName),
    brandColor: cleanColor(input.brandColor),
    logoUrl: cleanLogo(input.logoUrl || ""),
    status: profiles[index].status,
    rulesConfig: cleanRules(input.rulesConfig),
    updatedAt: new Date().toISOString(),
  };
  profiles[index] = next;
  writeProfiles(profiles);
  return { profile: next };
}

function publishProfile(id) {
  const profiles = readProfiles();
  const index = profiles.findIndex((item) => item.id === id);
  if (index < 0) throw new Error("找不到这个探测体");
  const profile = { ...profiles[index], status: "published", updatedAt: new Date().toISOString() };
  profile.rulesConfig = cleanRules(profile.rulesConfig);
  profiles[index] = profile;
  writeProfiles(profiles);
  ensure();
  writeFileSync(activePath, `${JSON.stringify({ id: profile.id }, null, 2)}\n`);
  const pack = {
    format: "red-anchor-profile",
    version: 1,
    note: "配置档案，由红锚哨兵主程序加载。不是独立可执行文件。三定律与水印不在档案内。",
    profile,
  };
  return { profile, pack: JSON.stringify(pack, null, 2) };
}

const sidecarPath = path.join(dir, "link-rules.json");

function emptyRules() {
  return { soundDb: null, o2Percent: null, heatCelsius: null, semanticPrompt: "" };
}

function readSidecar() {
  try {
    return cleanRules(JSON.parse(readFileSync(sidecarPath, "utf8")));
  } catch {
    return emptyRules();
  }
}

export function readActiveRules() {
  const { profiles, activeId } = listProfiles();
  const profile = profiles.find((item) => item.id === activeId);
  if (profile?.rulesConfig) return cleanRules(profile.rulesConfig);
  return readSidecar();
}

export function tightenActiveRules(patch) {
  const current = readActiveRules();
  const sound = patch?.soundDb == null || patch.soundDb === "" ? current.soundDb : Number(patch.soundDb);
  const oxygen = patch?.o2Percent == null || patch.o2Percent === "" ? current.o2Percent : Number(patch.o2Percent);
  const heat = patch?.heatCelsius == null || patch.heatCelsius === "" ? current.heatCelsius : Number(patch.heatCelsius);
  if (sound != null && current.soundDb != null && sound > current.soundDb) throw new Error("声音线只能收紧，不能放宽");
  if (oxygen != null && current.o2Percent != null && oxygen < current.o2Percent) throw new Error("氧气线只能收紧，不能把缺氧标成安全");
  if (heat != null && current.heatCelsius != null && heat > current.heatCelsius) throw new Error("温度线只能收紧");
  let prompt = String(current.semanticPrompt || "");
  if (patch?.semanticPrompt != null && String(patch.semanticPrompt).trim()) {
    const next = String(patch.semanticPrompt).trim();
    if (prompt && !next.includes(prompt)) throw new Error("SOUL 限制只能加严，不能删掉已有句子");
    prompt = next;
  }
  const rules = cleanRules({ soundDb: sound, o2Percent: oxygen, heatCelsius: heat, semanticPrompt: prompt });
  const { profiles, activeId } = listProfiles();
  const index = profiles.findIndex((item) => item.id === activeId);
  if (index >= 0) {
    profiles[index] = { ...profiles[index], rulesConfig: rules, updatedAt: new Date().toISOString() };
    writeProfiles(profiles);
  } else {
    ensure();
    writeFileSync(sidecarPath, `${JSON.stringify(rules)}\n`, { mode: 0o600 });
  }
  return { soundDb: rules.soundDb, o2Percent: rules.o2Percent, heatCelsius: rules.heatCelsius };
}

export function labOp(op, body) {
  if (op === "labList") return listProfiles();
  if (op === "labActive") {
    const { profiles, activeId } = listProfiles();
    return { profile: profiles.find((item) => item.id === activeId) || null };
  }
  if (op === "labCreate") return createProfile(body.customName);
  if (op === "labSave") return saveProfile(body.profile);
  if (op === "labPublish") return publishProfile(String(body.id || ""));
  if (op === "labClear") {
    ensure();
    writeFileSync(activePath, `${JSON.stringify({ id: "" }, null, 2)}\n`);
    return { ok: true };
  }
  throw new Error("未知实验室操作");
}
