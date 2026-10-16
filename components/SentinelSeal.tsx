"use client";

import { useEffect, useState } from "react";
import { CopyrightNote } from "@/components/CopyrightNote";
import { useLabSkin } from "@/components/LabTheme";
import { labCall } from "@/lib/lab-client";
import { useI18n } from "@/lib/i18n";

export function SentinelSeal() {
  const { profile } = useLabSkin();
  const { t } = useI18n();
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const node = document.getElementById("red-anchor-seal");
    if (!node) return;
    let tripped = false;
    const fallback = () => {
      if (tripped) return;
      tripped = true;
      setNotice(t("seal.blocked"));
      document.title = t("app.title");
      delete document.body.dataset.lab;
      document.body.style.removeProperty("--lab-accent");
      void labCall("clear").catch(() => undefined);
    };
    const check = () => {
      if (!document.body.contains(node)) {
        fallback();
        return;
      }
      const style = window.getComputedStyle(node);
      const hidden = style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.2;
      if (!hidden) return;
      node.style.setProperty("display", "flex", "important");
      node.style.setProperty("visibility", "visible", "important");
      node.style.setProperty("opacity", "1", "important");
      fallback();
    };
    const observer = new MutationObserver(check);
    observer.observe(node, { attributes: true });
    const timer = window.setInterval(check, 1500);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [t]);

  return (
    <footer
      id="red-anchor-seal"
      style={{ display: "flex", opacity: 1, visibility: "visible", position: "fixed", zIndex: 80, background: "#020617", color: "#fecaca" }}
      className="inset-x-0 bottom-0 flex-col justify-center gap-1 border-t border-red-900 px-3 py-2 text-xs"
    >
      <div className="flex w-full items-center justify-between gap-3">
        <span>{notice || profile?.customName || t("app.name")} · {t("app.role")}</span>
        <span style={{ color: "#ef4444" }}>Powered by Red Anchor Sentinel</span>
      </div>
      <div className="flex w-full flex-wrap items-center justify-between gap-2 text-slate-400">
        <span>{t("geo.note")}</span>
        <CopyrightNote />
      </div>
    </footer>
  );
}
