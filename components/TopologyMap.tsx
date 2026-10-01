"use client";

export type MapTone = "IDLE" | "SAFE" | "WARNING" | "CRITICAL" | "BLOCKED" | "SECURED";

export interface MapNode {
  id: string;
  callsign: string;
  name: string;
  channel: string;
  x: number;
  y: number;
  selected: boolean;
  tone: MapTone;
}

const TONE: Record<MapTone, string> = {
  IDLE: "#94a3b8",
  SAFE: "#22c55e",
  WARNING: "#f59e0b",
  CRITICAL: "#ef4444",
  BLOCKED: "#ef4444",
  SECURED: "#22c55e",
};

export function TopologyMap({
  nodes,
  scanning,
  onSelect,
}: {
  nodes: MapNode[];
  scanning: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="panel p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-400">
          空间网格
        </h2>
        <p className="font-mono text-[10px] text-slate-500">SSSU 4m² · 本机占据 Grid 5</p>
      </div>
      <svg viewBox="0 0 640 340" className="h-auto w-full" role="img" aria-label="空间设备扫描拓扑">
        <rect x="28" y="24" width="584" height="288" fill="rgba(15,23,42,0.35)" stroke="#334155" />
        {Array.from({ length: 3 }, (_, row) =>
          Array.from({ length: 3 }, (_, col) => (
            <rect
              key={`${row}-${col}`}
              x={28 + col * 194.6}
              y={24 + row * 96}
              width="194.6"
              height="96"
              fill="none"
              stroke="rgba(148,163,184,0.18)"
            />
          )),
        )}
        <text x="320" y="176" textAnchor="middle" fill="#64748b" fontSize="11">
          GRID 5 · 观察位
        </text>
        <g className={scanning ? "sweep sweep-fast" : "sweep"}>
          <path d="M320 168 L320 48 A140 140 0 0 1 452 112 Z" fill="rgba(239,68,68,0.13)" />
          <line x1="320" y1="168" x2="320" y2="42" stroke="#ef4444" strokeWidth="1.4" />
        </g>
        <circle cx="320" cy="250" r="7" fill="#020617" stroke="#ef4444" strokeWidth="2" />
        <text x="320" y="272" textAnchor="middle" fill="#fecaca" fontSize="11">
          本机 A
        </text>
        {nodes.map((node) => {
          const cx = 28 + (node.x / 100) * 584;
          const cy = 24 + (node.y / 100) * 288;
          const color = TONE[node.tone];
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} className="cursor-pointer">
              <circle
                cx={cx}
                cy={cy}
                r={node.selected ? 16 : 11}
                fill="#020617"
                stroke={color}
                strokeWidth={node.selected ? 3 : 1.6}
                strokeDasharray={node.tone === "BLOCKED" ? "3 2" : undefined}
              />
              <circle cx={cx} cy={cy} r="3" fill={color} />
              <text x={cx} y={cy - 20} textAnchor="middle" fill="#e2e8f0" fontSize="11">
                {node.callsign}
              </text>
              <text x={cx} y={cy + 28} textAnchor="middle" fill="#94a3b8" fontSize="10">
                {node.channel}
              </text>
            </g>
          );
        })}
        {nodes.length === 0 ? (
          <text x="320" y="210" textAnchor="middle" fill="#94a3b8" fontSize="13">
            网格静默 · 等待扫描
          </text>
        ) : null}
      </svg>
    </div>
  );
}
