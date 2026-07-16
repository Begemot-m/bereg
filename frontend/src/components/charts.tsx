"use client";

import type { ReactNode } from "react";

export function Ring({ value, size = 46, stroke = 7, color = "var(--ink)" }: { value: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <svg width={size} height={size} className="shrink-0">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(32,28,24,.18)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset .7s cubic-bezier(0.16,1,0.3,1)" }} />
      </g>
    </svg>
  );
}

export function StatCard({ value, label, fill, icon }: { value: string; label: string; fill: string; icon?: ReactNode }) {
  const num = /^\d+$/.test(value.replace("%", "")) ? Number(value.replace("%", "")) : 0;
  return (
    <div className="chunk p-4" style={{ background: fill }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-tight text-[26px] font-extrabold leading-none tnum">{value}</p>
          <p className="mt-1.5 text-[12px] font-bold leading-tight">{label}</p>
        </div>
        {icon ?? <Ring value={num} />}
      </div>
    </div>
  );
}

export function Progress({ value, height = 14 }: { value: number; height?: number }) {
  return (
    <div className="w-full overflow-hidden" style={{ height, borderRadius: 999, border: "var(--bw) solid var(--stroke)", background: "#fff" }}>
      <div style={{ width: `${Math.max(4, Math.min(100, value))}%`, height: "100%", background: "var(--accent)", borderRight: "var(--bw) solid var(--stroke)", transition: "width .7s cubic-bezier(0.16,1,0.3,1)" }} />
    </div>
  );
}

// Сегмент «ниже/средне/выше» как в рефе Journal
export function SegBar({ level, color = "var(--accent)" }: { level: "below" | "average" | "above"; color?: string }) {
  const idx = level === "below" ? 0 : level === "average" ? 1 : 2;
  return (
    <div>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-2.5 flex-1 rounded-full" style={{ background: i === idx ? color : "rgba(32,28,24,.1)", border: "1.5px solid var(--stroke)" }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px] font-bold text-[var(--muted-2)]">
        <span>Ниже</span><span>Средне</span><span>Выше</span>
      </div>
    </div>
  );
}
