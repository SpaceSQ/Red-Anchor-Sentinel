import { dispatch } from "./host.mjs";

const op = process.argv[2] || "hardware";
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const raw = Buffer.concat(chunks).toString("utf8").trim();
const body = raw ? JSON.parse(raw) : {};

try {
  const result = await dispatch(op, body);
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : "host failed");
  process.exit(1);
}
