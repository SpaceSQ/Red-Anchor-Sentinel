import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const tauriJs = createRequire(import.meta.url).resolve("@tauri-apps/cli/tauri.js");
const child = spawn(process.execPath, [tauriJs, ...process.argv.slice(2)], {
  stdio: ["inherit", "pipe", "pipe"],
});
const chunks = [];
const keep = (data, stream) => {
  stream.write(data);
  chunks.push(data);
};
child.stdout.on("data", (data) => keep(data, process.stdout));
child.stderr.on("data", (data) => keep(data, process.stderr));

const code = await new Promise((resolve, reject) => {
  child.on("error", reject);
  child.on("exit", (status) => resolve(status ?? 1));
});

if (code !== 0) {
  const lines = Buffer.concat(chunks)
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.replace(/\u001b\[[0-9;]*m/g, "").trim())
    .filter(Boolean);
  const interesting = lines.filter((line) =>
    /error|failed|not found|enoent|eperm|einval|panicked|RAS_EXPORT_CODE|unable to|cannot |can't /i.test(line),
  );
  const picked = (interesting.length ? interesting : lines.slice(-8)).slice(-8);
  const message = picked.join(" || ").replace(/::/g, ":").slice(0, 2000);
  console.log(`::error::${message}`);
  process.exit(code);
}
