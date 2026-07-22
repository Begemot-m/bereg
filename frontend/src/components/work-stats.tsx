"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Icon, type IconName } from "@/components/icons";
import { select } from "@/lib/haptics";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// Плавный счётчик — число «набегает» при появлении/смене периода.
function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now(), dur = 650, a = from.current, b = value;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(a + (b - a) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  useEffect(() => { from.current = value; }, [value]);
  return <>{n}{suffix}</>;
}

type Item = { startsAt: string; durationMin: number; clientKey: string; cancelled?: boolean };

// Анимированная статистика работы: неделя/месяц, столбики + плитки метрик.
export function WorkStats({ items, title = "Статистика работы", tone = "olive" }: { items: Item[]; title?: string; tone?: string }) {
  const [period, setPeriod] = useState<"week" | "month">("week");

  const data = useMemo(() => {
    const now = new Date();
    const active = items.filter((i) => !i.cancelled);
    if (period === "week") {
      const monday = new Date(now); monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const bars = WD.map((label, d) => {
        const day = new Date(monday); day.setDate(monday.getDate() + d);
        const next = new Date(day); next.setDate(day.getDate() + 1);
        const inDay = active.filter((i) => { const t = new Date(i.startsAt); return t >= day && t < next; });
        return { label, value: inDay.length, today: day.toDateString() === now.toDateString() };
      });
      const within = active.filter((i) => new Date(i.startsAt) >= monday && new Date(i.startsAt) < new Date(monday.getTime() + 7 * 86400000));
      return { bars, sessions: within.length, hours: Math.round(within.reduce((s, i) => s + i.durationMin, 0) / 60), clients: new Set(within.map((i) => i.clientKey)).size };
    }
    // Месяц — последние 4 недели.
    const bars = Array.from({ length: 4 }).map((_, wi) => {
      const end = new Date(now); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() - (3 - wi) * 7);
      const start = new Date(end); start.setDate(end.getDate() - 6);
      const nextEnd = new Date(end); nextEnd.setDate(end.getDate() + 1);
      const within = active.filter((i) => { const t = new Date(i.startsAt); return t >= start && t < nextEnd; });
      return { label: `${start.getDate()}–${end.getDate()}`, value: within.length, today: wi === 3 };
    });
    const monthStart = new Date(now); monthStart.setHours(0, 0, 0, 0); monthStart.setDate(monthStart.getDate() - 27);
    const within = active.filter((i) => new Date(i.startsAt) >= monthStart);
    return { bars, sessions: within.length, hours: Math.round(within.reduce((s, i) => s + i.durationMin, 0) / 60), clients: new Set(within.map((i) => i.clientKey)).size };
  }, [items, period]);

  const max = Math.max(1, ...data.bars.map((b) => b.value));

  return (
    <section className="overflow-hidden rounded-[24px] bg-white" style={{ border: `var(--bw-lg) solid var(--${tone}-edge)` }}>
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">{title}</p>
        <div className="flex gap-1 rounded-full bg-[var(--surface-2)] p-1" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
          {(["week", "month"] as const).map((p) => (
            <button key={p} onClick={() => { select(); setPeriod(p); }} className="rounded-full px-3 py-1 text-[11px] font-black transition-colors" style={period === p ? { background: "var(--ink)", color: "#fff" } : { color: "var(--muted)" }}>{p === "week" ? "Неделя" : "Месяц"}</button>
          ))}
        </div>
      </div>

      {/* Столбики */}
      <div className="flex items-end justify-between gap-1.5 px-4 pt-2" style={{ height: 132 }}>
        {data.bars.map((b, i) => (
          <div key={`${period}-${i}`} className="flex flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-[10px] font-black tabular-nums" style={{ color: b.value ? "var(--ink)" : "var(--muted-2)" }}>{b.value}</span>
            <motion.span
              className="w-full rounded-t-[8px]"
              style={{ background: b.today ? `var(--${tone})` : `var(--${tone}-soft)`, border: `1.5px solid var(--${tone}-edge)` }}
              initial={{ height: 4 }}
              animate={{ height: 8 + (b.value / max) * 84 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: i * 0.05 }}
            />
            <span className="text-[9px] font-black uppercase text-[var(--muted-2)]">{b.label}</span>
          </div>
        ))}
      </div>

      {/* Плитки метрик */}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t p-3" style={{ borderColor: "var(--edge-neutral)" }}>
        <Tile icon="calendar" tone={tone} value={data.sessions} label={period === "week" ? "сессий за неделю" : "сессий за месяц"} />
        <Tile icon="clock" tone="amber" value={data.hours} suffix=" ч" label="часов" />
        <Tile icon="users" tone="purple" value={data.clients} label="клиентов" />
      </div>
    </section>
  );
}

function Tile({ icon, tone, value, label, suffix }: { icon: IconName; tone: string; value: number; label: string; suffix?: string }) {
  return (
    <div className="rounded-[15px] p-2.5 text-center" style={{ background: `var(--${tone}-soft)`, border: `var(--bw) solid var(--${tone}-edge)` }}>
      <Icon name={icon} width={15} weight="bold" className="mx-auto" />
      <p className="font-tight tabular-nums mt-1 text-[22px] font-black leading-none"><CountUp value={value} suffix={suffix} /></p>
      <p className="mx-auto mt-1 max-w-[86px] text-[8.5px] font-black uppercase leading-tight tracking-[.04em] text-[var(--muted)]">{label}</p>
    </div>
  );
}
