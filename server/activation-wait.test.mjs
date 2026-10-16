import assert from "node:assert/strict";
import test from "node:test";
import { activationSendWait } from "./activation-mail.mjs";

test("a code request must wait a full minute", () => {
  const now = 1_000_000;
  assert.equal(activationSendWait(0, now), 0);
  assert.equal(activationSendWait(now - 1_000, now), 59);
  assert.equal(activationSendWait(now - 60_000, now), 0);
});
