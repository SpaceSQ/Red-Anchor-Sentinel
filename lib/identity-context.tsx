"use client";

import { createContext, useContext } from "react";
import { SENTINEL } from "./did";
import type { SentinelProfile } from "./profile";

const IdentityContext = createContext<SentinelProfile | null>(null);

export function IdentityProvider({
  value,
  children,
}: {
  value: SentinelProfile | null;
  children: React.ReactNode;
}) {
  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function useSentinelIdentity(): SentinelProfile {
  const profile = useContext(IdentityContext);
  if (profile) return profile;
  return {
    did: SENTINEL.did,
    u6a: SENTINEL.u6a,
    callsign: SENTINEL.callsign,
    hostClass: "virtual",
    limited: true,
    vaultDir: "",
    entropy: "",
    llm: { mode: "ollama", baseUrl: "http://127.0.0.1:11434", model: "llama3.1", hasKey: false },
    createdAt: "",
  };
}
