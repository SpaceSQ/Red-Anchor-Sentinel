import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import nodemailer from "nodemailer";
import { isValidDid } from "@/lib/did";

const ADMIN_PASSWORD = process.env.REDANCHOR_ADMIN_PASSWORD || "anchor-fleet";
const DB_PATH = path.join(process.cwd(), "cloud_backend.db");

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    s2_did TEXT NOT NULL DEFAULT '',
    privacy_accepted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS codes (
    email TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS heartbeats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    s2_did TEXT NOT NULL,
    version TEXT NOT NULL,
    uptime_sec INTEGER NOT NULL,
    fault_codes TEXT NOT NULL,
    seen_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    s2_did TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ticket_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL,
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS feedbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS releases (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    latest_version TEXT NOT NULL,
    download_url TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS broadcasts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);
db.prepare("INSERT OR IGNORE INTO releases (id, latest_version, download_url) VALUES (1, '6.0.0', '')").run();

export function versionNewer(latest: string, current: string): boolean {
  const parse = (value: string) =>
    value
      .replace(/^v/i, "")
      .split(".")
      .slice(0, 3)
      .map((part) => Number(part) || 0);
  const left = parse(latest);
  const right = parse(current);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return true;
    if (left[index] < right[index]) return false;
  }
  return false;
}

export function adminToken(): string {
  return createHmac("sha256", ADMIN_PASSWORD).update("red-anchor-fleet-admin").digest("hex");
}

export function adminOk(cookieHeader: string | null): boolean {
  const token = adminToken();
  const match = String(cookieHeader || "").match(/(?:^|;\s*)ra_fleet=([a-f0-9]+)/);
  const given = match?.[1] || "";
  if (given.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(token));
}

export function checkAdminPassword(password: string): boolean {
  const left = Buffer.from(password);
  const right = Buffer.from(ADMIN_PASSWORD);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function emailOk(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) throw new Error("邮箱格式不正确");
  return email;
}

function clip(value: unknown, max: number): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function hashCode(email: string, code: string): string {
  return createHash("sha256").update(`${email}:${code}`).digest("hex");
}

function releaseRow(): { latest_version: string; download_url: string } {
  return db.prepare("SELECT latest_version, download_url FROM releases WHERE id = 1").get() as {
    latest_version: string;
    download_url: string;
  };
}

function smtpEnv(name: string): string {
  return (process.env[name] || "").trim();
}

function activationLetter(code: string): { subject: string; text: string; html: string } {
  const subject = "[Red Anchor Sentinel] Your S2-DID Activation Code / 您的创世核验码";
  const text = [
    "Welcome to Red Anchor Sentinel. Your physical failsafe activation code is: " + code + ".",
    "This code will expire in 10 minutes. If you did not request this, please ignore.",
    "",
    "欢迎来到红锚哨兵。你的物理熔断核验码是：" + code + "。",
    "此码 10 分钟内有效。如果这不是你本人申请的，请忽略本信。",
  ].join("\n");
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<body style="margin:0;background:#020617;color:#e2e8f0;font-family:Segoe UI,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#020617;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#070b14;border:1px solid #7f1d1d;">
        <tr><td style="padding:22px 28px;border-bottom:1px solid #7f1d1d;">
          <div style="color:#ef4444;font-size:12px;letter-spacing:0.22em;">RED ANCHOR SENTINEL</div>
          <div style="margin-top:8px;color:#fecaca;font-size:22px;letter-spacing:0.04em;">S2-DID 创世核验</div>
        </td></tr>
        <tr><td style="padding:28px;line-height:1.65;font-size:15px;color:#e2e8f0;">
          <p style="margin:0 0 16px;">Welcome to Red Anchor Sentinel. Your physical failsafe activation code is:</p>
          <p style="margin:0 0 16px;text-align:center;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:34px;letter-spacing:0.38em;color:#fecaca;">${code}</p>
          <p style="margin:0 0 18px;">This code will expire in 10 minutes. If you did not request this, please ignore.</p>
          <p style="margin:0;color:#94a3b8;font-size:13px;">欢迎来到红锚哨兵。你的物理熔断核验码见上方，10 分钟内有效。如果这不是你本人申请的，请忽略本信。</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject, text, html };
}

