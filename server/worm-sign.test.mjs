import assert from "node:assert/strict";
import test from "node:test";
import { assessWorm, draftFromListeners, parseEstablished, parseListeners, parseTasklist } from "./worm-sign.mjs";

const LISTEN = "rapportd   1034 David1   11u  IPv4  0x4405169369dd499      0t0  TCP *:49152 (LISTEN)";

test("parser reads the current macOS lsof listen line", () => {
  const rows = parseListeners(`${LISTEN}\nollama  501 David1  8u  IPv4 0xabc      0t0  TCP 127.0.0.1:11434 (LISTEN)\n`);
  assert.equal(rows[0].name, "rapportd");
  assert.equal(rows[0].port, "49152");
  assert.equal(rows[1].bind, "127.0.0.1");
  assert.equal(rows[1].port, "11434");
});

test("an ADB listener is seek, and a loopback inference server is infer", () => {
  const listeners = parseListeners(
    [
      "adbd  99 David1  4u  IPv4 0x1      0t0  TCP *:5555 (LISTEN)",
      "ollama  12 David1  8u  IPv4 0x2      0t0  TCP 127.0.0.1:11434 (LISTEN)",
    ].join("\n"),
  );
  const report = assessWorm(listeners, []);
  assert.equal(report.findings.some((item) => item.id === "adb-listen" && item.stage === "seek"), true);
  assert.equal(report.findings.some((item) => item.id === "infer-ollama" && item.stage === "infer"), true);
  assert.equal(report.findings.some((item) => item.stage === "spread"), false);
  assert.equal(report.severity, "watch");
});

test("an inference port bound beyond loopback adds the execute stage", () => {
  const listeners = parseListeners("ollama  12 David1  8u  IPv4 0x2      0t0  TCP *:11434 (LISTEN)\n");
  const report = assessWorm(listeners, []);
  assert.equal(report.findings.some((item) => item.stage === "execute"), true);
});

test("three private peers from an inference process count as spread", () => {
  const established = parseEstablished(
    [
      "llama-server  3 David1  8u  IPv4 0x1      0t0  TCP 192.168.1.2:9000->10.0.0.2:1234 (ESTABLISHED)",
      "llama-server  3 David1  9u  IPv4 0x1      0t0  TCP 192.168.1.2:9001->10.0.0.3:1234 (ESTABLISHED)",
      "llama-server  3 David1  10u  IPv4 0x1      0t0  TCP 192.168.1.2:9002->192.168.1.9:1234 (ESTABLISHED)",
    ].join("\n"),
  );
  const report = assessWorm([], established);
  assert.equal(report.findings.some((item) => item.id === "spread-peers"), true);
});

test("ollama on its own port counts toward spread by process id", () => {
  const listeners = [{ name: "ollama", pid: "12", bind: "127.0.0.1", port: "11434" }];
  const established = [
    { name: "ollama", pid: "12", remote: "10.0.0.2" },
    { name: "ollama", pid: "12", remote: "10.0.0.3" },
    { name: "ollama", pid: "12", remote: "192.168.1.9" },
  ];
  assert.equal(assessWorm(listeners, established).findings.some((item) => item.id === "spread-peers"), true);
});

test("Windows tasklist names are stripped to the process name", () => {
  assert.deepEqual(parseTasklist('"nmap.exe","1234","Console","1","12 K"\n'), ["nmap"]);
});

test("two peers stay under the spread line", () => {
  const established = parseEstablished(
    [
      "llama-server  3 David1  8u  IPv4 0x1      0t0  TCP 192.168.1.2:9000->10.0.0.2:1234 (ESTABLISHED)",
      "llama-server  3 David1  9u  IPv4 0x1      0t0  TCP 192.168.1.2:9001->10.0.0.3:1234 (ESTABLISHED)",
    ].join("\n"),
  );
  assert.equal(assessWorm([], established).findings.some((item) => item.stage === "spread"), false);
});

test("a local sweep tool is matched by process name, and a short name does not match a longer one", () => {
  const hit = assessWorm([], [], [], ["/usr/bin/nmap"]);
  assert.equal(hit.findings.some((item) => item.id === "local-sweep-tool"), true);
  const miss = assessWorm([], [], [], ["hexo"]);
  assert.equal(miss.findings.some((item) => item.id === "infer-exo"), false);
});

test("a familiar inference name is not drafted, an unfamiliar one is", () => {
  assert.equal(draftFromListeners([{ name: "ollama", pid: "1", bind: "127.0.0.1", port: "11434" }]).length, 0);
  const drafts = draftFromListeners([{ name: "shard-box", pid: "2", bind: "127.0.0.1", port: "11434" }]);
  assert.equal(drafts[0].value, "shard-box");
  assert.equal(drafts[0].stage, "infer");
  assert.equal(draftFromListeners([{ name: "nginx", pid: "3", bind: "*", port: "80" }]).length, 0);
});
