"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
  isDimKey,
  resolveTrack,
  type InferenceItem,
  type ManualOverride,
  type SensorPoint,
  type TimePhase,
} from "@/lib/dual-track";
import { useI18n } from "@/lib/i18n";
import type { DimKey } from "@/lib/tensor";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const PHASES: TimePhase[] = ["past", "present", "future"];
const MAGNITUDE_LABEL = { low: "低幅度", med: "中低幅度", high: "高幅度" };

function overrideKey(phase: TimePhase, dimension: DimKey): string {
  return `${phase}:${dimension}`;
}

export function DualTrackBoard({
  focus,
  sensor,
  inferred,
  overrides,
  onOverride,
  onAnalyze,
  analyzing,
  analyzeNote,
}: {
  focus: DimKey;
  sensor: SensorPoint | null;
  inferred: InferenceItem | null;
  overrides: Record<string, ManualOverride>;
  onOverride: (phase: TimePhase, next: ManualOverride | null) => void;
  onAnalyze: (notes: string) => void;
  analyzing: boolean;
  analyzeNote: string;
}) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<TimePhase>("present");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("洗衣机正在运行。今日京东冷链送达生鲜。网络日志里有频繁掉线，原因不明。");
  const current = overrides[overrideKey(phase, focus)] ?? null;
  const track = resolveTrack({ sensor: phase === "present" ? sensor : null, inferred: phase === "present" ? inferred : null, override: current });

  return (
    <section className="panel space-y-3 p-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-400">{t("track.title", { name: t(`dim.${focus}`) })}</h2>
        <p className="font-mono text-[10px] text-slate-500">
          {track.source === "override" ? t("track.override") : track.source === "sensor" ? t("track.sensor") : inferred ? t("track.inferred") : t("track.empty")}
        </p>
      </div>
      <label className="block text-xs text-slate-400">
        时序
        <input
          type="range"
          min={0}
          max={2}
          step={1}
          value={PHASES.indexOf(phase)}
          onChange={(event) => {
            const next = PHASES[Number(event.target.value)] ?? "present";
            setPhase(next);
            const stored = overrides[overrideKey(next, focus)];
            setValue(stored?.value ?? "");
            setDescription(stored?.description ?? "");
          }}
          className="mt-2 w-full"
        />
        <span className="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
          <span>过去</span>
          <span className="text-red-200">{t(`phase.${phase}`)}</span>
          <span>将来</span>
        </span>
      </label>

      {track.source === "override" && current ? (
        <div className="border border-red-900 px-3 py-2 text-sm">
          <p className="text-red-200">人工覆写优先于传感器和模型。</p>
          <p className="mt-1 font-mono text-slate-100">{current.value || "未填精确值"}</p>
          <p className="text-slate-400">{current.description}</p>
          {phase === "future" ? <p className="mt-1 text-xs text-amber-200">将来时的这条记录会覆盖该时段原来的预测基线。</p> : null}
        </div>
      ) : null}

      {track.source === "sensor" && sensor ? <ExactChart point={sensor} /> : null}

      {track.source === "inferred" && inferred ? <FuzzyCard item={inferred} /> : null}

      {track.source === "inferred" && !inferred ? (
        <p className="text-sm text-slate-500">这一维在当前时点没有传感器读数，也没有推演。可以在下面写入人工值，或贴一段备忘让本地模型起草。</p>
      ) : null}

      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-xs text-slate-400">
          精确值
          <input value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 font-mono text-sm text-slate-100" />
        </label>
        <label className="text-xs text-slate-400">
          描述
          <input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100" />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="min-h-10 bg-anchor px-3 text-sm text-white"
          onClick={() =>
            onOverride(phase, {
              phase,
              dimension: focus,
              value: value.slice(0, 40),
              description: description.slice(0, 120),
            })
          }
        >
          {t("track.write", { phase: t(`phase.${phase}`) })}
        </button>
        <button type="button" className="min-h-10 border border-slate-600 px-3 text-sm" onClick={() => onOverride(phase, null)}>
          清除此时段
        </button>
      </div>

      <label className="block text-xs text-slate-400">
        家庭备忘（只分析你贴进来的文字，不读取聊天记录）
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100" />
      </label>
      <button type="button" disabled={analyzing || !notes.trim()} onClick={() => onAnalyze(notes)} className="min-h-10 border border-slate-600 px-3 text-sm disabled:opacity-50">
        {analyzing ? "推演中…" : "推演模糊态势"}
      </button>
      {analyzeNote ? <p className="text-xs text-slate-400">{analyzeNote}</p> : null}
      <BatchLines
        onApply={(rows) => {
          for (const row of rows) onOverride("present", { phase: "present", dimension: row.dimension, value: row.value, description: row.description });
        }}
      />
    </section>
  );
}

