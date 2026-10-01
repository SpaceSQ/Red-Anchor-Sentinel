import { spawnSync } from "node:child_process";

const target = process.argv[2];
if (!target) {
  process.stderr.write("需要编译目标，例如 aarch64-apple-darwin\n");
  process.exit(1);
}

const rustc = spawnSync("rustc", ["--version"], { encoding: "utf8" });
if (rustc.status !== 0) {
  process.stderr.write("未检测到 Rust。桌面安装包需要本机 rustup。当前不会生成 .dmg 或 .exe。\n");
  process.exit(1);
}

const child = spawnSync("npx", ["tauri", "build", "--target", target], { stdio: "inherit" });
process.exit(child.status ?? 1);
