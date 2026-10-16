"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { AgentProfile } from "@/lib/fleet";
import { useI18n } from "@/lib/i18n";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export interface RadarDot {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  color: string;
  vendor: string;
  purpose: string;
  uptimeSec: number;
}

function angleOf(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 33 + char.charCodeAt(0)) % 360;
  return hash;
}

const RADIUS = { 1: 28, 2: 58, 3: 86 } as const;

export function RadarTopology({
  dots,
  scanning,
  centerDid,
  onSelect,
}: {
  dots: RadarDot[];
  scanning: boolean;
  centerDid: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  const option = useMemo(
    () => ({
      backgroundColor: "transparent",
      polar: { center: ["50%", "52%"], radius: "78%" },
      angleAxis: {
        type: "value",
        min: 0,
        max: 360,
        startAngle: 90,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
      radiusAxis: {
        min: 0,
        max: 100,
        interval: 33,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#94a3b8",
          fontSize: 10,
          formatter: (value: number) => (value < 20 ? "" : value < 45 ? "T1" : value < 75 ? "T2" : "T3"),
        },
        splitLine: { lineStyle: { color: "rgba(239,68,68,0.35)" } },
        splitArea: { show: false },
      },
      tooltip: {
        backgroundColor: "#020617",
        borderColor: "#334155",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        formatter: (params: { data?: RadarDot & { value: number[] } }) => {
          const data = params.data;
          if (!data) return "";
          const minutes = Math.max(0, Math.round((data.uptimeSec || 0) / 60));
          return [
            data.name,
            `${t("radar.tier", { tier: data.tier })} · ${data.vendor || t("radar.unnamed")}`,
            data.purpose || t("radar.noPurpose"),
            minutes ? t("radar.watched", { minutes }) : t("radar.unknownTime"),
          ].join("<br/>");
        },
      },
      series: [
        {
          type: "scatter",
          coordinateSystem: "polar",
          symbolSize: 14,
          data: dots.map((dot) => ({
            ...dot,
            value: [angleOf(dot.id), RADIUS[dot.tier]],
            itemStyle: { color: dot.color, shadowBlur: 12, shadowColor: dot.color },
          })),
        },
      ],
    }),
    [dots, t],
  );

  return (
    <div className="panel relative min-h-[520px] p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-400">{t("radar.field")}</h2>
        <p className="font-mono text-[10px] text-slate-500">{scanning ? t("radar.beamOn") : t("radar.beamOff")}</p>
      </div>
      <div className="relative">
        <div className={`pointer-events-none absolute inset-0 ${scanning ? "sweep sweep-fast" : "sweep"} opacity-70`} />
        <ReactECharts
          option={option}
          style={{ height: 520 }}
          onEvents={{
            click: (params: { data?: { id?: string } }) => {
              if (params.data?.id) onSelect(params.data.id);
            },
          }}
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 w-40 -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="font-display text-xs tracking-[0.16em] text-red-300">{t("radar.local")}</p>
          <p className="break-all font-mono text-[10px] text-slate-300">{centerDid}</p>
        </div>
      </div>
    </div>
  );
}

export function dotFromAgent(agent: AgentProfile, color: string): RadarDot {
  return {
    id: agent.id,
    name: agent.name,
    tier: agent.tier ?? 2,
    color,
    vendor: agent.vendor || agent.channel,
    purpose: agent.purpose || agent.sandboxNote,
    uptimeSec: agent.uptimeSec ?? 0,
  };
}
