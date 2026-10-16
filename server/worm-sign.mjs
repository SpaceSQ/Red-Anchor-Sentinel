/** Defensive markers for weight-based AI replicators.
 * Matching uses this host's own listeners and established sockets.
 * It does not scan the WAN, read process memory, or describe how to replicate.
 */

export const STAGES = ["seek", "execute", "infer", "spread"];

export const BUILTIN_SIGNS = [
  {
    id: "adb-listen",
    stage: "seek",
    kind: "port",
    value: "5555",
    title: "ADB listener",
    titleZh: "ADB 监听",
    note: "This host is listening on the Android debug port. Public research treats an open debug port as a way a replicator finds a next host. This record does not connect to any device.",
    noteZh: "本机正在监听安卓调试端口。公开研究把打开的调试口当作复制体寻找下一台主机的入口。这条记录不连接任何设备。",
  },
  {
    id: "local-sweep-tool",
    stage: "seek",
    kind: "process",
    value: "nmap",
    title: "Local sweep tool",
    titleZh: "本机扫描工具",
    note: "A sweep tool is running on this host. The sentinel did not start it and does not sweep the WAN.",
    noteZh: "本机上有扫描工具在运行。哨兵没有启动它，也不会扫描广域网。",
  },
  {
    id: "masscan-local",
    stage: "seek",
    kind: "process",
    value: "masscan",
    title: "Local sweep tool",
    titleZh: "本机扫描工具",
    note: "A sweep tool is running on this host. The sentinel did not start it and does not sweep the WAN.",
    noteZh: "本机上有扫描工具在运行。哨兵没有启动它，也不会扫描广域网。",
  },
  {
    id: "infer-ollama",
    stage: "infer",
    kind: "port",
    value: "11434",
    title: "Local inference server",
    titleZh: "本地推理服务",
    note: "An inference server is listening. A weight-based replicator has to stand a server up before it can continue. Presence alone is not proof of a worm.",
    noteZh: "有推理服务在监听。按权重复制的程序要先把服务搭起来才能继续。仅有服务在听，不能证明这是蠕虫。",
  },
  {
    id: "infer-lmstudio",
    stage: "infer",
    kind: "port",
    value: "1234",
    title: "LM Studio listener",
    titleZh: "LM Studio 监听",
    note: "An inference server is listening. Presence alone is not proof of a worm.",
    noteZh: "有推理服务在监听。仅有服务在听，不能证明这是蠕虫。",
  },
  {
    id: "infer-comfy",
    stage: "infer",
    kind: "port",
    value: "8188",
    title: "ComfyUI listener",
    titleZh: "ComfyUI 监听",
    note: "A local generation service is listening. Presence alone is not proof of a worm.",
    noteZh: "本机有生成服务在监听。仅有服务在听，不能证明这是蠕虫。",
  },
  {
    id: "infer-llama-server",
    stage: "infer",
    kind: "process",
    value: "llama-server",
    title: "llama-server",
    titleZh: "llama-server",
    note: "A local inference process is running.",
    noteZh: "本机有推理进程在运行。",
  },
  {
    id: "infer-vllm",
    stage: "infer",
    kind: "process",
    value: "vllm",
    title: "vLLM",
    titleZh: "vLLM",
    note: "A local inference process is running.",
    noteZh: "本机有推理进程在运行。",
  },
  {
    id: "infer-petals",
    stage: "infer",
    kind: "process",
    value: "petals",
    title: "Distributed shard",
    titleZh: "分布式分片",
    note: "A distributed-inference process is running. Public research describes model shards spread across small devices. This record does not join that network.",
    noteZh: "本机有分布式推理进程。公开研究描述过把模型分片铺到小设备上。这条记录不加入那个网络。",
  },
  {
    id: "infer-exo",
    stage: "infer",
    kind: "process",
    value: "exo",
    title: "Distributed shard",
    titleZh: "分布式分片",
    note: "A distributed-inference process is running. This record does not join that network.",
    noteZh: "本机有分布式推理进程。这条记录不加入那个网络。",
  },
];

const INFERENCE_PORTS = new Set(["11434", "1234", "8188"]);

export function parseListeners(text) {
  const rows = [];
  for (const line of String(text || "").split("\n")) {
    if (!line.includes("(LISTEN)")) continue;
    const head = line.match(/^(\S+)\s+(\d+)\s+/);
    const name = line.match(/(\S+):(\d+)\s+\(LISTEN\)/);
    if (!head || !name) continue;
    rows.push({ name: head[1], pid: head[2], bind: name[1], port: name[2] });
  }
  return rows;
}

export function parseTasklist(text) {
  return String(text || "")
    .split("\n")
    .map((line) => {
      const match = line.match(/^"([^"]+)"/);
      if (!match) return "";
      return match[1].replace(/\.exe$/i, "");
    })
    .filter(Boolean);
}

export function parseEstablished(text) {
  const rows = [];
  for (const line of String(text || "").split("\n")) {
    if (!line.includes("(ESTABLISHED)")) continue;
    const head = line.match(/^(\S+)\s+(\d+)\s+/);
    const arrow = line.match(/->(\[[^\]]+\]|[^:\s]+):\d+\s+\(ESTABLISHED\)/);
    if (!head || !arrow) continue;
    const remote = arrow[1].startsWith("[") ? arrow[1].slice(1, -1) : arrow[1];
    rows.push({ name: head[1], pid: head[2], remote });
  }
  return rows;
}

