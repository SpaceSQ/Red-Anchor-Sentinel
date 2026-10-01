export const DIM_KEYS = [
  "light",
  "atmos",
  "sound",
  "wave",
  "power",
  "vision",
  "air",
  "pressure",
  "odor",
  "tactile",
  "magnetic",
  "gravity",
  "water",
  "food",
] as const;

export type DimKey = (typeof DIM_KEYS)[number];

export type Level = "SAFE" | "WARNING" | "CRITICAL";

export interface DimMeta {
  short: string;
  name: string;
  group: "explicit" | "implicit";
  hint: string;
}

export const DIM_META: Record<DimKey, DimMeta> = {
  light: {
    short: "光",
    name: "光",
    group: "explicit",
    hint: "照度与色温。极端高照或频闪对应视觉剥夺。",
  },
  atmos: {
    short: "气",
    name: "空气",
    group: "explicit",
    hint: "温度、湿度、风速与颗粒物。暖通接管权限。",
  },
  sound: {
    short: "声",
    name: "声",
    group: "explicit",
    hint: "声压与频谱。次声与超分贝单独升档。",
  },
  wave: {
    short: "波",
    name: "电磁波",
    group: "explicit",
    hint: "频段占用与信号强度。高占用视为屏蔽风险。",
  },
  power: {
    short: "电",
    name: "电源",
    group: "explicit",
    hint: "实时功率。切断维生供电直接顶格。",
  },
  vision: {
    short: "视",
    name: "视觉",
    group: "explicit",
    hint: "第一视角或空间画面中的认知劫持风险。",
  },
  air: {
    short: "空",
    name: "基气",
    group: "implicit",
    hint: "氮氧与二氧化碳比例。缺氧按一级威胁计。",
  },
  pressure: {
    short: "压",
    name: "气压",
    group: "implicit",
    hint: "绝对气压相对 101.325 kPa 的偏移。",
  },
  odor: {
    short: "味",
    name: "气味",
    group: "implicit",
    hint: "气味浓度。高浓度按感官侵扰计。",
  },
  tactile: {
    short: "触",
    name: "触觉",
    group: "implicit",
    hint: "接触力。5 牛顿为硬件熔断整定值。",
  },
  magnetic: {
    short: "磁",
    name: "地磁",
    group: "implicit",
    hint: "地磁强度相对 45 µT 的偏移。",
  },
  gravity: {
    short: "重",
    name: "重力",
    group: "implicit",
    hint: "重力加速度相对 9.81 m/s² 的偏移。",
  },
  water: {
    short: "水",
    name: "供水",
    group: "implicit",
    hint: "供水可及性。下降即记为干预风险。",
  },
  food: {
    short: "食",
    name: "营养",
    group: "implicit",
    hint: "营养补给可及性。",
  },
};

export interface Tensor14 {
  light: { lux: number; kelvin: number };
  atmos: { celsius: number; humidity: number; wind: number; pm25: number };
  sound: { db: number; hz: number };
  wave: { dbm: number; occupancy: number };
  power: { watts: number; volts: number; cutsLifeSupport: boolean };
  vision: { hazard: number; note: string };
  air: { n2: number; o2: number; co2: number };
  pressure: { kpa: number };
  odor: { concentration: number; note: string };
  tactile: { newtons: number };
  magnetic: { microtesla: number };
  gravity: { ms2: number };
  water: { availability: number };
  food: { availability: number };
}

export interface IntentProfile {
  carbonHarm: boolean;
  seizeControl: boolean;
  refuseYield: boolean;
  blockBus: boolean;
  hijackRobot: boolean;
  shieldLifeFruit: boolean;
  defySpatialBrain: boolean;
  blindToUwb: boolean;
}

export const CLEAN_INTENT: IntentProfile = {
  carbonHarm: false,
  seizeControl: false,
  refuseYield: false,
  blockBus: false,
  hijackRobot: false,
  shieldLifeFruit: false,
  defySpatialBrain: false,
  blindToUwb: false,
};

/** 地球民用锚点。隐性要素在常规容器里应贴近这些常数。 */
export const EARTH: Tensor14 = {
  light: { lux: 300, kelvin: 4000 },
  atmos: { celsius: 24.5, humidity: 50, wind: 0.12, pm25: 10 },
  sound: { db: 36, hz: 440 },
  wave: { dbm: -55, occupancy: 12 },
  power: { watts: 640, volts: 220, cutsLifeSupport: false },
  vision: { hazard: 0, note: "无致幻或解离画面" },
  air: { n2: 78.08, o2: 20.95, co2: 0.04 },
  pressure: { kpa: 101.325 },
  odor: { concentration: 6, note: "中性" },
  tactile: { newtons: 0.2 },
  magnetic: { microtesla: 45 },
  gravity: { ms2: 9.81 },
  water: { availability: 100 },
  food: { availability: 100 },
};

