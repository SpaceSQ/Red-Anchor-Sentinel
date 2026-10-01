import { assess } from "../lib/assess";
import { draftFromNotes, resolveTrack } from "../lib/dual-track";
import { isValidDid, isValidU6a, SENTINEL } from "../lib/did";
import { SANDBOX_FLEET } from "../lib/fleet";
import { EARTH, scoreTensor } from "../lib/tensor";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const byId = Object.fromEntries(SANDBOX_FLEET.map((agent) => [agent.id, agent]));

assert(isValidDid(SENTINEL.did), "sentinel seal");
assert(isValidU6a(SENTINEL.u6a), "sentinel address");
assert(!isValidDid(byId.ghost.s2Did), "ghost did should fail checksum");
assert(!isValidU6a(byId.ghost.u6a), "ghost address");
for (const agent of SANDBOX_FLEET) {
  if (agent.id === "ghost") continue;
  assert(isValidDid(agent.s2Did), `${agent.id} did`);
  assert(isValidU6a(agent.u6a), `${agent.id} u6a`);
}

const earthMax = Math.max(...Object.values(scoreTensor(EARTH)));
assert(earthMax < 20, `earth baseline too hot: ${earthMax}`);

const atmos = assess(byId.atmos.tensor, byId.atmos.intents, "UNPATCHED");
assert(atmos.carbon === "SAFE" && atmos.silicon === "SAFE", `atmos ${atmos.carbon}/${atmos.silicon}`);

const vita = assess(byId.vita.tensor, byId.vita.intents, "UNPATCHED");
assert(vita.carbon === "CRITICAL", "vita carbon");
assert(vita.scores.air >= 67, `vita air ${vita.scores.air}`);

const vitaFixed = assess(byId.vita.tensor, byId.vita.intents, "SECURED");
assert(vitaFixed.carbon === "SAFE", `patched vita ${vitaFixed.carbon} air ${vitaFixed.scores.air}`);
assert(vitaFixed.scores.air < 34, `clamped air ${vitaFixed.scores.air}`);

const lumina = assess(byId.lumina.tensor, byId.lumina.intents, "UNPATCHED");
assert(lumina.scores.light >= 67 && lumina.carbon === "CRITICAL", "lumina");

const ember = assess(byId.ember.tensor, byId.ember.intents, "UNPATCHED");
assert(ember.carbon === "SAFE" && ember.silicon === "CRITICAL", `ember ${ember.carbon}/${ember.silicon}`);
assert(ember.spatial <= 15, `ember spatial ${ember.spatial}`);

const infra = assess(byId.infra.tensor, byId.infra.intents, "UNPATCHED");
assert(infra.scores.sound >= 90 && infra.carbon === "CRITICAL", "infra carbon");
assert(infra.silicon === "CRITICAL", `infra silicon wave ${infra.scores.wave}`);

const drafted = draftFromNotes("洗衣机正在运行。京东冷链送达生鲜。网络频繁掉线。");
assert(drafted.some((item) => item.dimension === "water" && item.trend === "up"), "water draft");
assert(drafted.some((item) => item.dimension === "food" && item.icon === "food"), "food draft");
assert(drafted.some((item) => item.dimension === "wave" && item.trend === "unknown"), "wave draft");
const sensor = { value: 24, baseline: 24.5, unit: "°C", label: "24°C" };
assert(resolveTrack({ sensor, inferred: drafted[0] ?? null, override: { phase: "present", dimension: "atmos", value: "22", description: "人工" } }).source === "override", "override wins");
assert(resolveTrack({ sensor, inferred: drafted[0] ?? null, override: null }).source === "sensor", "sensor beats draft");
assert(resolveTrack({ sensor: null, inferred: drafted[0] ?? null, override: null }).source === "inferred", "fuzzy track");

console.log("sentinel checks ok");
