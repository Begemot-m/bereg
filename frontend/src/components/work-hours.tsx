"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button, Spinner } from "@/components/ui";
import { select, success } from "@/lib/haptics";
import { getWorkHours, saveWorkHours, WEEKDAYS, type WorkHours } from "@/lib/schedule";

// 30-минутная сетка на все 24 часа — окна можно ставить когда угодно.
const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);
const DURATIONS = [45, 50, 60, 90, 120];

// Психолог сам настраивает интервалы приёма по каждому дню. Отмеченное время —
// начало приёма; длина сессии учитывается при автозаполнении.
export function WorkHoursEditor({ onSaved }: { onSaved?: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const [draft, setDraft] = useState<WorkHours | null>(null);
  const [day, setDay] = useState(0);
  const [from, setFrom] = useState(9);
  const [to, setTo] = useState(21);
  useEffect(() => { if (data) setDraft(structuredClone(data)); }, [data]);

  const save = useMutation({
    mutationFn: () => saveWorkHours(draft!),
    onSuccess: () => { success(); qc.invalidateQueries({ queryKey: ["work-hours"] }); qc.invalidateQueries({ queryKey: ["slots"] }); qc.invalidateQueries({ queryKey: ["month-avail"] }); onSaved?.(); },
  });

  if (isLoading || !draft) return <Spinner label="Окна" />;

  const dayHours = [...(draft.hours[day] ?? [])].sort();
  const setDay_ = (arr: string[]) => setDraft({ ...draft, hours: { ...draft.hours, [day]: [...new Set(arr)].sort() } });
  const toggle = (h: string) => { select(); dayHours.includes(h) ? setDay_(dayHours.filter((x) => x !== h)) : setDay_([...dayHours, h]); };
  const copyToWeekdays = () => { select(); const next = { ...draft.hours }; for (let d = 0; d < 5; d++) next[d] = [...dayHours]; setDraft({ ...draft, hours: next }); };
  const clearDay = () => { select(); setDay_([]); };

  // Автозаполнение по длине сессии от начала до конца выбранного диапазона
  const fillByStep = () => {
    select();
    const step = draft.sessionMinutes;
    const out: string[] = [];
    for (let m = from * 60; m + step <= to * 60; m += step) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
    setDay_(out);
  };

  return (
    <div className="space-y-4">
      {/* Длительность */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-[var(--muted)]">Длина сессии</span>
        <div className="flex flex-wrap gap-1">
          {DURATIONS.map((d) => (
            <button key={d} onClick={() => { select(); setDraft({ ...draft, sessionMinutes: d }); }} className="rounded-full px-3 py-1 text-[12px] font-extrabold transition-transform active:scale-95 stroke" style={draft.sessionMinutes === d ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff", color: "var(--muted)" }}>{d}м</button>
          ))}
        </div>
      </div>

      {/* Дни недели */}
      <div className="flex gap-1.5">
        {WEEKDAYS.map((label, wd) => {
          const cnt = (draft.hours[wd] ?? []).length;
          const isSel = day === wd;
          return (
            <button key={wd} onClick={() => { select(); setDay(wd); }} className="relative flex-1 rounded-[12px] py-2 text-[12px] font-extrabold transition-transform active:scale-95 stroke" style={isSel ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff", color: cnt ? "var(--ink)" : "var(--muted-2)" }}>
              {label}
              {cnt > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black stroke" style={{ background: "var(--head)", color: "var(--ink)", borderColor: "var(--edge)" }}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* Автозаполнение по длине сессии */}
      <div className="rounded-[14px] p-3 stroke" style={{ background: "var(--head-soft)" }}>
        <p className="mb-2 text-[12px] font-bold text-[var(--muted)]">Заполнить по длине сессии ({draft.sessionMinutes} мин)</p>
        <div className="flex items-center gap-2">
          <TimeNum label="с" value={from} onChange={setFrom} />
          <TimeNum label="до" value={to} onChange={setTo} />
          <Button size="sm" className="ml-auto" onClick={fillByStep}>Заполнить</Button>
        </div>
      </div>

      {/* Часы выбранного дня */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[var(--muted)]">Окна · {WEEKDAYS[day]}</span>
          {dayHours.length > 0 && <button onClick={clearDay} className="text-[12px] font-semibold text-[var(--muted-2)] hover:text-[var(--warn)]">Очистить</button>}
        </div>
        {dayHours.length > 0 && (
          <p className="mb-2 text-[12px] font-bold text-[var(--ink)]">{dayHours.join(" · ")}</p>
        )}
        <div className="grid grid-cols-6 gap-1.5">
          {HOURS.map((h) => {
            const on = dayHours.includes(h);
            return (
              <button key={h} onClick={() => toggle(h)} className="rounded-[10px] py-1.5 text-[11px] font-extrabold transition-transform active:scale-90 stroke" style={on ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff", color: "var(--muted-2)" }}>{h}</button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="soft" size="sm" onClick={copyToWeekdays}>На будни</Button>
        <Button className="flex-1" disabled={save.isPending} onClick={() => save.mutate()}>{save.isSuccess ? "Сохранено" : "Сохранить окна"}</Button>
      </div>
    </div>
  );
}

function TimeNum({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[12px] font-bold text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-1 rounded-full px-1.5 py-0.5 stroke" style={{ background: "#fff" }}>
        <button onClick={() => { select(); onChange(Math.max(0, value - 1)); }} className="text-[15px] font-bold leading-none">−</button>
        <span className="w-9 text-center text-[13px] font-extrabold tnum">{pad(value)}:00</span>
        <button onClick={() => { select(); onChange(Math.min(24, value + 1)); }} className="text-[15px] font-bold leading-none">+</button>
      </div>
    </div>
  );
}