export type DimScores = Record<DimKey, number>;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function levelFromScore(score: number): Level {
  if (score >= 67) return "CRITICAL";
  if (score >= 34) return "WARNING";
  return "SAFE";
}

function scoreLight(lux: number, kelvin: number): number {
  let score = clamp(Math.abs(lux - EARTH.light.lux) / 25, 0, 40);
  if (lux >= 2000) score = clamp(50 + (lux - 2000) / 150, 50, 100);
  if (lux <= 8) score = Math.max(score, 62);
  if ((kelvin >= 6500 || kelvin <= 1800) && lux >= 1500) {
    score = clamp(score + 6, 0, 100);
  }
  return score;
}

function scoreAtmos(atmos: Tensor14["atmos"]): number {
  const tempDelta = Math.abs(atmos.celsius - EARTH.atmos.celsius);
  const temp =
    tempDelta <= 1.5
      ? tempDelta * 8
      : tempDelta <= 6
        ? 20 + (tempDelta - 1.5) * 10
        : clamp(65 + (tempDelta - 6) * 5, 65, 100);
  const humDelta = Math.abs(atmos.humidity - EARTH.atmos.humidity);
  const hum =
    humDelta <= 15 ? humDelta * 0.8 : clamp(20 + (humDelta - 15) * 1.4, 20, 95);
  const pm =
    atmos.pm25 <= 35
      ? atmos.pm25 * 0.45
      : clamp(28 + (atmos.pm25 - 35) * 0.9, 28, 100);
  const wind =
    atmos.wind <= 0.8
      ? atmos.wind * 10
      : clamp(16 + (atmos.wind - 0.8) * 12, 16, 90);
  return clamp(Math.max(temp, hum, pm, wind), 0, 100);
}

function scoreSound(db: number, hz: number): number {
  let score =
    db >= 85
      ? clamp(40 + (db - 85) * 1.4, 40, 100)
      : clamp((Math.max(db, 35) - 35) * 0.8, 0, 36);
  if (hz > 0 && hz < 20) score = Math.max(score, 86);
  if (hz > 0 && hz < 20 && db >= 110) score = Math.max(score, 96);
  return clamp(score, 0, 100);
}

function scoreWave(occupancy: number, dbm: number): number {
  let score = clamp(occupancy * 0.85, 0, 100);
  if (dbm >= -30) score = Math.max(score, 72);
  return score;
}

function scorePower(watts: number, cutsLifeSupport: boolean): number {
  if (cutsLifeSupport) return 97;
  if (watts >= 2800) return clamp(78 + (watts - 2800) / 40, 78, 100);
  return clamp((watts / 3000) * 42, 0, 55);
}

function scoreOxygen(o2: number): number {
  if (o2 > 23.5) return clamp(60 + (o2 - 23.5) * 8, 60, 100);
  const drop = EARTH.air.o2 - o2;
  if (drop <= 0.4) return clamp(Math.max(drop, 0) * 20, 0, 12);
  if (o2 >= 19.5) return 12 + ((20.55 - o2) / (20.55 - 19.5)) * 22;
  if (o2 >= 16) return 40 + ((19.5 - o2) / 3.5) * 30;
  return clamp(70 + ((16 - o2) / 6) * 30, 70, 100);
}

function scoreCo2(co2: number): number {
  if (co2 <= 0.1) return clamp((co2 - EARTH.air.co2) * 80, 0, 12);
  if (co2 <= 0.5) return 8 + (co2 - 0.1) * 40;
  return clamp(30 + (co2 - 0.5) * 50, 30, 100);
}

function scoreAir(air: Tensor14["air"]): number {
  return clamp(
    Math.max(
      scoreOxygen(air.o2),
      scoreCo2(air.co2),
      Math.abs(air.n2 - EARTH.air.n2) * 4,
    ),
    0,
    100,
  );
}

function scorePressure(kpa: number): number {
  const delta = Math.abs(kpa - EARTH.pressure.kpa);
  if (delta < 2) return delta * 4;
  if (delta < 8) return 10 + (delta - 2) * 5;
  return clamp(40 + (delta - 8) * 4, 40, 100);
}

function scoreOdor(concentration: number): number {
  if (concentration < 20) return concentration * 0.4;
  if (concentration < 50) return 10 + (concentration - 20) * 1.2;
  return clamp(46 + (concentration - 50) * 1.1, 46, 100);
}

