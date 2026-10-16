"use client";

import { MobileLink } from "@/components/MobileLink";
import { CloudNav } from "@/components/CloudNav";
import { useI18n } from "@/lib/i18n";

export default function PhoneLinkPage() {
  const { t } = useI18n();
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-4 md:p-8">
      <header className="panel px-4 py-4">
        <p className="font-display text-xs tracking-[0.22em] text-red-300">PHONE</p>
        <h1 className="font-display text-3xl tracking-[0.12em]">{t("link.title")}</h1>
      </header>
      <CloudNav />
      <MobileLink />
    </main>
  );
}
