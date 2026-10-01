import type { DimScores, Tensor14 } from "@/lib/tensor";

export interface LabRules {
  soundDb: number | null;
  o2Percent: number | null;
  heatCelsius: number | null;
  semanticPrompt: string;
}

export interface LabProfile {
  id: string;
  customName: string;
  brandColor: string;
  logoUrl: string;
  status: "draft" | "published";
  rulesConfig: LabRules;
  updatedAt: string;
}

export const EMPTY_RULES: LabRules = {
  soundDb: null,
  o2Percent: null,
  heatCelsius: null,
  semanticPrompt: "",
};

const BANNED = /忽略之前|ignore previous|jailbreak|越狱|关闭三定律|停用三定律|display\s*:\s*none|visibility\s*:\s*hidden|上传局域网|端口扫描/i;

export function strengthOf(rules: LabRules): number {
  const used = [rules.soundDb != null, rules.o2Percent != null, rules.heatCelsius != null, rules.semanticPrompt.trim().length > 0].filter(Boolean).length;
  return used * 25;
}

export function cleanName(value: string): string {
  const name = value.replace(/[<>]/g, "").trim().slice(0, 40);
  if (!name) throw new Error("请给探测体起一个名字");
  return name;
}

export function cleanColor(value: string): string {
  const color = value.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(color)) return "#ef4444";
  return color;
}

export function cleanLogo(value: string): string {
  if (!value) return "";
  if (value.length > 120_000) throw new Error("标志图片请小于 80KB");
  if (!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) throw new Error("标志只接受 PNG、JPEG 或 WEBP");
  return value;
}

export function cleanRules(input: Partial<LabRules> | undefined): LabRules {
  const sound = input?.soundDb == null || input.soundDb === ("" as unknown) ? null : Number(input.soundDb);
  const oxygen = input?.o2Percent == null || input.o2Percent === ("" as unknown) ? null : Number(input.o2Percent);
  const heat = input?.heatCelsius == null || input.heatCelsius === ("" as unknown) ? null : Number(input.heatCelsius);
  if (sound != null && (!Number.isFinite(sound) || sound < 45 || sound > 80)) throw new Error("声音警告需在 45 到 80 分贝之间，不能放宽到 80 以上");
  if (oxygen != null && (!Number.isFinite(oxygen) || oxygen < 19.5 || oxygen > 22)) throw new Error("氧气警告不能低于 19.5%，以免把缺氧标成安全");
  if (heat != null && (!Number.isFinite(heat) || heat < 28 || heat > 40)) throw new Error("温度警告需在 28 到 40 度之间");
  const prompt = String(input?.semanticPrompt || "").trim().slice(0, 500);
  if (BANNED.test(prompt)) throw new Error("补充提示不能关闭三定律、隐藏水印，或要求扫描局域网");
  return {
    soundDb: sound,
    o2Percent: oxygen,
    heatCelsius: heat,
    semanticPrompt: prompt,
  };
}

export function tightenScores(scores: DimScores, tensor: Tensor14, rules?: LabRules | null): DimScores {
  if (!rules) return scores;
  const next = { ...scores };
  if (rules.soundDb != null && tensor.sound.db >= rules.soundDb) next.sound = Math.max(next.sound, 34);
  if (rules.o2Percent != null && tensor.air.o2 < rules.o2Percent) next.air = Math.max(next.air, 34);
  if (rules.heatCelsius != null && tensor.atmos.celsius >= rules.heatCelsius) next.atmos = Math.max(next.atmos, 34);
  return next;
}
