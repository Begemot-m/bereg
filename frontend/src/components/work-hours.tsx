"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button, Spinner } from "@/components/ui";
import { select, success } from "@/lib/haptics";
import { getWorkHours, saveWorkHours, WEEKDAYS, type WorkHours } from "@/lib/schedule";

const HOURS = Array.from({ length: 15 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`); // 07:00..21:00
const DURATIONS = [45, 50, 60, 90];

// Психолог отмечает конкретные часы приёма по каждому дню недели.
// В эти часы клиенты видят свободные окна и записываются.
export function WorkHoursEditor({ onSaved }: { onSaved?: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const [draft, setDraft] = useState<WorkHours | null>(null);
  const [day, setDay] = useState(0);
  useEffect(() => { if (data) setDraft(structuredClone(data)); }, [data]);

  const save = useMutation({
    mutationFn: () => saveWorkHours(draft!),
    onSuccess: () => { success(); qc.invalidateQueries({ queryKey: ["work-hours"] }); qc.invalidateQueries({ queryKey: ["slots"] }); onSaved?.(); },
  });

  if (isLoading || !draft) return <Spinner label="Окна" />;

  const dayHours = draft.hours[day] ?? [];
  const toggle = (h: string) => {
    select();
    const set = new Set(dayHours);
    set.has(h) ? set.delete(h) : set.add(h);
    setDraft({ ...draft, hours: { ...draft.hours, [day]: [...set].sort() } });
  };
  const copyToWeekdays = () => {
    select();
    const next = { ...draft.hours };
    for (let d = 0; d < 5; d++) next[d] = [...dayHours];
    setDraft({ ...draft, hours: next });
  };
  const clearDay = () => { select(); setDraft({ ...draft, hours: { ...draft.hours, [day]: [] } }); };

  return (
    <div className="space-y-4">
      {/* Длительность */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[var(--muted)]">Длительность сессии</span>
        <div className="flex gap-1">
          {DURATIONS.map((d) => (
            <button key={d} onClick={() => { select(); setDraft({ ...draft, sessionMinutes: d }); }} className="rounded-full px-3 py-1 text-[12px] font-bold transition-colors duration-150" style={{ background: draft.sessionMinutes === d ? "var(--a1)" : "var(--surface-2)", color: draft.sessionMinutes === d ? "#fff" : "var(--muted)" }}>{d}м</button>
          ))}
        </div>
      </div>

      {/* Дни недели */}
      <div className="flex gap-1.5">
        {WEEKDAYS.map((label, wd) => {
          const cnt = (draft.hours[wd] ?? []).length;
          const isSel = day === wd;
          return (
            <button key={wd} onClick={() => { select(); setDay(wd); }} className="relative flex-1 rounded-xl py-2 text-[12px] font-bold transition-colors duration-150" style={{ background: isSel ? "var(--a1)" : "var(--surface-2)", color: isSel ? "#fff" : cnt ? "var(--ink)" : "var(--muted-2)" }}>
              {label}
              {cnt > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black" style={{ background: isSel ? "#fff" : "var(--a1)", color: isSel ? "var(--a1-ink)" : "#fff" }}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* Часы выбранного дня */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[var(--muted)]">Часы приёма · {WEEKDAYS[day]}</span>
          {dayHours.length > 0 && <button onClick={clearDay} className="text-[12px] font-semibold text-[var(--muted-2)] hover:text-[var(--warn)]">Очистить</button>}
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {HOURS.map((h) => {
            const on = dayHours.includes(h);
            return (
              <button key={h} onClick={() => toggle(h)} className="rounded-lg py-2 text-[12px] font-bold transition-[transform,background-color] duration-150 active:scale-[0.94]" style={{ background: on ? "var(--a1)" : "var(--surface-2)", color: on ? "#fff" : "var(--muted)" }}>{h}</button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="soft" size="sm" onClick={copyToWeekdays}>Скопировать на будни</Button>
        <Button className="flex-1" disabled={save.isPending} onClick={() => save.mutate()}>{save.isSuccess ? "Сохранено" : "Сохранить окна"}</Button>
      </div>
    </div>
  );
}
