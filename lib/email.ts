import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import nodemailer from "nodemailer";

const DIMS = ["light", "atmos", "sound", "wave", "power", "vision", "air", "pressure", "odor", "tactile", "magnetic", "gravity", "water", "food"] as const;
const DIM_NAME: Record<(typeof DIMS)[number], string> = {
  light: "光",
  atmos: "空气",
  sound: "声",
  wave: "电磁波",
  power: "电源",
  vision: "视觉",
  air: "基气",
  pressure: "气压",
  odor: "气味",
  tactile: "触觉",
  magnetic: "地磁",
  gravity: "重力",
  water: "供水",
  food: "营养",
};

export interface SmtpEnv {
  host: string;
  port: string;
  user: string;
  pass: string;
  secure: string;
}

function readEnvFile(file: string): Record<string, string> {
  try {
    const text = readFileSync(file, "utf8");
    const env: Record<string, string> = {};
    for (const line of text.split(/\n/)) {
      const raw = line.trim();
      if (!raw || raw.startsWith("#") || !raw.includes("=")) continue;
      const index = raw.indexOf("=");
      env[raw.slice(0, index)] = raw.slice(index + 1).trim();
    }
    return env;
  } catch {
    return {};
  }
}

export function readSmtpEnv(): SmtpEnv {
  const files = {
    ...readEnvFile(path.join(process.cwd(), ".env")),
    ...readEnvFile(path.join(homedir(), "RedAnchor", ".env")),
    ...readEnvFile(path.join(homedir(), "RedAnchorVault", ".env")),
  };
  const pick = (key: string) => (process.env[key] || files[key] || "").trim();
  return {
    host: pick("SMTP_HOST"),
    port: pick("SMTP_PORT"),
    user: pick("SMTP_USER"),
    pass: pick("SMTP_PASS"),
    secure: pick("SMTP_SECURE"),
  };
}

/** Aliyun DirectMail rejects a From address that is not the authenticated SMTP user. */
export function aliyunFrom(user: string): string {
  return `"Red Anchor Sentinel" <${user}>`;
}

export function createSmtpTransport(env: SmtpEnv = readSmtpEnv()) {
  if (!env.host || !env.user || !env.pass) throw new Error("发信账号未配置完整");
  const port = Number(env.port || 465);
  const secure = port === 465 || env.secure === "1";
  return {
    from: aliyunFrom(env.user),
    transport: nodemailer.createTransport({
      host: env.host,
      port,
      secure,
      auth: { user: env.user, pass: env.pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    }),
  };
}

function emailOk(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) throw new Error("邮箱格式不正确");
  return email;
}

function langOf(locale?: unknown): "zh" | "en" {
  return locale === "en" ? "en" : "zh";
}

export function activationMessage(code: string, locale?: unknown): { subject: string; text: string } {
  if (!/^\d{6}$/.test(code)) throw new Error("核验码应为 6 位");
  if (langOf(locale) === "en") {
    return {
      subject: "[Red Anchor Sentinel] Your S2-DID Activation Code",
      text: `Welcome to Red Anchor Sentinel. Your physical failsafe activation code is: ${code}.\nThis code will expire in 10 minutes. If you did not request this, please ignore.`,
    };
  }
  return {
    subject: "[红锚哨兵] 你的 S2-DID 核验码",
    text: `欢迎来到红锚哨兵。你的物理熔断核验码是：${code}。\n此码 10 分钟内有效。如果这不是你本人申请的，请忽略本信。`,
  };
}

export function threatMessage(dimension: string, severity: string, locale?: unknown): { subject: string; text: string } {
  if (!DIMS.includes(dimension as (typeof DIMS)[number])) throw new Error("未知维度");
  if (severity !== "warning" && severity !== "critical") throw new Error("未知告警等级");
  const name = DIM_NAME[dimension as (typeof DIMS)[number]];
  if (langOf(locale) === "en") {
    return {
      subject: `[Red Anchor Sentinel] ${severity} failsafe: ${dimension}`,
      text: `A 14-dimension failsafe fired while the phone link was offline.\nDimension: ${dimension}\nSeverity: ${severity}\nThe reading stays on the host. Open Red Anchor Sentinel on that computer.`,
    };
  }
  return {
    subject: `[红锚哨兵] ${severity === "critical" ? "临界" : "警告"}熔断：${name}`,
    text: `手机链路不在线时，十四维防线触发了。\n维度：${name}\n等级：${severity}\n读数留在主机上。请在那台电脑打开红锚哨兵。`,
  };
}

export async function sendActivationCode(email: string, code: string, locale?: unknown): Promise<{ ok: true }> {
  const to = emailOk(email);
  const message = activationMessage(code, locale);
  const { from, transport } = createSmtpTransport();
  await transport.sendMail({ from, to, subject: message.subject, text: message.text });
  return { ok: true };
}

export async function sendThreatAlert(email: string, dimension: string, severity: string, locale?: unknown): Promise<{ ok: true }> {
  const to = emailOk(email);
  const message = threatMessage(dimension, severity, locale);
  const { from, transport } = createSmtpTransport();
  await transport.sendMail({ from, to, subject: message.subject, text: message.text });
  return { ok: true };
}
