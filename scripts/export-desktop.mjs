import { rename } from "node:fs/promises";
import { spawn } from "node:child_process";

const api = "app/api";
const stash = ".api-stash";

await rename(api, stash);
const child = spawn("npx", ["next", "build"], {
  stdio: "inherit",
  env: { ...process.env, TAURI_BUILD: "1" },
});

const code = await new Promise((resolve) => {
  child.on("exit", resolve);
});
await rename(stash, api);
if (code !== 0) process.exit(code ?? 1);
