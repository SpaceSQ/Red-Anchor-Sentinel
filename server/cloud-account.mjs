import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnvFile(file) {
  const env = {};
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return env;
  }
  for (const line of text.split(/\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#") || !raw.includes("=")) continue;
    const index = raw.indexOf("=");
    env[raw.slice(0, index)] = raw.slice(index + 1).trim();
  }
  return env;
}

export function loadCloudEnv() {
  const env = {
    ...readEnvFile(path.join(root, ".env")),
    ...readEnvFile(path.join(homedir(), "RedAnchorVault", ".env")),
  };
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
    if (process.env[key]) env[key] = process.env[key].trim();
  }
  return {
    url: String(env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, ""),
    key: String(env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""),
  };
}

export function cloudConfigured(env = loadCloudEnv()) {
  return Boolean(env.url && env.key);
}

function say(locale, en, zh) {
  throw new Error(locale === "zh" ? zh : en);
}

function localeOf(body) {
  return body?.locale === "zh" ? "zh" : "en";
}

function emailOk(value, locale) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    say(locale, "That email address is not valid.", "邮箱格式不正确");
  }
  return email;
}

function passwordOk(email, password, confirm, locale) {
  if (password.length < 8 || password.length > 72) say(locale, "Use a password of 8 to 72 characters.", "密码需要 8 到 72 个字符。");
  if (password !== confirm) say(locale, "The two passwords do not match.", "两次输入的密码不一致。");
  if (password.toLowerCase() === email) say(locale, "Do not use the email address as the password.", "不要把邮箱本身当作密码。");
}

function authMessage(data, locale) {
  const raw = String(data.error_description || data.msg || data.message || data.error_code || data.error || "").trim();
  if (!raw || raw === "invalid_grant") {
    return locale === "zh" ? "邮箱或核验码不正确，或核验码已过期。" : "The email or code is wrong, or the code has expired.";
  }
  return raw.slice(0, 240);
}

async function callAuth(env, pathAndQuery, { method = "POST", body, access, fetchImpl = fetch } = {}, locale) {
  if (!cloudConfigured(env)) say(locale, "The account service is not configured.", "账户服务还没有配置。");
  let response;
  try {
    response = await fetchImpl(`${env.url}${pathAndQuery}`, {
      method,
      headers: {
        apikey: env.key,
        authorization: `Bearer ${access || env.key}`,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    say(locale, "The account service did not accept the connection. The message was not sent.", "账户服务没有接通。邮件没有发出。");
  }
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 180) };
    }
  }
  if (!response.ok) say(locale, authMessage(data, "en"), authMessage(data, "zh"));
  return data;
}

export async function sendSignupCode(body, deps = {}) {
  const locale = localeOf(body);
  if (body.privacy !== true) say(locale, "Accept the privacy note before continuing.", "请先勾选隐私与遥测协议");
  const email = emailOk(body.email, locale);
  const env = deps.env || loadCloudEnv();
  await callAuth(env, "/auth/v1/otp", { body: { email, create_user: true }, fetchImpl: deps.fetch }, locale);
  return { ok: true, delivery: "cloud" };
}

export async function confirmSignup(body, deps = {}) {
  const locale = localeOf(body);
  if (body.privacy !== true) say(locale, "Accept the privacy note before continuing.", "请先勾选隐私与遥测协议");
  const email = emailOk(body.email, locale);
  const code = String(body.code || "").replace(/\D/g, "");
  if (code.length !== 6) say(locale, "The code must be 6 digits.", "核验码应为 6 位");
  const env = deps.env || loadCloudEnv();
  const data = await callAuth(env, "/auth/v1/verify", {
    body: { type: "email", email, token: code },
    fetchImpl: deps.fetch,
  }, locale);
  const proof = String(data.access_token || "");
  if (!proof) say(locale, "The email was not confirmed.", "邮箱没有确认成功。");
  return { ok: true, email: String(data.user?.email || email), proof };
}

export async function registerCloud(body, deps = {}) {
  const locale = localeOf(body);
  if (body.privacy !== true) say(locale, "Accept the privacy note before continuing.", "请先勾选隐私与遥测协议");
  const email = emailOk(body.email, locale);
  const proof = String(body.proof || "");
  if (!proof) say(locale, "Confirm the email again. The verification step expired.", "请重新确认邮箱。核验已过期。");
  passwordOk(email, String(body.password || ""), String(body.confirm || ""), locale);
  const env = deps.env || loadCloudEnv();
  await callAuth(env, "/auth/v1/user", {
    method: "PUT",
    body: { password: String(body.password || "") },
    access: proof,
    fetchImpl: deps.fetch,
  }, locale);
  return { ok: true, email, token: proof };
}

export async function loginCloud(body, deps = {}) {
  const locale = localeOf(body);
  const email = emailOk(body.email, locale);
  const password = String(body.password || "");
  if (password.length < 8) say(locale, "Email or password is incorrect.", "邮箱或密码不正确。");
  const env = deps.env || loadCloudEnv();
  const data = await callAuth(env, "/auth/v1/token?grant_type=password", {
    body: { email, password },
    fetchImpl: deps.fetch,
  }, locale);
  const token = String(data.access_token || "");
  if (!token) say(locale, "Email or password is incorrect.", "邮箱或密码不正确。");
  return { ok: true, email: String(data.user?.email || email), token };
}
