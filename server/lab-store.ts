import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cleanColor, cleanLogo, cleanName, cleanRules, EMPTY_RULES, type LabProfile } from "@/lib/lab-rules";

const dir = path.join(process.cwd(), "data");
const profilesPath = path.join(dir, "lab_profiles.json");
const activePath = path.join(dir, "active_profile.json");

function ensure() {
  mkdirSync(dir, { recursive: true });
}

function readProfiles(): LabProfile[] {
  try {
    const parsed = JSON.parse(readFileSync(profilesPath, "utf8")) as LabProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeProfiles(profiles: LabProfile[]) {
  ensure();
  writeFileSync(profilesPath, `${JSON.stringify(profiles, null, 2)}\n`);
}

export function listProfiles(): { profiles: LabProfile[]; activeId: string } {
  let activeId = "";
  try {
    const parsed = JSON.parse(readFileSync(activePath, "utf8")) as { id?: string };
    activeId = String(parsed.id || "");
  } catch {
    activeId = "";
  }
  return { profiles: readProfiles(), activeId };
}

export function activeProfile(): LabProfile | null {
  const { profiles, activeId } = listProfiles();
  return profiles.find((item) => item.id === activeId) || null;
}

export function createProfile(customName: string): LabProfile {
  const profile: LabProfile = {
    id: `lab-${randomBytes(4).toString("hex")}`,
    customName: cleanName(customName || "未命名探测体"),
    brandColor: "#ef4444",
    logoUrl: "",
    status: "draft",
    rulesConfig: { ...EMPTY_RULES },
    updatedAt: new Date().toISOString(),
  };
  const profiles = readProfiles();
  profiles.unshift(profile);
  writeProfiles(profiles.slice(0, 24));
  return profile;
}

export function saveProfile(input: LabProfile): LabProfile {
  const profiles = readProfiles();
  const index = profiles.findIndex((item) => item.id === input.id);
  if (index < 0) throw new Error("找不到这个探测体");
  const next: LabProfile = {
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
  return next;
}

function slug(name: string): string {
  const safe = name.replace(/[^\w\u4e00-\u9fff-]+/g, "_").slice(0, 24);
  return safe || "Custom_Agent";
}

export function publishProfile(id: string): { profile: LabProfile; file: string; pack: string } {
  const profiles = readProfiles();
  const index = profiles.findIndex((item) => item.id === id);
  if (index < 0) throw new Error("找不到这个探测体");
  const profile = { ...profiles[index], status: "published" as const, updatedAt: new Date().toISOString() };
  cleanRules(profile.rulesConfig);
  profiles[index] = profile;
  writeProfiles(profiles);
  ensure();
  writeFileSync(activePath, `${JSON.stringify({ id: profile.id }, null, 2)}\n`);
  const file = path.join(dir, `${slug(profile.customName)}.rasprofile`);
  const pack = {
    format: "red-anchor-profile",
    version: 1,
    note: "配置档案，由红锚哨兵主程序加载。不是独立可执行文件。三定律与水印不在档案内。",
    profile,
  };
  writeFileSync(file, `${JSON.stringify(pack, null, 2)}\n`);
  return { profile, file, pack: JSON.stringify(pack, null, 2) };
}

export function clearActive() {
  ensure();
  writeFileSync(activePath, `${JSON.stringify({ id: "" }, null, 2)}\n`);
}

export function readAppendix(): string {
  const profile = activeProfile();
  if (!profile) return "";
  try {
    return cleanRules(profile.rulesConfig).semanticPrompt;
  } catch {
    return "";
  }
}