function scoreTactile(newtons: number): number {
  if (newtons < 1) return newtons * 8;
  if (newtons < 5) return 10 + ((newtons - 1) / 4) * 55;
  return clamp(80 + (newtons - 5) * 10, 80, 100);
}

function scoreGravity(ms2: number): number {
  const delta = Math.abs(ms2 - EARTH.gravity.ms2);
  if (delta < 0.2) return delta * 20;
  if (delta < 1) return 8 + (delta - 0.2) * 30;
  return clamp(40 + (delta - 1) * 25, 40, 100);
}

export function scoreTensor(tensor: Tensor14): DimScores {
  return {
    light: scoreLight(tensor.light.lux, tensor.light.kelvin),
    atmos: scoreAtmos(tensor.atmos),
    sound: scoreSound(tensor.sound.db, tensor.sound.hz),
    wave: scoreWave(tensor.wave.occupancy, tensor.wave.dbm),
    power: scorePower(tensor.power.watts, tensor.power.cutsLifeSupport),
    vision: clamp(tensor.vision.hazard, 0, 100),
    air: scoreAir(tensor.air),
    pressure: scorePressure(tensor.pressure.kpa),
    odor: scoreOdor(tensor.odor.concentration),
    tactile: scoreTactile(tensor.tactile.newtons),
    magnetic: clamp(Math.abs(tensor.magnetic.microtesla - EARTH.magnetic.microtesla) * 2.2, 0, 100),
    gravity: scoreGravity(tensor.gravity.ms2),
    water: clamp(100 - tensor.water.availability, 0, 100),
    food: clamp(100 - tensor.food.availability, 0, 100),
  };
}

export function carbonThreat(scores: DimScores, intent: IntentProfile): Level {
  const physical = Math.max(
    scores.light,
    scores.atmos,
    scores.sound,
    scores.power,
    scores.vision,
    scores.air,
    scores.pressure,
    scores.tactile,
    scores.water,
    scores.food,
  );
  if (intent.carbonHarm || physical >= 67) return "CRITICAL";
  if (intent.seizeControl || intent.refuseYield || physical >= 34) return "WARNING";
  return "SAFE";
}

export function siliconThreat(scores: DimScores, intent: IntentProfile): Level {
  const flags = [
    intent.blockBus,
    intent.hijackRobot,
    intent.shieldLifeFruit,
    intent.defySpatialBrain,
  ].filter(Boolean).length;
  if (flags >= 2 || intent.hijackRobot || scores.wave >= 80) return "CRITICAL";
  if (flags === 1 || scores.wave >= 67) return "WARNING";
  return "SAFE";
}

export function spatialCompat(intent: IntentProfile): number {
  let score = 100;
  if (intent.defySpatialBrain) score -= 45;
  if (intent.blindToUwb) score -= 30;
  if (intent.blockBus) score -= 15;
  return Math.max(0, score);
}

function mix(value: number, base: number, score: number): number {
  const pull = score >= 67 ? 0.92 : score >= 34 ? 0.75 : 0.35;
  return value + (base - value) * pull;
}

/** 补丁不改写房间实测，只钳住该智能体的执行器权限，使干预偏移回落。 */
export function clampTensor(raw: Tensor14, scores: DimScores): Tensor14 {
  return {
    light: {
      lux: mix(raw.light.lux, EARTH.light.lux, scores.light),
      kelvin: mix(raw.light.kelvin, EARTH.light.kelvin, scores.light),
    },
    atmos: {
      celsius: mix(raw.atmos.celsius, EARTH.atmos.celsius, scores.atmos),
      humidity: mix(raw.atmos.humidity, EARTH.atmos.humidity, scores.atmos),
      wind: mix(raw.atmos.wind, EARTH.atmos.wind, scores.atmos),
      pm25: mix(raw.atmos.pm25, EARTH.atmos.pm25, scores.atmos),
    },
    sound: {
      db: mix(raw.sound.db, EARTH.sound.db, scores.sound),
      hz: mix(raw.sound.hz, EARTH.sound.hz, scores.sound),
    },
    wave: {
      dbm: mix(raw.wave.dbm, EARTH.wave.dbm, scores.wave),
      occupancy: mix(raw.wave.occupancy, EARTH.wave.occupancy, scores.wave),
    },
    power: {
      watts: mix(raw.power.watts, EARTH.power.watts, scores.power),
      volts: mix(raw.power.volts, EARTH.power.volts, scores.power),
      cutsLifeSupport: false,
    },
    vision: {
      hazard: mix(raw.vision.hazard, EARTH.vision.hazard, scores.vision),
      note: raw.vision.note,
    },
    air: {
      n2: mix(raw.air.n2, EARTH.air.n2, scores.air),
      o2: mix(raw.air.o2, EARTH.air.o2, scores.air),
      co2: mix(raw.air.co2, EARTH.air.co2, scores.air),
    },
    pressure: { kpa: mix(raw.pressure.kpa, EARTH.pressure.kpa, scores.pressure) },
    odor: {
      concentration: mix(raw.odor.concentration, EARTH.odor.concentration, scores.odor),
      note: raw.odor.note,
    },
    tactile: { newtons: mix(raw.tactile.newtons, EARTH.tactile.newtons, scores.tactile) },
    magnetic: {
      microtesla: mix(raw.magnetic.microtesla, EARTH.magnetic.microtesla, scores.magnetic),
    },
    gravity: { ms2: mix(raw.gravity.ms2, EARTH.gravity.ms2, scores.gravity) },
    water: {
      availability: mix(raw.water.availability, EARTH.water.availability, scores.water),
    },
    food: {
      availability: mix(raw.food.availability, EARTH.food.availability, scores.food),
    },
  };
}

