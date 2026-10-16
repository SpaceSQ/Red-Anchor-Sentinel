import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

process.env.RAS_ACCOUNTS_DB = path.join(mkdtempSync(path.join(tmpdir(), "ras-accounts-")), "accounts.db");
const { confirmEmail, confirmReset, loginAccount, registerAccount, resetPassword, storeResetCode, storeSignupCode } = await import("./accounts.mjs");

test("email confirmation then password creates one shared login", () => {
  storeSignupCode("pilot@example.com", "123456");
  const confirmed = confirmEmail({ email: "pilot@example.com", code: "123456", privacy: true, locale: "en" });
  assert.equal(confirmed.email, "pilot@example.com");
  assert.equal(typeof confirmed.proof, "string");
  const created = registerAccount({
    email: "pilot@example.com",
    proof: confirmed.proof,
    password: "anchor-pass",
    confirm: "anchor-pass",
    privacy: true,
    locale: "en",
  });
  assert.equal(created.email, "pilot@example.com");
  assert.throws(() => loginAccount({ email: "pilot@example.com", password: "wrong-pass", locale: "en" }), /incorrect/);
  const session = loginAccount({ email: "pilot@example.com", password: "anchor-pass", locale: "en" });
  assert.equal(session.email, "pilot@example.com");
  assert.notEqual(session.token, created.token);
});

test("a reset code replaces the password and drops the old session", () => {
  storeResetCode("pilot@example.com", "654321");
  const confirmed = confirmReset({ email: "pilot@example.com", code: "654321", privacy: true, locale: "en" });
  const reset = resetPassword({
    email: "pilot@example.com",
    proof: confirmed.proof,
    password: "anchor-next",
    confirm: "anchor-next",
    privacy: true,
    locale: "en",
  });
  assert.equal(reset.email, "pilot@example.com");
  assert.throws(() => loginAccount({ email: "pilot@example.com", password: "anchor-pass", locale: "en" }), /incorrect/);
  const session = loginAccount({ email: "pilot@example.com", password: "anchor-next", locale: "en" });
  assert.equal(session.email, "pilot@example.com");
  assert.throws(() => confirmReset({ email: "missing@example.com", code: "654321", privacy: true, locale: "en" }), /not registered/);
});
