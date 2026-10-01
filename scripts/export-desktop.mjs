import { rename } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const api = "app/api";
const stash = ".api-stash";
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");

await rename(api, stash);
let code = 1;
try {
  code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBin, "build"], {
      stdio: "inherit",
      env: { ...process.env, TAURI_BUILD: "1" },
    });
    child.on("error", reject);
    child.on("exit", (status) => resolve(status ?? 1));
  });
} finally {
  await rename(stash, api);
}
if (code !== 0) process.exit(code);