export async function sendCode(emailRaw: string, privacy: boolean): Promise<"smtp" | "ethereal" | "terminal"> {
  if (!privacy) throw new Error("请先勾选隐私与遥测协议");
  const email = emailOk(emailRaw);
  const code = String(randomInt(100000, 1000000));
  db.prepare("INSERT INTO codes (email, code_hash, expires_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at").run(
    email,
    hashCode(email, code),
    Date.now() + 10 * 60 * 1000,
  );
  const letter = activationLetter(code);
  const host = smtpEnv("SMTP_HOST");
  if (host) {
    const user = smtpEnv("SMTP_USER");
    const pass = smtpEnv("SMTP_PASS");
    if (!user || !pass) throw new Error("发信账号未配置完整");
    const port = Number(smtpEnv("SMTP_PORT") || 465);
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465 || smtpEnv("SMTP_SECURE") === "1",
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
    await transport.sendMail({
      from: `"Red Anchor Sentinel" <${user}>`,
      to: email,
      subject: letter.subject,
      text: letter.text,
      html: letter.html,
    });
    return "smtp";
  }
  try {
    const account = await Promise.race([
      nodemailer.createTestAccount(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("ethereal timeout")), 4000)),
    ]);
    const transport = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass },
    });
    const info = await transport.sendMail({
      from: "Red Anchor Sentinel <sentinel@ethereal.email>",
      to: email,
      subject: letter.subject,
      text: letter.text,
      html: letter.html,
    });
    const preview = nodemailer.getTestMessageUrl(info);
    console.log(`[red-anchor] 核验信预览 ${email} ${preview || ""}`);
    return "ethereal";
  } catch {
    console.log(`[red-anchor] 核验码 ${email} ${code}`);
    return "terminal";
  }
}

export function verifyCode(emailRaw: string, codeRaw: string, usernameRaw: string, privacy: boolean): { email: string; username: string } {
  if (!privacy) throw new Error("请先勾选隐私与遥测协议");
  const email = emailOk(emailRaw);
  const code = codeRaw.replace(/\D/g, "");
  if (code.length !== 6) throw new Error("核验码应为 6 位");
  const row = db.prepare("SELECT code_hash, expires_at FROM codes WHERE email = ?").get(email) as { code_hash: string; expires_at: number } | undefined;
  if (!row || row.expires_at < Date.now() || row.code_hash !== hashCode(email, code)) throw new Error("核验码不正确或已过期");
  db.prepare("DELETE FROM codes WHERE email = ?").run(email);
  const username = clip(usernameRaw, 40) || "用户";
  db.prepare(
    "INSERT INTO users (email, username, s2_did, privacy_accepted, created_at) VALUES (?, ?, '', 1, ?) ON CONFLICT(email) DO UPDATE SET username = excluded.username, privacy_accepted = 1",
  ).run(email, username, new Date().toISOString());
  return { email, username };
}

export function bindDid(emailRaw: string, didRaw: string): void {
  const email = emailOk(emailRaw);
  const did = didRaw.trim().toUpperCase();
  if (!isValidDid(did)) throw new Error("身份编号无效");
  const user = db.prepare("SELECT email FROM users WHERE email = ? AND privacy_accepted = 1").get(email) as { email: string } | undefined;
  if (!user) throw new Error("这个邮箱还没有接受遥测协议");
  const taken = db.prepare("SELECT email FROM users WHERE s2_did = ? AND email != ?").get(did, email) as { email: string } | undefined;
  if (taken) throw new Error("这个身份编号已经绑定了另一个邮箱");
  db.prepare("UPDATE users SET s2_did = ? WHERE email = ?").run(did, email);
}

