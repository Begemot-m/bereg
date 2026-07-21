"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";

import { moodColor } from "@/components/mood-egg";
import { emotionTone } from "@/lib/emotions";
import { select } from "@/lib/haptics";
import { MOOD_LABEL } from "@/lib/mascots";
import type { Mood } from "@/lib/clients";

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const monthF = new Intl.DateTimeFormat("ru-RU", { month: "long" });
const monthLabel = (date: Date) => {
  const name = monthF.format(date);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${date.getFullYear()}`;
};

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Динамика настроения: линия за период + календарь месяца + частые эмоции.
export function MoodStats({ moods, title = "Настроение", compact }: { moods: Mood[]; title?: string; compact?: boolean }) {
  const [range, setRange] = useState<7 | 30>(compact ? 7 : 30);
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });

  const byDay = useMemo(() => {
    const map = new Map<string, Mood>();
    for (const entry of moods) map.set(dayKey(new Date(entry.date)), entry);
    return map;
  }, [moods]);

  const series = useMemo(() => {
    const out: { key: string; date: Date; mood?: number }[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      const key = dayKey(date);
      out.push({ key, date, mood: byDay.get(key)?.mood });
    }
    return out;
  }, [byDay, range]);

  const marked = series.filter((point) => point.mood);
  const avg = marked.length ? marked.reduce((sum, point) => sum + point.mood!, 0) / marked.length : 0;
  const half = Math.floor(marked.length / 2);
  const trend = marked.length >= 4
    ? avgOf(marked.slice(half)) - avgOf(marked.slice(0, half))
    : 0;

  const top = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of moods) for (const name of entry.emotions ?? []) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [moods]);

  return (
    <div className="space-y-2.5">
      <div className="rounded-[20px] bg-white p-3.5" style={{ border: "var(--bw-lg) solid var(--edge-neutral)" }}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.1em] text-[var(--muted)]">{title}</p>
            <p className="text-[14px] font-black leading-tight">
              {marked.length ? `${MOOD_LABEL[Math.round(avg)]} в среднем` : "Пока нет отметок"}
              {marked.length >= 4 && <span className="ml-1.5 text-[11px] font-black" style={{ color: trend > 0.25 ? "var(--green-edge)" : trend < -0.25 ? "var(--salmon-edge)" : "var(--muted-2)" }}>{trend > 0.25 ? "↑ лучше" : trend < -0.25 ? "↓ хуже" : "→ ровно"}</span>}
            </p>
          </div>
          <div className="flex gap-1 rounded-full bg-[var(--surface-2)] p-1" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
            {([7, 30] as const).map((option) => (
              <button key={option} onClick={() => { select(); setRange(option); }} className="rounded-full px-2.5 py-1 text-[10.5px] font-black transition-colors" style={range === option ? { background: "var(--ink)", color: "#fff" } : { color: "var(--muted)" }}>
                {option} дн.
              </button>
            ))}
          </div>
        </div>
        <MoodLine series={series} />
      </div>

      <div className="rounded-[20px] bg-white p-3.5" style={{ border: "var(--bw-lg) solid var(--edge-neutral)" }}>
        <div className="mb-2.5 flex items-center justify-between">
          <button onClick={() => { select(); setMonth(shiftMonth(month, -1)); }} className="flex h-7 w-7 items-center justify-center rounded-full text-[15px] font-black text-[var(--muted)]" aria-label="Предыдущий месяц">‹</button>
          <p className="text-[12px] font-black">{monthLabel(month)}</p>
          <button onClick={() => { select(); setMonth(shiftMonth(month, 1)); }} className="flex h-7 w-7 items-center justify-center rounded-full text-[15px] font-black text-[var(--muted)]" aria-label="Следующий месяц">›</button>
        </div>
        <MoodCalendar month={month} byDay={byDay} />
      </div>

      {top.length > 0 && (
        <div className="rounded-[20px] bg-white p-3.5" style={{ border: "var(--bw-lg) solid var(--edge-neutral)" }}>
          <p className="mb-2 text-[9px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Частые эмоции</p>
          <div className="flex flex-wrap gap-1.5">
            {top.map(([name, count]) => (
              <span key={name} className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: `var(--${emotionTone(name)})`, border: `var(--bw) solid var(--${emotionTone(name)}-edge)` }}>{name} · {count}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MoodLine({ series }: { series: { key: string; date: Date; mood?: number }[] }) {
  const W = 300;
  const H = 92;
  const pad = 8;
  const points = series.map((point, index) => ({
    x: pad + (index * (W - pad * 2)) / Math.max(1, series.length - 1),
    y: point.mood ? H - pad - ((point.mood - 1) / 4) * (H - pad * 2) : null,
    mood: point.mood,
    date: point.date,
  }));
  const filled = points.filter((point) => point.y !== null) as { x: number; y: number; mood: number; date: Date }[];
  const path = smooth(filled);

  if (!filled.length) return <p className="py-6 text-center text-[12px] font-semibold text-[var(--muted-2)]">Отмечайте настроение — здесь появится линия динамики.</p>;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 92 }}>
        {[1, 3, 5].map((level) => {
          const y = H - pad - ((level - 1) / 4) * (H - pad * 2);
          return <line key={level} x1={pad} y1={y} x2={W - pad} y2={y} stroke="var(--edge-neutral)" strokeWidth="1" strokeDasharray="3 4" />;
        })}
        <motion.path d={path} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: "easeOut" }} />
        {filled.map((point) => (
          <circle key={point.date.toISOString()} cx={point.x} cy={point.y} r="4" fill={moodColor(point.mood)} stroke="var(--ink)" strokeWidth="2" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[9px] font-black uppercase tracking-[.06em] text-[var(--muted-2)]">
        <span>{filled[0].date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
        <span>{filled.at(-1)!.date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
      </div>
    </div>
  );
}

function MoodCalendar({ month, byDay }: { month: Date; byDay: Map<string, Mood> }) {
  const first = new Date(month);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayKey = dayKey(new Date());

  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((label) => <span key={label} className="text-center text-[9px] font-black uppercase text-[var(--muted-2)]">{label}</span>)}
        {Array.from({ length: offset }).map((_, index) => <span key={`gap-${index}`} />)}
        {Array.from({ length: days }).map((_, index) => {
          const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
          const key = dayKey(date);
          const entry = byDay.get(key);
          const today = key === todayKey;
          return (
            <div
              key={key}
              className="flex aspect-square flex-col items-center justify-center rounded-[10px] text-[11px] font-black"
              title={entry ? [MOOD_LABEL[entry.mood], ...(entry.emotions ?? [])].join(" · ") : undefined}
              style={{
                background: entry ? `${moodColor(entry.mood)}` : "var(--surface-2)",
                border: `var(--bw) solid ${today ? "var(--ink)" : entry ? "rgba(32,28,24,.18)" : "var(--edge-neutral)"}`,
                color: entry ? "var(--ink)" : "var(--muted-2)",
              }}
            >
              {index + 1}
              {entry?.emotions?.length ? <span className="mt-0.5 h-1 w-1 rounded-full bg-[var(--ink)]" /> : null}
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-[.06em] text-[var(--muted-2)]">тяжело</span>
        {[1, 2, 3, 4, 5].map((level) => <span key={level} className="h-3 flex-1 rounded-full" style={{ background: moodColor(level), border: "1px solid rgba(32,28,24,.15)" }} />)}
        <span className="text-[9px] font-black uppercase tracking-[.06em] text-[var(--muted-2)]">отлично</span>
      </div>
    </div>
  );
}

function avgOf(points: { mood?: number }[]): number {
  if (!points.length) return 0;
  return points.reduce((sum, point) => sum + (point.mood ?? 0), 0) / points.length;
}

function shiftMonth(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + delta);
  return next;
}

// Сглаженная линия через точки (кубические кривые по средним).
function smooth(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} l 0.01 0`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const mx = (prev.x + cur.x) / 2;
    d += ` C ${mx} ${prev.y}, ${mx} ${cur.y}, ${cur.x} ${cur.y}`;
  }
  return d;
}
