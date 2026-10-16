import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import path from "node:path";

let db;

function database() {
  if (db) return db;
  const file = process.env.RAS_ACCOUNTS_DB || path.join(homedir(), "RedAnchorVault", "accounts.db");
  mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file, { timeout: 5000 });
  db.exec(`
    CREATE TABLE IF NOT EXISTS signup_codes (
      email TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS proofs (
      email TEXT PRIMARY KEY,
      proof_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS accounts (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reset_codes (
      email TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reset_proofs (
      email TEXT PRIMARY KEY,
      proof_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
  return db;
}

function say(locale, en, zh) {
  const error = new Error(locale === "zh" ? zh : en);
  throw error;
}

function emailOk(value, locale) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) say(locale, "That email address is not valid.", "邮箱格式不正确");
  return email;
}

function hashCode(email, code) {
  return createHash("sha256").update(`${email}:${code}`).digest("hex");
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function passwordOk(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const have = Buffer.from(hash, "hex");
  if (have.length !== next.length) return false;
  return timingSafeEqual(have, next);
}

export function storeSignupCode(emailRaw, code) {
  const email = emailOk(emailRaw, "en");
  database().prepare("INSERT INTO signup_codes (email, code_hash, expires_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at").run(
    email,
    hashCode(email, String(code)),
    Date.now() + 10 * 60 * 1000,
  );
}

export function confirmEmail(body) {
  const locale = body.locale === "zh" ? "zh" : "en";
  if (body.privacy !== true) say(locale, "Accept the privacy note before continuing.", "请先勾选隐私与遥测协议");
  const email = emailOk(body.email, locale);
  const code = String(body.code || "").replace(/\D/g, "");
  if (code.length !== 6) say(locale, "The code must be 6 digits.", "核验码应为 6 位");
  const row = database().prepare("SELECT code_hash, expires_at FROM signup_codes WHERE email = ?").get(email);
  if (!row || row.expires_at < Date.now() || row.code_hash !== hashCode(email, code)) {
    say(locale, "That code is wrong or expired.", "核验码不正确或已过期");
  }
  database().prepare("DELETE FROM signup_codes WHERE email = ?").run(email);
  const proof = randomBytes(32).toString("base64url");
  database().prepare("INSERT INTO proofs (email, proof_hash, expires_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET proof_hash = excluded.proof_hash, expires_at = excluded.expires_at").run(
    email,
    hashToken(proof),
    Date.now() + 15 * 60 * 1000,
  );
  return { ok: true, email, proof };
}

export function registerAccount(body) {
  const locale = body.locale === "zh" ? "zh" : "en";
  if (body.privacy !== true) say(locale, "Accept the privacy note before continuing.", "请先勾选隐私与遥测协议");
  const email = emailOk(body.email, locale);
  const proof = String(body.proof || "");
  const password = String(body.password || "");
  const confirm = String(body.confirm || "");
  const row = database().prepare("SELECT proof_hash, expires_at FROM proofs WHERE email = ?").get(email);
  if (!proof || !row || row.expires_at < Date.now() || row.proof_hash !== hashToken(proof)) {
    say(locale, "Confirm the email again. The verification step expired.", "请重新确认邮箱。核验已过期。");
  }
  if (password.length < 8 || password.length > 72) say(locale, "Use a password of 8 to 72 characters.", "密码需要 8 到 72 个字符。");
  if (password !== confirm) say(locale, "The two passwords do not match.", "两次输入的密码不一致。");
  if (password.toLowerCase() === email) say(locale, "Do not use the email address as the password.", "不要把邮箱本身当作密码。");
  const existing = database().prepare("SELECT email FROM accounts WHERE email = ?").get(email);
  if (existing) say(locale, "This email is already registered. Log in.", "这个邮箱已经注册。请登录。");
  database().prepare("INSERT INTO accounts (email, password_hash, created_at) VALUES (?, ?, ?)").run(email, passwordHash(password), new Date().toISOString());
  database().prepare("DELETE FROM proofs WHERE email = ?").run(email);
  return { ok: true, ...openSession(email) };
}

export function loginAccount(body) {
  const locale = body.locale === "zh" ? "zh" : "en";
  const email = emailOk(body.email, locale);
  const password = String(body.password || "");
  const row = database().prepare("SELECT password_hash FROM accounts WHERE email = ?").get(email);
  if (!row || !passwordOk(password, row.password_hash)) say(locale, "Email or password is incorrect.", "邮箱或密码不正确。");
  return { ok: true, ...openSession(email) };
}

export function accountExists(emailRaw) {
  const email = emailOk(emailRaw, "en");
  return Boolean(database().prepare("SELECT email FROM accounts WHERE email = ?").get(email));
}

export function storeResetCode(emailRaw, code) {
  const email = emailOk(emailRaw, "en");
  database().prepare("INSERT INTO reset_codes (email, code_hash, expires_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at").run(
    email,
    hashCode(email, String(code)),
    Date.now() + 10 * 60 * 1000,
  );
}

export function confirmReset(body) {
  const locale = body.locale === "zh" ? "zh" : "en";
  if (body.privacy !== true) say(locale, "Accept the privacy note before continuing.", "请先勾选隐私与遥测协议");
  const email = emailOk(body.email, locale);
  if (!accountExists(email)) say(locale, "This email is not registered. Create an account.", "这个邮箱还没有注册。请先注册。");
  const code = String(body.code || "").replace(/\D/g, "");
  if (code.length !== 6) say(locale, "The code must be 6 digits.", "核验码应为 6 位");
  const row = database().prepare("SELECT code_hash, expires_at FROM reset_codes WHERE email = ?").get(email);
  if (!row || row.expires_at < Date.now() || row.code_hash !== hashCode(email, code)) {
    say(locale, "That code is wrong or expired.", "核验码不正确或已过期");
  }
  database().prepare("DELETE FROM reset_codes WHERE email = ?").run(email);
  const proof = randomBytes(32).toString("base64url");
  database().prepare("INSERT INTO reset_proofs (email, proof_hash, expires_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET proof_hash = excluded.proof_hash, expires_at = excluded.expires_at").run(
    email,
    hashToken(proof),
    Date.now() + 15 * 60 * 1000,
  );
  return { ok: true, email, proof };
}

export function resetPassword(body) {
  const locale = body.locale === "zh" ? "zh" : "en";
  if (body.privacy !== true) say(locale, "Accept the privacy note before continuing.", "请先勾选隐私与遥测协议");
  const email = emailOk(body.email, locale);
  const proof = String(body.proof || "");
  const password = String(body.password || "");
  const confirm = String(body.confirm || "");
  const row = database().prepare("SELECT proof_hash, expires_at FROM reset_proofs WHERE email = ?").get(email);
  if (!proof || !row || row.expires_at < Date.now() || row.proof_hash !== hashToken(proof)) {
    say(locale, "Confirm the email again. The verification step expired.", "请重新确认邮箱。核验已过期。");
  }
  if (!accountExists(email)) say(locale, "This email is not registered. Create an account.", "这个邮箱还没有注册。请先注册。");
  if (password.length < 8 || password.length > 72) say(locale, "Use a password of 8 to 72 characters.", "密码需要 8 到 72 个字符。");
  if (password !== confirm) say(locale, "The two passwords do not match.", "两次输入的密码不一致。");
  if (password.toLowerCase() === email) say(locale, "Do not use the email address as the password.", "不要把邮箱本身当作密码。");
  database().prepare("UPDATE accounts SET password_hash = ? WHERE email = ?").run(passwordHash(password), email);
  database().prepare("DELETE FROM reset_proofs WHERE email = ?").run(email);
  database().prepare("DELETE FROM sessions WHERE email = ?").run(email);
  return { ok: true, ...openSession(email) };
}

function openSession(email) {
  const token = randomBytes(32).toString("base64url");
  database().prepare("INSERT INTO sessions (token_hash, email, expires_at) VALUES (?, ?, ?)").run(
    hashToken(token),
    email,
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  );
  return { email, token };
}
