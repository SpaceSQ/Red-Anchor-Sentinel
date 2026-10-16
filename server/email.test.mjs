import assert from "node:assert/strict";
import test from "node:test";
import { activationMessage, aliyunFrom, createSmtpTransport, threatMessage } from "../lib/email.ts";

test("Aliyun From is the SMTP user", () => {
  assert.equal(aliyunFrom("ras@example.com"), '"Red Anchor Sentinel" <ras@example.com>');
  const mail = createSmtpTransport({
    host: "smtpdm.aliyun.com",
    port: "465",
    user: "ras@example.com",
    pass: "not-a-real-password",
    secure: "",
  });
  assert.equal(mail.from, '"Red Anchor Sentinel" <ras@example.com>');
  assert.equal(mail.transport.options.secure, true);
  assert.equal(mail.transport.options.port, 465);
});

test("activation and threat letters stay in one language and omit readings", () => {
  const zh = activationMessage("123456");
  assert.match(zh.subject, /核验码/);
  assert.doesNotMatch(zh.text, /Activation Code/);
  const en = activationMessage("123456", "en");
  assert.match(en.subject, /Activation Code/);
  assert.doesNotMatch(en.text, /核验码/);
  const threat = threatMessage("air", "critical");
  assert.match(threat.text, /基气/);
  assert.doesNotMatch(threat.text, /20\.9|192\.168/);
  assert.throws(() => threatMessage("lan-scan", "critical"), /维度/);
  assert.throws(() => activationMessage("12"), /6 位/);
});