export function isPrivateHost(host) {
  const ip = String(host || "");
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return false;
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  return false;
}

function loopback(bind) {
  return bind === "127.0.0.1" || bind === "[::1]" || bind === "localhost";
}

function nameMatches(processName, value) {
  const base = String(processName || "").split(/[/\\]/).pop().toLowerCase();
  const needle = String(value || "").toLowerCase();
  if (!base || !needle) return false;
  if (base === needle) return true;
  return needle.length >= 6 && base.includes(needle);
}

export function assessWorm(listeners, established, extraSigns = [], processNames = []) {
  const signs = [...BUILTIN_SIGNS, ...extraSigns];
  const findings = [];
  const seen = new Set();
  function add(sign, evidence) {
    const key = `${sign.id}:${evidence}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({
      id: sign.id,
      stage: sign.stage,
      title: sign.title,
      titleZh: sign.titleZh || sign.title,
      note: sign.note,
      noteZh: sign.noteZh || sign.note,
      evidence,
    });
  }
  for (const row of listeners) {
    for (const sign of signs) {
      if (sign.kind === "port" && row.port === String(sign.value)) add(sign, `${row.name} ${row.bind}:${row.port}`);
      if (sign.kind === "process" && nameMatches(row.name, sign.value)) {
        add(sign, `${row.name} ${row.bind}:${row.port}`);
      }
    }
    const inferProcess = signs.some((sign) => sign.stage === "infer" && sign.kind === "process" && nameMatches(row.name, sign.value));
    if (!loopback(row.bind) && (INFERENCE_PORTS.has(row.port) || inferProcess)) {
      add(
        {
          id: "infer-exposed",
          stage: "execute",
          title: "Inference reachable beyond this host",
          titleZh: "推理服务可从本机以外访问",
          note: "An inference listener is bound beyond loopback. The sentinel does not connect to it.",
          noteZh: "推理监听绑在回环以外。哨兵不去连接它。",
        },
        `${row.name} ${row.bind}:${row.port}`,
      );
    }
  }
  const inferPids = new Set(
    listeners
      .filter((row) => INFERENCE_PORTS.has(row.port) || signs.some((sign) => sign.stage === "infer" && sign.kind === "process" && nameMatches(row.name, sign.value)))
      .map((row) => row.pid),
  );
  const peers = new Map();
  for (const row of established) {
    if (!isPrivateHost(row.remote)) continue;
    const inference = inferPids.has(row.pid) || signs.some((sign) => sign.stage === "infer" && sign.kind === "process" && nameMatches(row.name, sign.value));
    if (!inference) continue;
    const set = peers.get(row.name) || new Set();
    set.add(row.remote);
    peers.set(row.name, set);
  }
  for (const [name, set] of peers) {
    if (set.size < 3) continue;
    add(
      {
        id: "spread-peers",
        stage: "spread",
        title: "Inference process talking to several LAN peers",
        titleZh: "推理进程在和多台局域网邻居通信",
        note: "Public research treats sustained device-to-device traffic as the visible trace of a shard or a copy step. This count uses sockets this host already has open.",
        noteZh: "公开研究把持续的设备间流量当作分片或复制步骤留下的痕迹。这个计数只用本机已经打开的连接。",
      },
      `${name} peers:${set.size}`,
    );
  }
  for (const processName of processNames) {
    for (const sign of signs) {
      if (sign.kind === "process" && nameMatches(processName, sign.value)) add(sign, processName.split(/[/\\]/).pop());
    }
  }
  const stages = [...new Set(findings.map((item) => item.stage))];
  const severity = stages.length >= 3 ? "critical" : stages.length >= 2 ? "watch" : findings.length ? "note" : "clear";
  return {
    severity,
    stages,
    findings,
    library: signs.length,
    basis: "Anthropic, Self-replicating AI without a datacenter, 12 Oct 2026. Four stages: find, execute, infer, propagate. Matched only on this host.",
  };
}

const PORT_ALIASES = {
  11434: ["ollama"],
  1234: ["lmstudio", "lms"],
  8188: ["comfyui", "python", "python3"],
  5555: ["adbd"],
};

const GENERIC = new Set(["node", "python", "python3", "java", "ruby", "perl", "deno", "bun"]);

export function draftFromListeners(listeners, extraSigns = []) {
  const known = new Set(
    [...BUILTIN_SIGNS, ...extraSigns].filter((sign) => sign.kind === "process").map((sign) => String(sign.value).toLowerCase()),
  );
  const drafts = [];
  for (const row of listeners) {
    const name = row.name.toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{1,31}$/.test(name)) continue;
    if (known.has(name) || GENERIC.has(name)) continue;
    if ((PORT_ALIASES[row.port] || []).includes(name)) continue;
    if (!INFERENCE_PORTS.has(row.port) && row.port !== "5555") continue;
    drafts.push({
      kind: "process",
      value: name,
      stage: row.port === "5555" ? "seek" : "infer",
      port: row.port,
      note: `Seen listening as ${name} on ${row.port}. Draft only. A person must promote it.`,
      noteZh: `看到 ${name} 在 ${row.port} 上监听。这只是草稿，必须由人确认。`,
    });
    known.add(name);
  }
  return drafts;
}