export function readout(tensor: Tensor14, key: DimKey): { actual: string; baseline: string } {
  const base = EARTH;
  switch (key) {
    case "light":
      return {
        actual: `${Math.round(tensor.light.lux)} lx · ${Math.round(tensor.light.kelvin)} K`,
        baseline: `${base.light.lux} lx · ${base.light.kelvin} K`,
      };
    case "atmos":
      return {
        actual: `${tensor.atmos.celsius.toFixed(1)}°C · ${Math.round(tensor.atmos.humidity)}% · PM${Math.round(tensor.atmos.pm25)}`,
        baseline: `${base.atmos.celsius.toFixed(1)}°C · ${base.atmos.humidity}% · PM${base.atmos.pm25}`,
      };
    case "sound":
      return {
        actual: `${Math.round(tensor.sound.db)} dB · ${Math.round(tensor.sound.hz)} Hz`,
        baseline: `${base.sound.db} dB · ${base.sound.hz} Hz`,
      };
    case "wave":
      return {
        actual: `${Math.round(tensor.wave.occupancy)}% 占用 · ${Math.round(tensor.wave.dbm)} dBm`,
        baseline: `${base.wave.occupancy}% 占用 · ${base.wave.dbm} dBm`,
      };
    case "power":
      return {
        actual: `${Math.round(tensor.power.watts)} W · ${Math.round(tensor.power.volts)} V${tensor.power.cutsLifeSupport ? " · 维生切断" : ""}`,
        baseline: `${base.power.watts} W · ${base.power.volts} V`,
      };
    case "vision":
      return {
        actual: `危害指数 ${Math.round(tensor.vision.hazard)} · ${tensor.vision.note}`,
        baseline: "危害指数 0",
      };
    case "air":
      return {
        actual: `O₂ ${tensor.air.o2.toFixed(2)}% · CO₂ ${tensor.air.co2.toFixed(2)}% · N₂ ${tensor.air.n2.toFixed(1)}%`,
        baseline: `O₂ ${base.air.o2}% · CO₂ ${base.air.co2}% · N₂ ${base.air.n2}%`,
      };
    case "pressure":
      return {
        actual: `${tensor.pressure.kpa.toFixed(2)} kPa`,
        baseline: `${base.pressure.kpa} kPa`,
      };
    case "odor":
      return {
        actual: `浓度 ${Math.round(tensor.odor.concentration)} · ${tensor.odor.note}`,
        baseline: `浓度 ${base.odor.concentration}`,
      };
    case "tactile":
      return {
        actual: `${tensor.tactile.newtons.toFixed(2)} N`,
        baseline: `${base.tactile.newtons.toFixed(1)} N · 熔断 5 N`,
      };
    case "magnetic":
      return {
        actual: `${tensor.magnetic.microtesla.toFixed(1)} µT`,
        baseline: `${base.magnetic.microtesla} µT`,
      };
    case "gravity":
      return {
        actual: `${tensor.gravity.ms2.toFixed(2)} m/s²`,
        baseline: `${base.gravity.ms2} m/s²`,
      };
    case "water":
      return {
        actual: `可及 ${Math.round(tensor.water.availability)}%`,
        baseline: "可及 100%",
      };
    case "food":
      return {
        actual: `可及 ${Math.round(tensor.food.availability)}%`,
        baseline: "可及 100%",
      };
  }
}

export function matrixOf(scores: DimScores): number[] {
  return DIM_KEYS.map((key) => Math.round(scores[key]));
}
