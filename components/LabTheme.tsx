"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { labCall } from "@/lib/lab-client";
import { useI18n } from "@/lib/i18n";
import type { LabProfile, LabRules } from "@/lib/lab-rules";

const LabContext = createContext<{ profile: LabProfile | null; rules: LabRules | null }>({ profile: null, rules: null });

export function useLabSkin() {
  return useContext(LabContext);
}

export function LabTheme({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [profile, setProfile] = useState<LabProfile | null>(null);

  useEffect(() => {
    let stop = false;
    labCall<{ profile?: LabProfile | null }>("active")
      .then((data) => {
        if (!stop) setProfile(data.profile || null);
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    if (!profile) {
      document.title = t("app.title");
      delete document.body.dataset.lab;
      document.body.style.removeProperty("--lab-accent");
      return;
    }
    document.title = profile.customName;
    document.body.dataset.lab = "on";
    document.body.style.setProperty("--lab-accent", profile.brandColor);
  }, [profile, t]);

  return <LabContext.Provider value={{ profile, rules: profile?.rulesConfig || null }}>{children}</LabContext.Provider>;
}