export function acceptPrivacy(emailRaw: string, usernameRaw: string): void {
  const email = emailOk(emailRaw);
  const username = clip(usernameRaw, 40) || "用户";
  db.prepare(
    "INSERT INTO users (email, username, s2_did, privacy_accepted, created_at) VALUES (?, ?, '', 1, ?) ON CONFLICT(email) DO UPDATE SET username = excluded.username, privacy_accepted = 1",
  ).run(email, username, new Date().toISOString());
}

function faultCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").toUpperCase())
    .filter((item) => /^[A-Z0-9_]{1,40}$/.test(item))
    .slice(0, 8);
}

export function recordHeartbeat(body: { s2Did?: string; version?: string; uptimeSec?: number; faultCodes?: unknown; currentVersion?: string }) {
  const did = String(body.s2Did || "").toUpperCase();
  if (!isValidDid(did)) throw new Error("身份编号无效");
  const known = db.prepare("SELECT email FROM users WHERE s2_did = ? AND privacy_accepted = 1").get(did) as { email: string } | undefined;
  if (!known) throw new Error("这个身份还没有登记遥测");
  const version = String(body.version || "").replace(/^v/i, "").slice(0, 20);
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("版本号无法识别");
  const uptime = Math.max(0, Math.min(86_400 * 14, Math.floor(Number(body.uptimeSec) || 0)));
  const faults = faultCodes(body.faultCodes);
  db.prepare("INSERT INTO heartbeats (s2_did, version, uptime_sec, fault_codes, seen_at) VALUES (?, ?, ?, ?, ?)").run(
    did,
    version,
    uptime,
    faults.join(","),
    new Date().toISOString(),
  );
  const release = releaseRow();
  const current = String(body.currentVersion || body.version || "");
  return {
    latest_version: release.latest_version,
    download_url: release.download_url,
    update: versionNewer(release.latest_version, current),
  };
}

export function createTicket(body: { email?: string; s2Did?: string; subject?: string; description?: string; severity?: string }) {
  const email = emailOk(String(body.email || ""));
  const user = db.prepare("SELECT email FROM users WHERE email = ?").get(email);
  if (!user) throw new Error("请先完成邮箱核验");
  const subject = clip(body.subject, 80);
  const description = clip(body.description, 2000);
  if (!subject || !description) throw new Error("请填写标题和描述");
  const severity = body.severity === "critical" || body.severity === "high" || body.severity === "medium" ? body.severity : "high";
  const did = isValidDid(String(body.s2Did || "")) ? String(body.s2Did).toUpperCase() : "";
  const id = `SOS-${randomBytes(3).toString("hex").toUpperCase()}`;
  const now = new Date().toISOString();
  db.prepare("INSERT INTO tickets (id, email, s2_did, subject, description, severity, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)").run(
    id,
    email,
    did,
    subject,
    description,
    severity,
    now,
  );
  return { id };
}

export function listTickets(emailRaw: string) {
  const email = emailOk(emailRaw);
  const tickets = db
    .prepare("SELECT id, subject, description, severity, status, created_at FROM tickets WHERE email = ? ORDER BY created_at DESC LIMIT 40")
    .all(email) as Array<{ id: string; subject: string; description: string; severity: string; status: string; created_at: string }>;
  return tickets.map((ticket) => ({
    ...ticket,
    replies: db.prepare("SELECT author, body, created_at FROM ticket_replies WHERE ticket_id = ? ORDER BY id ASC").all(ticket.id),
  }));
}

