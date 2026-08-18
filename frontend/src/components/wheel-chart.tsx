"use client";

import { motion } from "motion/react";

import { WHEEL, domainImportance, domainScore, type WheelResult } from "@/lib/therapy";

// Радар «колесо баланса»: 10 осей по сферам, значение 0–10.
export function WheelChart({ result, size = 260, showLabels = true }: { result: WheelResult; size?: number; showLabels?: boolean }) {
  const pad = showLabels ? 46 : 14;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - pad;
  const n = WHEEL.length;
  const angle = (i: number) => (-Math.PI / 2) + (i * 2 * Math.PI) / n;
  const pt = (i: number, r: number) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))] as const;

  const rings = [2, 4, 6, 8, 10];
  const ringPath = (level: number) => WHEEL.map((_, i) => { const [x, y] = pt(i, (R * level) / 10); return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ") + " Z";
  const dataPath = WHEEL.map((d, i) => { const [x, y] = pt(i, (R * domainScore(result, d.key)) / 10); return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ") + " Z";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto block">
      {rings.map((lvl) => (
        <path key={lvl} d={ringPath(lvl)} fill={lvl === 10 ? "#fff" : "none"} stroke="var(--edge-neutral)" strokeWidth={lvl === 10 ? 2 : 1} opacity={lvl === 10 ? 1 : 0.5} />
      ))}
      {WHEEL.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--edge-neutral)" strokeWidth={1} opacity={0.5} />; })}

      <motion.path d={dataPath} fill="var(--purple)" fillOpacity={0.35} stroke="var(--purple-edge)" strokeWidth={2.5} strokeLinejoin="round"
        initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 120, damping: 16 }} style={{ transformOrigin: `${cx}px ${cy}px` }} />

      {WHEEL.map((d, i) => { const [x, y] = pt(i, (R * domainScore(result, d.key)) / 10); return (
        <motion.circle key={d.key} cx={x} cy={y} r={4.5} fill={d.color} stroke={d.edge} strokeWidth={2}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15 + i * 0.03, type: "spring", stiffness: 300, damping: 18 }} />
      ); })}

      {showLabels && WHEEL.map((d, i) => {
        const [rx, y] = pt(i, R + 14);
        const a = angle(i);
        const anchor = Math.abs(Math.cos(a)) < 0.3 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        // Боковые подписи («Любовь», «Отдых») упирались в край svg и обрезались.
        // Ширину считаем по числу букв и подтягиваем метку внутрь кадра.
        const w = d.short.length * 6.8;
        const x = anchor === "start" ? Math.min(rx, size - w - 3) : anchor === "end" ? Math.max(rx, w + 3) : rx;
        return <text key={d.key} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className="fill-[var(--ink)] text-[8.5px] font-black uppercase" style={{ letterSpacing: ".02em" }}>{d.short}</text>;
      })}
    </svg>
  );
}

// Список сфер: дорожка 0–10 в цвет сферы, обводка — тот же цвет темнее.
// Чёрточка на дорожке — насколько сфера важна человеку: разрыв между ней и
// заливкой и есть то, что просит внимания.
export function WheelBars({ result, compact = false }: { result: WheelResult; compact?: boolean }) {
  const rated = domainImportance(result, WHEEL[0].key) !== null;
  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      {WHEEL.map((d) => {
        const v = domainScore(result, d.key);
        const imp = domainImportance(result, d.key);
        return (
          <div key={d.key} className="flex items-center gap-2.5">
            <span className={`shrink-0 ${compact ? "w-[72px] text-[10px]" : "w-[86px] text-[11px]"} truncate font-bold text-[var(--muted)]`}>{d.short}</span>
            <div className={`relative flex-1 overflow-hidden rounded-full ${compact ? "h-3" : "h-3.5"}`} style={{ background: "#fff", border: `var(--bw) solid ${d.edge}` }}>
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(v / 10) * 100}%`, background: d.color, transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)" }} />
              {imp !== null && <span className="absolute inset-y-0 w-[2px] rounded-full bg-[var(--ink)]" style={{ left: `calc(${(imp / 10) * 100}% - 1px)` }} />}
            </div>
            <span className={`shrink-0 tnum font-black ${compact ? "text-[11px]" : "text-[12px]"}`}>{v.toFixed(1)}</span>
          </div>
        );
      })}
      {rated && <p className="pt-0.5 text-[10px] font-semibold text-[var(--muted-2)]">Заливка — насколько доволен(льна), чёрточка — насколько сфера важна.</p>}
    </div>
  );
}
