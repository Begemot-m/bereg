"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Icon, type IconName } from "@/components/icons";
import { select } from "@/lib/haptics";
import { addDays, parseYmd, weekdayOf, zoneDay, zoneYmd } from "@/lib/zone";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const firstOf = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}-01`;
const shiftMonth = (y: number, m: number, delta: number) => {
  const raw = m - 1 + delta;
  return { y: y + Math.floor(raw / 12), m: ((raw % 12) + 12) % 12 + 1 };
};
const MON = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

// Плавный счётчик — число «набегает» при появлении/смене периода.
function CountUp({ value, suffix = "", digits = 0 }: { value: number; suffix?: string; digits?: number }) {
  const [n, setN] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now(), dur = 650, a = from.current, b = value;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(a + (b - a) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  useEffect(() => { from.current = value; }, [value]);
  return <>{n.toFixed(digits).replace(".", ",")}{suffix}</>;
}

const plural = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
};

type Item = { startsAt: string; durationMin: number; clientKey: string; cancelled?: boolean };

// Анимированная статистика работы: неделя/месяц, столбики + плитки метрик.
export function WorkStats({ items, title = "Статистика работы" }: { items: Item[]; title?: string }) {
  const [period, setPeriod] = useState<"week" | "month" | "all">("week");

  const data = useMemo(() => {
    // Границы периодов режутся по календарю платформы: у психолога восточнее
    // Москвы иначе поздняя встреча попадала бы в соседний день статистики.
    const todayY = zoneYmd(new Date());
    const today = parseYmd(todayY)!;
    const active = items.filter((i) => !i.cancelled);

    // Итог за отрезок дней, обе границы включительно.
    const range = (fromY: string, toY: string) => {
      const start = zoneDay(fromY);
      const end = zoneDay(addDays(toY, 1));
      const within = active.filter((i) => { const t = new Date(i.startsAt); return t >= start && t < end; });
      return {
        sessions: within.length,
        hours: within.reduce((s, i) => s + i.durationMin, 0) / 60,
        clients: new Set(within.map((i) => i.clientKey)).size,
      };
    };

    if (period === "all") {
      // Всё время — последние 6 месяцев по месяцам.
      const bars = Array.from({ length: 6 }).map((_, mi) => {
        const from = shiftMonth(today.y, today.m, -(5 - mi));
        const to = shiftMonth(from.y, from.m, 1);
        const start = zoneDay(firstOf(from.y, from.m));
        const end = zoneDay(firstOf(to.y, to.m));
        const within = active.filter((i) => { const t = new Date(i.startsAt); return t >= start && t < end; });
        return { label: MON[from.m - 1], value: within.length, today: mi === 5 };
      });
      return {
        bars,
        sessions: active.length,
        hours: active.reduce((s, i) => s + i.durationMin, 0) / 60,
        clients: new Set(active.map((i) => i.clientKey)).size,
        prev: null as number | null,
        prevLabel: "",
      };
    }

    if (period === "week") {
      // Неделя скользящая — последние 7 дней, а не с понедельника. С
      // календарной в зачёт шли только состоявшиеся встречи, и утром
      // понедельника работающий специалист видел три нуля.
      const startY = addDays(todayY, -6);
      const bars = Array.from({ length: 7 }).map((_, d) => {
        const dayY = addDays(startY, d);
        const day = zoneDay(dayY);
        const next = zoneDay(addDays(dayY, 1));
        const inDay = active.filter((i) => { const t = new Date(i.startsAt); return t >= day && t < next; });
        return { label: WD[weekdayOf(dayY)], value: inDay.length, today: dayY === todayY };
      });
      const now = range(startY, todayY);
      return { bars, ...now, prev: range(addDays(todayY, -13), addDays(todayY, -7)).sessions, prevLabel: "в прошлые 7 дней" };
    }

    // Месяц — последние 4 недели.
    const bars = Array.from({ length: 4 }).map((_, wi) => {
      const endY = addDays(todayY, -(3 - wi) * 7);
      const startY = addDays(endY, -6);
      return { label: `${parseYmd(startY)!.d}–${parseYmd(endY)!.d}`, value: range(startY, endY).sessions, today: wi === 3 };
    });
    const now = range(addDays(todayY, -27), todayY);
    return { bars, ...now, prev: range(addDays(todayY, -55), addDays(todayY, -28)).sessions, prevLabel: "в прошлые 4 недели" };
  }, [items, period]);

  const max = Math.max(1, ...data.bars.map((b) => b.value));
  const hours = Math.round(data.hours * 10) / 10;
  // Сравнивать не с чем, пока в обоих периодах пусто — тогда строки нет.
  const delta = data.prev === null || (data.sessions === 0 && data.prev === 0) ? null : data.sessions - data.prev;

  return (
    // Рамка в цвет собственного фона: блок держит форму, но не режет лист
    // контуром — по просьбе владельца статистика на главной без обводки.
    <section className="card overflow-hidden" style={{ borderColor: "var(--surface)" }}>
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <p className="t-micro">{title}</p>
        <div className="flex gap-1 rounded-full bg-[var(--surface-2)] p-1">
          {(["week", "month", "all"] as const).map((p) => (
            <button key={p} onClick={() => { select(); setPeriod(p); }} className="rounded-full px-2.5 py-1 text-[11px] font-black transition-colors" style={period === p ? { background: "var(--ink)", color: "#fff" } : { color: "var(--muted)" }}>{p === "week" ? "Неделя" : p === "month" ? "Месяц" : "Всего"}</button>
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
              style={{ background: "var(--head-soft)" }}
              initial={{ height: 4 }}
              animate={{ height: 8 + (b.value / max) * 84 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: i * 0.05 }}
            />
            <span className="text-[9px] font-black uppercase text-[var(--muted-2)]">{b.label}</span>
          </div>
        ))}
      </div>

      {/* Плитки метрик */}
      <div className="line-top mt-3 p-3">
        <div className="grid grid-cols-3 gap-2">
          <Tile icon="calendar" value={data.sessions} label={period === "week" ? "сессий за 7 дней" : period === "month" ? "сессий за 4 недели" : "сессий всего"} tone="green" />
          <Tile icon="clock" value={hours} digits={Number.isInteger(hours) ? 0 : 1} suffix=" ч" label="длительность" tone="amber" />
          <Tile icon="users" value={data.clients} label="клиентов" tone="purple" />
        </div>
        {/* Число без сравнения ничего не говорит: «12 сессий» — это больше или
            меньше? Ради ответа на этот вопрос сюда и возвращаются. */}
        {delta !== null && (
          <p className="mt-2.5 text-center text-[11px] font-black" style={{ color: delta > 0 ? "var(--green-edge)" : "var(--muted)" }}>
            {delta > 0
              ? `На ${delta} ${plural(delta, "встречу", "встречи", "встреч")} больше, чем ${data.prevLabel}`
              : delta < 0
                ? `На ${-delta} ${plural(-delta, "встречу", "встречи", "встреч")} меньше, чем ${data.prevLabel}`
                : `Столько же, сколько ${data.prevLabel}`}
          </p>
        )}
      </div>
    </section>
  );
}

function Tile({ icon, value, label, suffix, tone, digits }: { icon: IconName; value: number; label: string; suffix?: string; tone?: "green" | "amber" | "purple"; digits?: number }) {
  return (
    <div className="card-soft relative p-2.5 pt-3" style={tone ? { background: `var(--${tone}-soft)` } : undefined}>
      <Icon name={icon} width={14} weight="bold" className="absolute right-2.5 top-2.5 opacity-60" color={tone ? `var(--${tone}-edge)` : undefined} />
      <p className="font-tight tabular-nums text-[28px] font-black leading-none"><CountUp value={value} suffix={suffix} digits={digits} /></p>
      <p className="mt-1.5 text-[8.5px] font-black uppercase leading-tight tracking-[.04em] text-[var(--muted)]">{label}</p>
    </div>
  );
}
