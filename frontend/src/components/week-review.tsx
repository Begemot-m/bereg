"use client";

import { motion } from "motion/react";

import { Icon } from "@/components/icons";
import type { Homework, Mood } from "@/lib/clients";

const DAY = 86_400_000;
const avg = (ms: Mood[]) => (ms.length ? ms.reduce((s, m) => s + m.mood, 0) / ms.length : 0);

// «Ваша неделя» — короткий недельный итог: чек-ины, тренд настроения, задания.
export function WeekReview({ moods, homework }: { moods: Mood[]; homework: Homework[] }) {
  const now = Date.now();
  const week = moods.filter((m) => now - new Date(m.date).getTime() < 7 * DAY);
  const prev = moods.filter((m) => { const d = now - new Date(m.date).getTime(); return d >= 7 * DAY && d < 14 * DAY; });
  const delta = avg(week) - avg(prev);
  const trend = !week.length ? { label: "—", tone: "amber", up: null as boolean | null }
    : !prev.length ? { label: "копим", tone: "amber", up: null }
    : delta >= 0.3 ? { label: "выше", tone: "green", up: true }
    : delta <= -0.3 ? { label: "ниже", tone: "salmon", up: false }
    : { label: "ровно", tone: "amber", up: null };
  const hwDone = homework.filter((h) => h.status === "done").length;

  return (
    <section className="rounded-[22px] p-4" style={{ background: "var(--amber-soft)", border: "var(--bw-lg) solid var(--amber-edge)" }}>
      <div className="flex items-center gap-2.5">
        <motion.span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-white" style={{ border: "var(--bw) solid var(--amber-edge)" }} animate={{ rotate: [0, -6, 6, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}><Icon name="chart" width={18} weight="bold" /></motion.span>
        <div><p className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Ваша неделя</p><p className="text-[15px] font-black leading-tight">Как прошли 7 дней</p></div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Tile index={0} value={`${Math.min(7, week.length)}/7`} label="чек-инов" ratio={Math.min(7, week.length) / 7} />
        <Tile index={1} value={trend.label} label="настроение" tone={trend.tone} up={trend.up} />
        <Tile index={2} value={homework.length ? `${hwDone}/${homework.length}` : "—"} label="заданий" ratio={homework.length ? hwDone / homework.length : 0} />
      </div>
    </section>
  );
}

function Tile({ index, value, label, tone, up, ratio }: { index: number; value: string; label: string; tone?: string; up?: boolean | null; ratio?: number }) {
  const edge = tone ? `${tone}-edge` : "edge-neutral";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.08, type: "spring", stiffness: 420, damping: 22 }}
      className="overflow-hidden rounded-[15px] bg-white p-2.5 text-center"
      style={{ border: `var(--bw) solid var(--${edge})` }}
    >
      <p className="font-tight tnum flex items-center justify-center gap-0.5 text-[18px] font-black leading-none">
        {up === true && <span style={{ color: "var(--green-edge)" }}>↑</span>}
        {up === false && <span style={{ color: "var(--salmon-edge)" }}>↓</span>}
        {value}
      </p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-[.05em] text-[var(--muted)]">{label}</p>
      {ratio !== undefined && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
          <motion.div className="h-full rounded-full" style={{ background: `var(--${tone ?? "amber"})` }} initial={{ width: 0 }} animate={{ width: `${Math.round(ratio * 100)}%` }} transition={{ delay: 0.25 + index * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
        </div>
      )}
    </motion.div>
  );
}
