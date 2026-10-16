"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

const KEY = "red-anchor-experience-sandbox";
const TOYS = [
  { id: "husky", name: "sandbox.husky", kind: "sandbox.huskyKind", note: "sandbox.sound", unit: "dB", wave: (tick: number) => 36 + Math.sin(tick / 700) * 8 },
  { id: "nest", name: "sandbox.nest", kind: "sandbox.nestKind", note: "sandbox.heat", unit: "°C", wave: () => 24 },
  { id: "hue", name: "sandbox.hue", kind: "sandbox.hueKind", note: "sandbox.light", unit: "lx", wave: () => 500 },
] as const;

function readRemoved(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function ExperienceSandbox() {
  const { t } = useI18n();
  const [removed, setRemoved] = useState<string[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setRemoved(readRemoved());
    const timer = window.setInterval(() => setTick(Date.now()), 400);
    return () => window.clearInterval(timer);
  }, []);

  function save(next: string[]) {
    setRemoved(next);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  }

  const live = TOYS.filter((toy) => !removed.includes(toy.id));

  return (
    <section className="border border-slate-800 bg-slate-950 p-3">
      <h2 className="font-display tracking-[0.14em] text-slate-100">{t("sandbox.title")}</h2>
      <p className="mt-2 text-sm text-slate-400">{t("sandbox.lead")}</p>
      {live.length === 0 ? <p className="mt-3 text-sm text-slate-500">{t("sandbox.empty")}</p> : null}
      <ul className="mt-3 grid gap-3 md:grid-cols-3">
        {live.map((toy) => {
          const value = toy.wave(tick || Date.now());
          const width = Math.max(12, Math.min(100, toy.id === "hue" ? value / 4 : toy.id === "husky" ? value * 1.6 : value * 3));
          return (
            <li key={toy.id} className="border border-slate-800 p-3">
              <p className="text-sm text-slate-100">{t(toy.name)} <span className="text-slate-500">{t(toy.kind)}</span></p>
              <p className="mt-1 font-mono text-lg text-cyan-300">{value.toFixed(toy.id === "nest" ? 1 : 0)} {toy.unit}</p>
              <div className="mt-2 h-2 bg-slate-900">
                <div className="h-2 bg-anchor" style={{ width: `${width}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">{t(toy.note)}</p>
              <button type="button" onClick={() => save([...removed, toy.id])} className="mt-3 min-h-10 border border-slate-600 px-3 text-sm">
                {t("sandbox.remove")}
              </button>
            </li>
          );
        })}
      </ul>
      {removed.length ? (
        <button type="button" onClick={() => save([])} className="mt-3 min-h-10 border border-slate-600 px-3 text-sm">
          {t("sandbox.restore")}
        </button>
      ) : null}
    </section>
  );
}