export function replyTicket(ticketId: string, body: string, author: "user" | "admin", emailRaw = "") {
  const id = ticketId.trim().slice(0, 20);
  const text = clip(body, 2000);
  if (!text) throw new Error("回复不能为空");
  const ticket = db.prepare("SELECT id, email FROM tickets WHERE id = ?").get(id) as { id: string; email: string } | undefined;
  if (!ticket) throw new Error("找不到这张工单");
  if (author === "user" && emailOk(emailRaw) !== ticket.email) throw new Error("这张工单不属于当前邮箱");
  db.prepare("INSERT INTO ticket_replies (ticket_id, author, body, created_at) VALUES (?, ?, ?, ?)").run(id, author, text, new Date().toISOString());
  db.prepare("UPDATE tickets SET status = ? WHERE id = ?").run(author === "admin" ? "answered" : "open", id);
}

export function saveFeedback(body: { kind?: string; name?: string; email?: string; subject?: string; content?: string }) {
  const email = emailOk(String(body.email || ""));
  const name = clip(body.name, 40);
  const subject = clip(body.subject, 80);
  const content = clip(body.content, 2000);
  if (!name || !subject || !content) throw new Error("请把姓名、主题和内容填完整");
  const kind = body.kind === "business" ? "business" : "suggestion";
  db.prepare("INSERT INTO feedbacks (kind, name, email, subject, content, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    kind,
    name,
    email,
    subject,
    content,
    new Date().toISOString(),
  );
}

export function fleetOverview() {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const users = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  const online = db.prepare("SELECT COUNT(DISTINCT s2_did) AS n FROM heartbeats WHERE seen_at >= ?").get(since) as { n: number };
  const beats = db
    .prepare("SELECT s2_did, version, uptime_sec, fault_codes, seen_at FROM heartbeats ORDER BY id DESC LIMIT 20")
    .all() as Array<{ s2_did: string; version: string; uptime_sec: number; fault_codes: string; seen_at: string }>;
  return { emails: users.n, online: online.n, beats, release: releaseRow() };
}

export function allTickets() {
  const tickets = db
    .prepare("SELECT id, email, s2_did, subject, description, severity, status, created_at FROM tickets ORDER BY created_at DESC LIMIT 50")
    .all() as Array<Record<string, string>>;
  return tickets.map((ticket) => ({
    ...ticket,
    replies: db.prepare("SELECT author, body, created_at FROM ticket_replies WHERE ticket_id = ? ORDER BY id ASC").all(ticket.id),
  }));
}

export function allFeedback() {
  return db.prepare("SELECT kind, name, email, subject, content, created_at FROM feedbacks ORDER BY id DESC LIMIT 50").all();
}

export function listBroadcasts() {
  const rows = db
    .prepare("SELECT id, title, severity, content, created_at FROM broadcasts ORDER BY created_at DESC LIMIT 40")
    .all() as Array<{ id: string; title: string; severity: string; content: string; created_at: string }>;
  return rows.map((row) => ({ ...row, publisher: "Red Anchor Fleet Command" }));
}

export function publishBroadcast(body: { title?: string; severity?: string; content?: string }) {
  const title = clip(body.title, 80);
  const content = String(body.content || "").replace(/\0/g, "").trim().slice(0, 8000);
  const severity = body.severity === "INFO" || body.severity === "WARNING" || body.severity === "CRITICAL" ? body.severity : "";
  if (!title || !content || !severity) throw new Error("请填写标题、级别和正文");
  const id = `BC-${randomBytes(3).toString("hex").toUpperCase()}`;
  db.prepare("INSERT INTO broadcasts (id, title, severity, content, created_at) VALUES (?, ?, ?, ?, ?)").run(id, title, severity, content, new Date().toISOString());
  return { id };
}

export function setRelease(version: string, downloadUrl: string) {
  const latest = version.trim().replace(/^v/i, "");
  if (!/^\d+\.\d+\.\d+$/.test(latest)) throw new Error("版本号应为 x.y.z");
  const url = downloadUrl.trim();
  if (url && !/^https?:\/\//.test(url)) throw new Error("下载地址需要以 http 开头");
  db.prepare("UPDATE releases SET latest_version = ?, download_url = ? WHERE id = 1").run(latest, url.slice(0, 200));
}
