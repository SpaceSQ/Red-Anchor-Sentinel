"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";

export function KnifeSwitch({
  coverOpen,
  lever,
  mode,
  canOpen,
  busy,
  busyLabel = "请稍候",
  onToggleCover,
  onLever,
}: {
  coverOpen: boolean;
  lever: number;
  mode: "inject" | "rollback" | "locked";
  canOpen: boolean;
  busy: boolean;
  busyLabel?: string;
  onToggleCover: () => void;
  onLever: (value: number, crossed: boolean) => void;
}) {
  const { t } = useI18n();
  const angle = -38 + lever * 76;
  const caption =
    mode === "inject"
      ? t("knife.inject")
      : mode === "rollback"
        ? t("knife.rollback")
        : t("knife.locked");

  return (
    <div className="border border-slate-700 bg-gradient-to-b from-slate-800 to-slate-950 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-display text-[11px] tracking-[0.18em] text-slate-300">SOUL INJECT</p>
        <span
          className={`h-2.5 w-2.5 rounded-full ${coverOpen ? "bg-anchor shadow-lamp" : "bg-slate-600"}`}
          aria-hidden
        />
      </div>
      <div className="relative mb-3 h-24 overflow-hidden border border-slate-700 bg-slate-950" style={{ perspective: 600 }}>
        <div className="absolute left-1/2 top-10 h-16 w-1 -translate-x-1/2 bg-slate-600" />
        <div
          className="absolute left-1/2 top-10 h-2 w-24 origin-left"
          style={{ transform: `rotate(${angle}deg)`, background: "linear-gradient(90deg,#fecaca,#ef4444)" }}
        />
        <motion.button
          type="button"
          aria-pressed={coverOpen}
          disabled={!canOpen || busy}
          onClick={onToggleCover}
          className="absolute inset-x-3 top-2 h-16 origin-top border border-amber-700/80 bg-amber-900/50 text-xs text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          animate={{ rotateX: coverOpen ? -72 : 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 18 }}
        >
          {coverOpen ? t("knife.coverOpen") : t("knife.coverClosed")}
        </motion.button>
      </div>
      <label className="block font-mono text-[10px] text-slate-400" htmlFor="knife-travel">
        {t("knife.travel", { percent: Math.round(lever * 100) })}
      </label>
      <input
        id="knife-travel"
        className="knife mt-2"
        type="range"
        min={0}
        max={100}
        value={Math.round(lever * 100)}
        disabled={mode === "locked" || busy}
        aria-label={t("knife.aria")}
        onChange={(event) => {
          const value = Number(event.target.value) / 100;
          const crossed = mode === "inject" ? value >= 0.82 : mode === "rollback" ? value <= 0.18 : false;
          onLever(value, crossed);
        }}
      />
      <p className="mt-2 text-xs text-slate-400">{busy ? busyLabel : caption}</p>
    </div>
  );
}
