"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export function CloudNav() {
  const { t } = useI18n();
  return (
    <nav className="flex flex-wrap gap-2 pr-24 text-sm">
      <Link href="/" className="min-h-10 border border-slate-700 px-3 py-2">
        {t("nav.radar")}
      </Link>
      <Link href="/sos" className="min-h-10 border border-red-800 px-3 py-2 text-red-200">
        {t("nav.sos")}
      </Link>
      <Link href="/feedback" className="min-h-10 border border-slate-700 px-3 py-2">
        {t("nav.feedback")}
      </Link>
      <Link href="/lab" className="min-h-10 border border-slate-700 px-3 py-2">
        {t("nav.lab")}
      </Link>
    </nav>
  );
}
