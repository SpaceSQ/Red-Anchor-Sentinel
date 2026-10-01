"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { LabProfile, LabRules } from "@/lib/lab-rules";

const LabContext = createContext<{ profile: LabProfile | null; rules: LabRules | null }>({ profile: null, rules: null });

export function useLabSkin() {
  return useContext(LabContext);
}

export function LabTheme({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<LabProfile | null>(null);

  useEffect(() => {
    let stop = false;
    fetch("/api/lab?view=active")
      .then((response) => response.json())
      .then((data: { profile?: LabProfile | null }) => {
        if (!stop) setProfile(data.profile || null);
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    if (!profile) {
      document.title = "红锚哨兵";
      delete document.body.dataset.lab;
      document.body.style.removeProperty("--lab-accent");
      return;
    }
    document.title = profile.customName;
    document.body.dataset.lab = "on";
    document.body.style.setProperty("--lab-accent", profile.brandColor);
  }, [profile]);

  return <LabContext.Provider value={{ profile, rules: profile?.rulesConfig || null }}>{children}</LabContext.Provider>;
}
