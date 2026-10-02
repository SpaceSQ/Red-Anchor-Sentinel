"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ActivationPage from "@/app/activation/page";
import SetupPage from "@/app/setup/page";
import { FleetPulse } from "@/components/FleetPulse";
import { useI18n } from "@/lib/i18n";
import { readActivation } from "@/lib/activation";
import { inDesktopShell, routeHref } from "@/lib/desktop-nav";
import { IdentityProvider } from "@/lib/identity-context";
import { readCachedProfile } from "@/lib/host-client";
import type { SentinelProfile } from "@/lib/profile";

const OPEN_PATHS = new Set(["/fleet-admin", "/sos", "/feedback", "/ras-landing"]);

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname || "/";
}

function isPublic(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path === "/activation" || path === "/fleet-admin" || path === "/ras-landing";
}

export function BootGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [profile, setProfile] = useState<SentinelProfile | null>(null);
  const [activated, setActivated] = useState(false);
  const path = normalizePath(pathname);

  useEffect(() => {
    setProfile(readCachedProfile());
    setActivated(Boolean(readActivation()));
    setDesktop(inDesktopShell());
    setReady(true);
  }, [pathname]);

  useEffect(() => {
    if (!inDesktopShell()) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || anchor.getAttribute("target") === "_blank") return;
      const href = anchor.getAttribute("href");
      if (!href || /^(https?:|mailto:|tel:|#)/.test(href)) return;
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(routeHref(href));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!ready || desktop) return;
    const open = OPEN_PATHS.has(path);
    if (!activated && !isPublic(path)) router.replace("/activation");
    else if (activated && !profile && path !== "/setup" && path !== "/activation" && !open) router.replace("/setup");
  }, [ready, desktop, activated, profile, path, router]);

  if (!ready) {
    return <p className="p-6 font-mono text-sm text-slate-400">{t("boot.checking")}</p>;
  }
  if (!activated && !isPublic(path)) {
    if (desktop) return <ActivationPage />;
    return <p className="p-6 font-mono text-sm text-slate-400">{t("boot.activation")}</p>;
  }
  if (!profile && path !== "/setup" && path !== "/activation" && !OPEN_PATHS.has(path)) {
    if (desktop) return <SetupPage />;
    return <p className="p-6 font-mono text-sm text-slate-400">{t("boot.setup")}</p>;
  }
  return (
    <IdentityProvider value={profile}>
      {profile?.did ? <FleetPulse did={profile.did} /> : null}
      {children}
    </IdentityProvider>
  );
}
