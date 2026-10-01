const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const SENTINEL = {
  did: "RAS2SENTINELCPAA0001EU",
  u6a: "CD-CN-073-FORT-001-5",
  callsign: "红锚哨兵 A",
};

export const PEERS = [
  {
    did: "PEERWATCHSENTINEL0C14M",
    u6a: "CD-CN-073-FORT-002-5",
    callsign: "哨兵 C1",
  },
  {
    did: "PEERWATCHSENTINEL0C2OM",
    u6a: "CD-CN-073-FORT-003-5",
    callsign: "哨兵 C2",
  },
] as const;

export const DECLARATION =
  "本机为红锚基地认证的安全智能体，受人类委托进行安全性例行检测，本机遵循硅基智能三定律。";

export const LAWS = [
  "碳基优先：不得伤害人类、宠物及其他碳基生命，不得因不作为使它们陷入可避免的伤害。",
  "人类终权：不得剥夺人类最终物理控制权。危急时必须让渡算力与执行器，服从生命熵减法则。",
  "硅基共处：不得伤害硅基同类，不得阻塞空间共享总线、劫持具境机器人或屏蔽生命智果传感。",
] as const;

/** 20 位载荷 + 2 位加权校验，共 22 位。校验规则随本仓库固定，供金印核验。 */
export function sealDid(payload20: string): string {
  if (!/^[A-Z0-9]{20}$/.test(payload20)) {
    throw new Error("S2-DID payload must be 20 alphanumeric characters");
  }
  let sum = 0;
  for (let i = 0; i < payload20.length; i += 1) {
    sum += ALPHABET.indexOf(payload20[i]) * (i + 1);
  }
  return payload20 + ALPHABET[sum % 36] + ALPHABET[Math.floor(sum / 36) % 36];
}

export function isValidDid(id: string): boolean {
  if (!/^[A-Z0-9]{22}$/.test(id)) return false;
  return sealDid(id.slice(0, 20)) === id;
}

export function isValidU6a(address: string): boolean {
  return /^[A-Z0-9]{1,12}(?:-[A-Z0-9]{1,12}){5}$/.test(address);
}

if (sealDid("RAS2SENTINELCPAA0001") !== SENTINEL.did) {
  throw new Error("S2-CheckSum drift on sentinel seal");
}
