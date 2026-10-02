"use client";

import { useEffect, useState } from "react";
import { useLabSkin } from "@/components/LabTheme";
import { labCall } from "@/lib/lab-client";

export function SentinelSeal() {
  const { profile } = useLabSkin();
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const node = document.getElementById("red-anchor-seal");
    if (!node) return;
    let tripped = false;
    const fallback = () => {
      if (tripped) return;
      tripped = true;
      setNotice("衍生体试图遮住水印，已回到红锚哨兵。");
      document.title = "红锚哨兵";
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
  }, []);

  return (
    <footer
      id="red-anchor-seal"
      style={{ display: "flex", opacity: 1, visibility: "visible", position: "fixed", zIndex: 80, background: "#020617", color: "#fecaca" }}
      className="inset-x-0 bottom-0 h-9 items-center justify-between border-t border-red-900 px-3 text-xs"
    >
      <span>{notice || profile?.customName || "红锚哨兵"}</span>
      <span style={{ color: "#ef4444" }}>Powered by Red Anchor Sentinel</span>
    </footer>
  );
}
