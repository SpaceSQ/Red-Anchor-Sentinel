"use client";

import { useI18n } from "@/lib/i18n";

export function CommercialNote() {
  const { t } = useI18n();
  return (
    <footer className="text-xs leading-5 text-slate-500">
      <p>{t("commercial.free")}</p>
      <p>
        {t("commercial.mail")}<a className="text-slate-300" href="mailto:smarthomemiles@gmail.com">smarthomemiles@gmail.com</a>
      </p>
    </footer>
  );
}
