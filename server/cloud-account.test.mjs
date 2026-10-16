import assert from "node:assert/strict";
import test from "node:test";
import { confirmSignup, loginCloud, registerCloud, sendSignupCode } from "./cloud-account.mjs";

const env = { url: "https://example.test", key: "anon" };

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

test("signup code is requested from the cloud and reports success without a computer", async () => {
  let called = "";
  const result = await sendSignupCode(
    { email: "pilot@example.com", privacy: true, locale: "en" },
    {
      env,
      fetch: async (url) => {
        called = String(url);
        return jsonResponse(200, {});
      },
    },
  );
  assert.equal(result.delivery, "cloud");
  assert.equal(called, "https://example.test/auth/v1/otp");
});

test("a refused cloud connection says the message was not sent", async () => {
  await assert.rejects(
    () => sendSignupCode(
      { email: "pilot@example.com", privacy: true, locale: "zh" },
      { env, fetch: async () => { throw new Error("fetch failed"); } },
    ),
    /没有发出/,
  );
});

test("privacy, code, and password checks answer before any network call", async () => {
  const fetch = async () => {
    throw new Error("should not send");
  };
  await assert.rejects(() => sendSignupCode({ email: "pilot@example.com", privacy: false, locale: "en" }, { env, fetch }), /privacy/i);
  await assert.rejects(() => confirmSignup({ email: "pilot@example.com", code: "12", privacy: true, locale: "en" }, { env, fetch }), /6 digits/);
  await assert.rejects(
    () => registerCloud({ email: "pilot@example.com", proof: "session", password: "short", confirm: "short", privacy: true, locale: "en" }, { env, fetch }),
    /8 to 72/,
  );
});

test("confirm then register keeps the cloud session, and login returns a token", async () => {
  const confirmed = await confirmSignup(
    { email: "pilot@example.com", code: "123456", privacy: true, locale: "en" },
    { env, fetch: async () => jsonResponse(200, { access_token: "session-token", user: { email: "pilot@example.com" } }) },
  );
  assert.equal(confirmed.proof, "session-token");
  const registered = await registerCloud(
    { email: "pilot@example.com", proof: confirmed.proof, password: "anchor-pass", confirm: "anchor-pass", privacy: true, locale: "en" },
    { env, fetch: async () => jsonResponse(200, { email: "pilot@example.com" }) },
  );
  assert.equal(registered.token, "session-token");
  const logged = await loginCloud(
    { email: "pilot@example.com", password: "anchor-pass", locale: "en" },
    { env, fetch: async () => jsonResponse(200, { access_token: "login-token", user: { email: "pilot@example.com" } }) },
  );
  assert.equal(logged.token, "login-token");
});
