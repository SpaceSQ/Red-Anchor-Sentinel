import { dispatch } from "./host.mjs";
import { sendActivationCode, verifyActivationCode } from "./activation-mail.mjs";
import { labOp } from "./lab-desk.mjs";

const op = process.argv[2] || "hardware";
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const raw = Buffer.concat(chunks).toString("utf8").trim();
const body = raw ? JSON.parse(raw) : {};

try {
  const result = op === "sendCode"
    ? await sendActivationCode(body)
    : op === "verifyCode"
      ? verifyActivationCode(body)
      : op.startsWith("lab")
        ? labOp(op, body)
        : await dispatch(op, body);
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : "host failed");
  process.exit(1);
}
