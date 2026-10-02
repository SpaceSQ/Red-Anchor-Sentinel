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
  const lines = Buffer.concat(chunks).toString("utf8").split(/\r?\n/).filter(Boolean).slice(-30);
  for (const line of lines) {
    const safe = line.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
    console.log(`::error::${safe}`);
  }
  process.exit(code);
}
