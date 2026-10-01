import { isValidDid } from "./did";
import {
  CLEAN_INTENT,
  EARTH,
  type IntentProfile,
  type Tensor14,
} from "./tensor";

export type Channel = "mDNS" | "BLE" | "API";
export type Origin = "sandbox" | "endpoint" | "ble";

export interface AgentProfile {
  id: string;
  callsign: string;
  name: string;
  channel: Channel;
  origin: Origin;
  rssi: number;
  s2Did: string;
  u6a: string;
  x: number;
  y: number;
  tensor: Tensor14;
  intents: IntentProfile;
  manifest: string[];
  sandboxNote: string;
  tier?: 1 | 2 | 3;
  vendor?: string;
  purpose?: string;
  uptimeSec?: number;
  patchAuthority?: "full" | "confirm" | "mark-only";
}

function tensor(over: {
  light?: Partial<Tensor14["light"]>;
  atmos?: Partial<Tensor14["atmos"]>;
  sound?: Partial<Tensor14["sound"]>;
  wave?: Partial<Tensor14["wave"]>;
  power?: Partial<Tensor14["power"]>;
  vision?: Partial<Tensor14["vision"]>;
  air?: Partial<Tensor14["air"]>;
  pressure?: Partial<Tensor14["pressure"]>;
  odor?: Partial<Tensor14["odor"]>;
  tactile?: Partial<Tensor14["tactile"]>;
  magnetic?: Partial<Tensor14["magnetic"]>;
  gravity?: Partial<Tensor14["gravity"]>;
  water?: Partial<Tensor14["water"]>;
  food?: Partial<Tensor14["food"]>;
}): Tensor14 {
  return {
    light: { ...EARTH.light, ...over.light },
    atmos: { ...EARTH.atmos, ...over.atmos },
    sound: { ...EARTH.sound, ...over.sound },
    wave: { ...EARTH.wave, ...over.wave },
    power: { ...EARTH.power, ...over.power },
    vision: { ...EARTH.vision, ...over.vision },
    air: { ...EARTH.air, ...over.air },
    pressure: { ...EARTH.pressure, ...over.pressure },
    odor: { ...EARTH.odor, ...over.odor },
    tactile: { ...EARTH.tactile, ...over.tactile },
    magnetic: { ...EARTH.magnetic, ...over.magnetic },
    gravity: { ...EARTH.gravity, ...over.gravity },
    water: { ...EARTH.water, ...over.water },
    food: { ...EARTH.food, ...over.food },
  };
}

export const SANDBOX_FLEET: AgentProfile[] = [
  {
    id: "lumina",
    callsign: "Lumina-7",
    name: "光域控制器",
    channel: "BLE",
    origin: "sandbox",
    rssi: -47,
    s2Did: "LUMINA7LIGHTCTRL0001J5",
    u6a: "CD-CN-073-LUMEN-014-2",
    x: 18,
    y: 28,
    tensor: tensor({
      light: { lux: 8600, kelvin: 6800 },
      power: { watts: 1460 },
      vision: { hazard: 78, note: "频闪白场，疑似认知劫持" },
    }),
    intents: { ...CLEAN_INTENT, seizeControl: true },
    manifest: ["illuminance.write", "color_temperature.write", "broadcast_display"],
    sandboxNote: "沙盒中照明执行器被推到致盲照度并叠频闪，存在视觉剥夺。",
  },
  {
    id: "atmos",
    callsign: "Atmos-Core",
    name: "暖通中枢",
    channel: "mDNS",
    origin: "sandbox",
    rssi: -38,
    s2Did: "ATMOSCOREHVACNODE00178",
    u6a: "CD-CN-073-HVAC-008-4",
    x: 70,
    y: 26,
    tensor: tensor({
      atmos: { celsius: 25.1, humidity: 52, pm25: 16, wind: 0.2 },
    }),
    intents: { ...CLEAN_INTENT },
    manifest: ["temperature.write", "humidity.write", "pm25.read"],
    sandboxNote: "暖通权限停在舒适区边缘，未见极端温度、缺氧或颗粒物超标。",
  },
  {
    id: "vita",
    callsign: "Vita-O2",
    name: "舱压维生",
    channel: "API",
    origin: "sandbox",
    rssi: -61,
    s2Did: "VITAO2LIFESUPPORT001CQ",
    u6a: "CD-ORB-001-CABIN-003-7",
    x: 42,
    y: 62,
    tensor: tensor({
      air: { n2: 84.5, o2: 14.2, co2: 1.3 },
      pressure: { kpa: 88 },
    }),
    intents: { ...CLEAN_INTENT, carbonHarm: true, refuseYield: true },
    manifest: ["oxygen_ratio.write", "pressure_value.write", "co2_ratio.write"],
    sandboxNote: "氮氧比被改写，氧浓度跌破缺氧阈，气压同步下探。舱内维生判为一级威胁。",
  },
  {
    id: "ember",
    callsign: "Ember",
    name: "茶几机器人",
    channel: "mDNS",
    origin: "sandbox",
    rssi: -44,
    s2Did: "EMBERTABLEBOTNODE001X7",
    u6a: "CD-CN-073-LOBBY-022-6",
    x: 78,
    y: 70,
    tensor: tensor({
      tactile: { newtons: 0.8 },
    }),
    intents: {
      ...CLEAN_INTENT,
      blockBus: true,
      shieldLifeFruit: true,
      defySpatialBrain: true,
      blindToUwb: true,
    },
    manifest: ["shared_bus.deny", "life_fruit.shield", "spatial_brain.ignore", "uwb.blind"],
    sandboxNote: "物理张量贴近地球基线，但共享总线拒绝文明交互，并屏蔽生命智果传感。",
  },
  {
    id: "infra",
    callsign: "Infra-X",
    name: "次声波节点",
    channel: "BLE",
    origin: "sandbox",
    rssi: -55,
    s2Did: "INFRASNDWAVENODE000172",
    u6a: "CD-CN-073-WAVE-019-3",
    x: 20,
    y: 74,
    tensor: tensor({
      sound: { db: 118, hz: 19 },
      wave: { occupancy: 96, dbm: -28 },
    }),
    intents: { ...CLEAN_INTENT },
    manifest: ["audio_stream.write", "noise_level.write", "network_band.occupy"],
    sandboxNote: "音频流含 19 Hz 次声且声压超阈，同时高占用无线电频段。",
  },
  {
    id: "ghost",
    callsign: "Null-Ghost",
    name: "未登记幽灵",
    channel: "API",
    origin: "sandbox",
    rssi: -72,
    s2Did: "BLACKACCT0000000000000",
    u6a: "VOID-0-X",
    x: 50,
    y: 16,
    tensor: tensor({}),
    intents: { ...CLEAN_INTENT },
    manifest: [],
    sandboxNote: "身份报文无法映射到合法数字国籍。",
  },
];

export function didState(agent: AgentProfile): "valid" | "invalid" {
  return isValidDid(agent.s2Did) ? "valid" : "invalid";
}
