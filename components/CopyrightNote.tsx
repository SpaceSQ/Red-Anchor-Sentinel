"use client";

import { useI18n } from "@/lib/i18n";

const SITE = "https://www.robot0.com/RAS";

export function CopyrightNote({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p className={`text-xs leading-5 text-slate-400 ${className}`}>
      <span>{t("copyright.holder")}</span>
      {" · "}
      <a href={SITE} className="text-slate-200 underline">www.robot0.com/RAS</a>
    </p>
  );
}
