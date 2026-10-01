"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FleetPulse } from "@/components/FleetPulse";
import { useI18n } from "@/lib/i18n";
import { readActivation } from "@/lib/activation";
import { IdentityProvider } from "@/lib/identity-context";
import { readCachedProfile } from "@/lib/host-client";
import type { SentinelProfile } from "@/lib/profile";

const OPEN_PATHS = new Set(["/fleet-admin", "/sos", "/feedback", "/ras-landing"]);

function isPublic(pathname: string): boolean {
  return pathname === "/activation" || pathname === "/fleet-admin" || pathname === "/ras-landing";
}

export function BootGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<SentinelProfile | null>(null);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    setProfile(readCachedProfile());
    setActivated(Boolean(readActivation()));
    setReady(true);
  }, [pathname]);

  useEffect(() => {
    if (!ready) return;
    const open = OPEN_PATHS.has(pathname);
    if (!activated && !isPublic(pathname)) router.replace("/activation");
    else if (activated && !profile && pathname !== "/setup" && pathname !== "/activation" && !open) router.replace("/setup");
  }, [ready, activated, profile, pathname, router]);

  if (!ready) {
    return <p className="p-6 font-mono text-sm text-slate-400">{t("boot.checking")}</p>;
  }
  if (!activated && !isPublic(pathname)) {
    return <p className="p-6 font-mono text-sm text-slate-400">{t("boot.activation")}</p>;
  }
  if (!profile && pathname !== "/setup" && pathname !== "/activation" && !OPEN_PATHS.has(pathname)) {
    return <p className="p-6 font-mono text-sm text-slate-400">{t("boot.setup")}</p>;
  }
  return (
    <IdentityProvider value={profile}>
      {profile?.did ? <FleetPulse did={profile.did} /> : null}
      {children}
    </IdentityProvider>
  );
}
