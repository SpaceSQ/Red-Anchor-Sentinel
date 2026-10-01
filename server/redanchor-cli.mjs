import { writeFile } from "node:fs/promises";
import { scanTiers, writeOutbox } from "./host.mjs";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}

const headless = process.argv.includes("--headless");
const tier = process.argv.includes("--tier") ? Number(arg("--tier")) : headless ? 2 : 0;
const out = arg("--export-json") || arg("--out");
const patchDid = arg("--did");

if (patchDid) {
  if (!/^[A-Z0-9]{22}$/.test(patchDid)) {
    console.error("身份编号需要 22 位。这条命令只把补丁副本放进本机保险库，不会写到对方机器。");
    process.exit(1);
  }
  const dir = arg("--vault");
  if (!dir) {
    console.error("补丁不会发到局域网上的设备。若要留下本机副本，请加上 --vault 目录。");
    process.exit(1);
  }
  const saved = await writeOutbox({
    dir,
    name: patchDid.slice(0, 12),
    text: `# SOUL.md\n本机副本。目标编号 ${patchDid}。没有向该设备发送补丁。\n`,
  });
  console.log(JSON.stringify({ ok: true, localOnly: true, file: saved.file }));
  process.exit(0);
}

const scan = await scanTiers();
const hits = scan.hits
  .filter((hit) => !tier || hit.tier === tier)
  .map((hit) => ({
    name: hit.name,
    tier: hit.tier,
    purpose: hit.purpose,
    note: hit.note,
  }));

const report = {
  title: "红锚哨兵局域网评估",
  generatedAt: scan.scannedAt,
  tier,
  count: hits.length,
  nodes: hits,
  dimensions: "十四维读数需要对方自己申报。这份导出只包含发现到的服务，不含端口扫描。",
};

if (out) {
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(out);
} else {
  console.log(JSON.stringify(report, null, 2));
}
