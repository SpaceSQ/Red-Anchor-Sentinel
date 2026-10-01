import { sealDid } from "./did";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface LlmConfig {
  mode: "ollama" | "openai";
  baseUrl: string;
  model: string;
  hasKey: boolean;
}

export interface SentinelProfile {
  did: string;
  u6a: string;
  callsign: string;
  hostClass: "physical" | "virtual" | "container";
  limited: boolean;
  vaultDir: string;
  entropy: string;
  llm: LlmConfig;
  createdAt: string;
  email?: string;
  username?: string;
}

export interface AddressParts {
  country: string;
  city: string;
  building: string;
  floor: string;
  room: string;
  grid: string;
}

export function formatU6a(parts: AddressParts): string {
  return [parts.country, parts.city, parts.building, parts.floor, parts.room, parts.grid]
    .map((part) => part.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))
    .join("-");
}

export function didFromEntropy(entropyHex: string): string {
  let payload = "";
  for (let index = 0; index < 20; index += 1) {
    const byte = Number.parseInt(entropyHex.slice(index * 2, index * 2 + 2) || "00", 16);
    payload += ALPHABET[byte % 36];
  }
  return sealDid(payload);
}

export const PROFILE_KEY = "red-anchor-profile";
