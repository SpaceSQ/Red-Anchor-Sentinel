import { createHash, randomInt } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import net from "node:net";
import { homedir } from "node:os";
import path from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vault = path.join(homedir(), "RedAnchorVault");

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

function loadEnv() {
  const env = {
    ...readEnvFile(path.join(root, ".env")),
    ...readEnvFile(path.join(vault, ".env")),
  };
  for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_SECURE"]) {
    if (process.env[key]) env[key] = process.env[key].trim();
  }
  return env;
}

const env = loadEnv();
mkdirSync(vault, { recursive: true });
const db = new DatabaseSync(path.join(vault, "activation-codes.db"), { timeout: 5000 });
db.exec(`
  CREATE TABLE IF NOT EXISTS codes (
    email TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

function emailOk(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) throw new Error("邮箱格式不正确");
  return email;
}

function hashCode(email, code) {
  return createHash("sha256").update(`${email}:${code}`).digest("hex");
}

function letter(code) {
  const subject = "[Red Anchor Sentinel] Your S2-DID Activation Code / 您的创世核验码";
  const text = [
    "Welcome to Red Anchor Sentinel. Your physical failsafe activation code is: " + code + ".",
    "This code will expire in 10 minutes. If you did not request this, please ignore.",
  ].join("\n");
  const html = `<!DOCTYPE html>
<html lang="zh-CN"><body style="margin:0;background:#020617;color:#e2e8f0;font-family:Segoe UI,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#020617;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#070b14;border:1px solid #7f1d1d;">
<tr><td style="padding:22px 28px;border-bottom:1px solid #7f1d1d;">
<div style="color:#ef4444;font-size:12px;letter-spacing:0.22em;">RED ANCHOR SENTINEL</div>
<div style="margin-top:8px;color:#fecaca;font-size:22px;">S2-DID 创世核验</div>
</td></tr>
<tr><td style="padding:28px;line-height:1.65;font-size:15px;">
<p style="margin:0 0 16px;">Welcome to Red Anchor Sentinel. Your physical failsafe activation code is:</p>
<p style="margin:0 0 16px;text-align:center;font-family:ui-monospace,Menlo,monospace;font-size:34px;letter-spacing:0.38em;color:#fecaca;">${code}</p>
<p style="margin:0;">This code will expire in 10 minutes. If you did not request this, please ignore.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

function encodedSubject(subject) {
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function mimeBody(text, html) {
  const boundary = `ras-${createHash("sha256").update(text).digest("hex").slice(0, 16)}`;
  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(text, "utf8").toString("base64"),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html, "utf8").toString("base64"),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return { boundary, body };
}

function smtpSend({ host, port, secure, user, pass, to, subject, text, html }) {
  return new Promise((resolve, reject) => {
    const socket = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    let buffer = "";
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      socket.end();
      resolve();
    };
    socket.setTimeout(20000, () => fail(new Error("发信超时")));
    socket.on("error", fail);
    const pending = [];
    let reading = null;
    function readCode() {
      return new Promise((ok, no) => {
        reading = { ok, no };
        pump();
      });
    }
    function pump() {
      if (!reading) return;
      const match = buffer.match(/(?:^|\n)(\d{3}) (.*)\r?\n/);
      if (!match) return;
      buffer = buffer.slice(match.index + match[0].length);
      const done = reading;
      reading = null;
      done.ok({ code: Number(match[1]), line: `${match[1]} ${match[2]}` });
    }
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      pump();
    });
    async function command(line, expect) {
      if (line != null) socket.write(`${line}\r\n`);
      const reply = await readCode();
      if (reply.code !== expect) throw new Error(reply.line || "发信被拒绝");
      return reply;
    }
    pending.push((async () => {
      try {
        await command(null, 220);
        await command(`EHLO red-anchor.local`, 250);
        await command("AUTH LOGIN", 334);
        await command(Buffer.from(user).toString("base64"), 334);
        await command(Buffer.from(pass).toString("base64"), 235);
        await command(`MAIL FROM:<${user}>`, 250);
        await command(`RCPT TO:<${to}>`, 250);
        await command("DATA", 354);
        const message = mimeBody(text, html);
        const data = [
          `From: "Red Anchor Sentinel" <${user}>`,
          `To: <${to}>`,
          `Subject: ${encodedSubject(subject)}`,
          "MIME-Version: 1.0",
          `Content-Type: multipart/alternative; boundary="${message.boundary}"`,
          "",
          message.body,
          ".",
        ].join("\r\n");
        await command(data, 250);
        socket.write("QUIT\r\n");
        finish();
      } catch (error) {
        fail(error);
      }
    })());
  });
}

export async function sendActivationCode(body) {
  if (body.privacy !== true) throw new Error("请先勾选隐私与遥测协议");
  const email = emailOk(body.email);
  const user = env.SMTP_USER || "";
  const pass = env.SMTP_PASS || "";
  const host = env.SMTP_HOST || "";
  if (!host || !user || !pass) throw new Error("发信账号未配置完整");
  const code = String(randomInt(100000, 1000000));
  db.prepare("INSERT INTO codes (email, code_hash, expires_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at").run(
    email,
    hashCode(email, code),
    Date.now() + 10 * 60 * 1000,
  );
  const port = Number(env.SMTP_PORT || 465);
  const message = letter(code);
  await smtpSend({
    host,
    port,
    secure: port === 465 || env.SMTP_SECURE === "1",
    user,
    pass,
    to: email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  return { ok: true, delivery: "smtp" };
}

export function verifyActivationCode(body) {
  if (body.privacy !== true) throw new Error("请先勾选隐私与遥测协议");
  const email = emailOk(body.email);
  const code = String(body.code || "").replace(/\D/g, "");
  if (code.length !== 6) throw new Error("核验码应为 6 位");
  const row = db.prepare("SELECT code_hash, expires_at FROM codes WHERE email = ?").get(email);
  if (!row || row.expires_at < Date.now() || row.code_hash !== hashCode(email, code)) throw new Error("核验码不正确或已过期");
  db.prepare("DELETE FROM codes WHERE email = ?").run(email);
  const username = String(body.username || "").trim().slice(0, 40) || "用户";
  return { ok: true, email, username };
}
