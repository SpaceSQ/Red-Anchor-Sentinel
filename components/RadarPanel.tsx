"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { DIM_KEYS, type DimScores } from "@/lib/tensor";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <div className="h-[340px] animate-pulse bg-slate-900/40" />,
});

export function RadarPanel({ scores }: { scores: DimScores | null }) {
  const { t, lang } = useI18n();
  const option = useMemo(() => {
    const values = scores ? DIM_KEYS.map((key) => Math.round(scores[key])) : DIM_KEYS.map(() => 0);
    return {
      backgroundColor: "transparent",
      legend: {
        bottom: 0,
        textStyle: { color: "#cbd5e1", fontSize: 11 },
        data: [t("chart.baseline"), t("chart.risk")],
      },
      radar: {
        center: ["50%", "48%"],
        radius: "62%",
        startAngle: 90,
        splitNumber: 4,
        indicator: DIM_KEYS.map((key) => ({ name: t(`dim.${key}.short`), max: 100 })),
        axisName: {
          color: "#e2e8f0",
          fontSize: 13,
          fontFamily: "var(--font-mono), monospace",
        },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.28)" } },
        splitArea: {
          areaStyle: {
            color: ["rgba(2,6,23,0.15)", "rgba(15,23,42,0.55)"],
          },
        },
        axisLine: { lineStyle: { color: "rgba(148,163,184,0.35)" } },
      },
      series: [
        {
          type: "radar",
          symbol: "none",
          data: [
            {
              name: t("chart.baseline"),
              value: DIM_KEYS.map(() => 8),
              lineStyle: { color: "#22c55e", width: 1.5 },
              areaStyle: { color: "rgba(34,197,94,0.14)" },
            },
            {
              name: t("chart.risk"),
              value: values,
              lineStyle: { color: "#ef4444", width: 2 },
              areaStyle: { color: "rgba(239,68,68,0.22)" },
              itemStyle: { color: "#ef4444" },
            },
          ],
        },
      ],
    };
  }, [scores, lang, t]);

  return (
    <div className="panel p-3">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-400">
          {t("dim.title")}
        </h2>
        <p className="font-mono text-[10px] text-slate-500">
          {scores ? t("chart.bands") : t("chart.wait")}
        </p>
      </div>
      <ReactECharts option={option} style={{ height: 340 }} notMerge lazyUpdate />
    </div>
  );
}