function ExactChart({ point }: { point: SensorPoint }) {
  const option = {
    backgroundColor: "transparent",
    grid: { left: 42, right: 12, top: 24, bottom: 28 },
    xAxis: {
      type: "category",
      data: ["地球基线", "现在"],
      axisLabel: { color: "#94a3b8" },
      axisLine: { lineStyle: { color: "#334155" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8" },
      splitLine: { lineStyle: { color: "rgba(51,65,85,0.6)" } },
    },
    series: [
      {
        type: "line",
        data: [point.baseline, point.value],
        smooth: false,
        symbolSize: 8,
        lineStyle: { color: "#22c55e" },
        itemStyle: { color: "#ef4444" },
      },
    ],
  };
  return (
    <div>
      <p className="font-mono text-sm text-slate-100">
        {point.value} {point.unit}
      </p>
      <p className="text-[11px] text-slate-500">{point.label}</p>
      <ReactECharts option={option} style={{ height: 180 }} />
    </div>
  );
}

function FuzzyCard({ item }: { item: InferenceItem }) {
  const up = item.trend === "up";
  const path = item.trend === "unknown" ? "M0 20 H120" : up ? "M0 32 C 30 30, 40 18, 60 16 S 100 8, 120 4" : "M0 6 C 30 8, 40 20, 60 22 S 100 32, 120 34";
  return (
    <div className="border border-amber-900/60 px-3 py-2">
      <div className="flex items-center gap-3">
        {item.icon === "water" ? <Droplet /> : null}
        {item.icon === "food" ? <Pantry /> : null}
        {item.trend === "unknown" ? <span className="spin-q font-display text-3xl text-amber-200">?</span> : null}
        <svg viewBox="0 0 120 40" className="h-10 flex-1" aria-hidden>
          <path d={path} fill="none" stroke="#f59e0b" strokeWidth="2" />
        </svg>
        <span className="font-mono text-xs text-amber-200">{MAGNITUDE_LABEL[item.magnitude]}</span>
      </div>
      <p className="mt-2 text-sm text-slate-200">{item.summary}</p>
      <p className="mt-1 font-mono text-[10px] text-slate-500">
        开始 {item.start.replace("T", " ").slice(0, 16)} · （预估）停止 {item.end.replace("T", " ").slice(0, 16)}
      </p>
    </div>
  );
}

function BatchLines({ onApply }: { onApply: (rows: { dimension: DimKey; value: string; description: string }[]) => void }) {
  const [text, setText] = useState("water=中等消耗\nsound=42 dB");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2 border border-slate-800 p-2">
      <p className="text-xs text-slate-400">批量覆写现在。每行写成 维度英文名=数值或描述，例如 water=中等消耗。</p>
      <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} className="w-full border border-slate-700 bg-slate-950 px-2 py-2 font-mono text-xs text-slate-100" />
      <button
        type="button"
        className="min-h-10 border border-slate-600 px-3 text-sm"
        onClick={() => {
          const rows = text
            .split("\n")
            .map((line) => {
              const [name, ...rest] = line.split("=");
              const dimension = (name || "").trim();
              const body = rest.join("=").trim();
              if (!isDimKey(dimension) || !body) return null;
              const numeric = /^[0-9.]+/.test(body);
              return { dimension, value: numeric ? body.slice(0, 40) : "", description: numeric ? "" : body.slice(0, 120) };
            })
            .filter((row): row is { dimension: DimKey; value: string; description: string } => Boolean(row));
          onApply(rows);
          setNote(rows.length ? `已写入 ${rows.length} 个维度` : "没有可识别的行");
        }}
      >
        写入批量覆写
      </button>
      {note ? <p className="text-xs text-slate-400">{note}</p> : null}
    </div>
  );
}

function Droplet() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-sky-300" aria-label="用水">
      <path d="M12 3 C12 3 6 11 6 15 a6 6 0 0 0 12 0 C18 11 12 3 12 3Z" fill="currentColor" />
    </svg>
  );
}

function Pantry() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-lime-300" aria-label="食物储备">
      <path d="M5 10 h14 l-1 10 H6 Z M8 10 V7 h8 v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
