"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Spinner } from "@/components/ui";
import { select, tap } from "@/lib/haptics";
import { getSlots, WEEKDAYS, ymdLocal, type Slot } from "@/lib/schedule";

const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const monShort = new Intl.DateTimeFormat("ru-RU", { month: "short" });

// Лента ближайших дней + сетка свободных времён. Без dd/mm/сс-пикера.
export function SlotPicker({
  forClient = false,
  daysAhead = 21,
  onPick,
}: {
  forClient?: boolean;
  daysAhead?: number;
  onPick: (iso: string) => void;
}) {
  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: daysAhead }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [daysAhead]);

  const [active, setActive] = useState(() => ymdLocal(days[0]));

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["slots", active, forClient],
    queryFn: () => getSlots(active, forClient),
  });

  const free = slots.filter((s) => !s.taken);

  return (
    <div>
      {/* Лента дней */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d) => {
          const key = ymdLocal(d);
          const isActive = key === active;
          const wd = (d.getDay() + 6) % 7;
          const today = ymdLocal(new Date()) === key;
          return (
            <button
              key={key}
              onClick={() => { select(); setActive(key); }}
              className="flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors duration-200"
              style={{ background: isActive ? "var(--a1)" : "var(--surface-2)", color: isActive ? "#fff" : "var(--ink)" }}
            >
              <span className={`text-[10px] font-bold ${isActive ? "opacity-90" : "text-[var(--muted-2)]"}`}>{WEEKDAYS[wd]}</span>
              <span className="text-[18px] font-extrabold leading-none">{d.getDate()}</span>
              <span className={`text-[9px] font-semibold ${isActive ? "opacity-80" : "text-[var(--muted-2)]"}`}>
                {today ? "сегодня" : monShort.format(d).replace(".", "")}
              </span>
            </button>
          );
        })}
      </div>

      {/* Времена */}
      <div className="mt-4 min-h-[64px]">
        {isLoading ? (
          <Spinner label="Свободные окна" />
        ) : free.length === 0 ? (
          <p className="py-3 text-[13px] text-[var(--muted-2)]">На этот день свободных окон нет.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {free.map((s: Slot) => (
              <button
                key={s.start}
                onClick={() => { tap(); onPick(s.start); }}
                className="rounded-xl py-2.5 text-[13px] font-bold transition-[transform,background-color] duration-150 hover:bg-[var(--a-tint)] active:scale-[0.96]"
                style={{ background: "var(--surface-2)", color: "var(--a1-ink)" }}
              >
                {timeF.format(new Date(s.start))}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
