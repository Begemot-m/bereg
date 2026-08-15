"use client";

import { motion } from "motion/react";
import { ArrowGlyph } from "@/components/blocks";
import { useMemo, useState } from "react";

import { moodColor } from "@/components/mood-egg";
import { Disclosure } from "@/components/ui";
import { emotionValence } from "@/lib/emotions";
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

/** Самые частые эмоции с их количеством, по убыванию. */
export function topEmotions(moods: Mood[], limit = 6): [string, number][] {
  const counts = new Map<string, number>();
  for (const entry of moods) for (const name of entry.emotions ?? []) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

/** Плашки эмоций: цвет — по валентности, как у точек на линии настроения. */
export function EmotionChips({ items, showCount = true }: { items: [string, number][]; showCount?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(([name, count]) => (
        <span key={name} className="chip" style={{ background: moodColor(emotionValence(name)), color: "#fff" }}>
          {showCount ? `${name} · ${count}` : name}
        </span>
      ))}
    </div>
  );
}

// Динамика настроения: линия за период + календарь месяца + частые эмоции.
export function MoodStats({ moods, title = "Настроение", compact }: { moods: Mood[]; title?: string; compact?: boolean }) {
  const [range, setRange] = useState<7 | 30 | "all">(compact ? 7 : 30);
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [calendar, setCalendar] = useState(false);

  const byDay = useMemo(() => {
    const map = new Map<string, Mood>();
    for (const entry of moods) map.set(dayKey(new Date(entry.date)), entry);
    return map;
  }, [moods]);

  const series = useMemo(() => {
    // Всё время: от первой отметки до сегодня. Длинную историю сворачиваем по
    // неделям — иначе на трёхсантиметровой линии оказывается триста точек, и
    // читать в ней нечего.
    if (range === "all") {
      const days = [...byDay.values()].map((entry) => new Date(entry.date)).sort((a, b) => a.getTime() - b.getTime());
      if (!days.length) return [];
      const first = days[0];
      const span = Math.ceil((Date.now() - first.getTime()) / 86_400_000) + 1;
      if (span <= 60) {
        return Array.from({ length: span }, (_, index) => {
          const date = new Date(first);
          date.setHours(0, 0, 0, 0);
          date.setDate(date.getDate() + index);
          const key = dayKey(date);
          return { key, date, mood: byDay.get(key)?.mood };
        });
      }
      const weeks = Math.ceil(span / 7);
      return Array.from({ length: weeks }, (_, index) => {
        const date = new Date(first);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + index * 7);
        const marks: number[] = [];
        for (let day = 0; day < 7; day++) {
          const cursor = new Date(date);
          cursor.setDate(cursor.getDate() + day);
          const found = byDay.get(dayKey(cursor))?.mood;
          if (found) marks.push(found);
        }
        return { key: dayKey(date), date, mood: marks.length ? marks.reduce((sum, value) => sum + value, 0) / marks.length : undefined };
      });
    }
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

  const top = useMemo(() => topEmotions(moods), [moods]);

  return (
    <div className="overflow-hidden rounded-[18px] bg-white" style={{ border: "var(--bw-lg) solid var(--edge-neutral)" }}>
      <div className="p-3.5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.1em] text-[var(--muted)]">{title}</p>
            <p className="text-[14px] font-black leading-tight">
              {marked.length ? `${MOOD_LABEL[Math.round(avg)]} в среднем` : "Пока нет отметок"}
              {marked.length >= 4 && <span className="ml-1.5 text-[11px] font-black" style={{ color: trend > 0.25 ? "var(--green-edge)" : trend < -0.25 ? "var(--salmon-edge)" : "var(--muted-2)" }}>{trend > 0.25 ? "↑ лучше" : trend < -0.25 ? "↓ хуже" : "→ ровно"}</span>}
            </p>
          </div>
          <div className="flex gap-1 rounded-full bg-[var(--surface-2)] p-1" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
            {([7, 30, "all"] as const).map((option) => (
              <button key={option} onClick={() => { select(); setRange(option); }} className="rounded-full px-2.5 py-1 text-[10.5px] font-black transition-colors" style={range === option ? { background: "var(--ink)", color: "#fff" } : { color: "var(--muted)" }}>
                {option === "all" ? "всё" : `${option} дн.`}
              </button>
            ))}
          </div>
        </div>
        <MoodLine series={series} />
      </div>

      {top.length > 0 && (
        <div className="line-top p-3.5">
          <p className="mb-2 text-[9px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Частые эмоции</p>
          <EmotionChips items={top} />
        </div>
      )}

      <div className="line-top p-3.5">
        <button onClick={() => { select(); setCalendar(!calendar); }} className="flex w-full items-center justify-between rounded-full bg-[var(--surface-2)] px-3 py-2 text-[11px] font-black" aria-expanded={calendar}>
          <span>{calendar ? "Свернуть календарь" : "Статистика в календаре"}</span>
          <span>{calendar ? "↑" : "→"}</span>
        </button>
        <Disclosure open={calendar}>
          <div className="mt-2.5">
            <div className="mb-2.5 flex items-center justify-between">
              <button onClick={() => { select(); setMonth(shiftMonth(month, -1)); }} className="arrow" aria-label="Предыдущий месяц"><ArrowGlyph style={{ transform: "rotate(180deg)" }} /></button>
              <p className="t-cap">{monthLabel(month)}</p>
              <button onClick={() => { select(); setMonth(shiftMonth(month, 1)); }} className="arrow" aria-label="Следующий месяц"><ArrowGlyph /></button>
            </div>
            <MoodCalendar month={month} byDay={byDay} />
          </div>
        </Disclosure>
      </div>
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
              className="flex aspect-square flex-col items-center justify-center rounded-[9px] text-[11px] font-black"
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
