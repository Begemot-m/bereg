"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button, Spinner } from "@/components/ui";
import { select, success } from "@/lib/haptics";
import { getWorkHours, saveWorkHours, WEEKDAYS, type WorkHours } from "@/lib/schedule";

const TIMES: string[] = [];
for (let h = 7; h <= 22; h++) for (const m of [0, 30]) TIMES.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
const DURATIONS = [45, 50, 60, 90];

// Психолог задаёт доступные окна по дням и длительность сессии.
// Из этого генерируются слоты, в которые записываются клиенты.
export function WorkHoursEditor({ onSaved }: { onSaved?: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const [draft, setDraft] = useState<WorkHours | null>(null);
  useEffect(() => { if (data) setDraft(structuredClone(data)); }, [data]);

  const save = useMutation({
    mutationFn: () => saveWorkHours(draft!),
    onSuccess: () => { success(); qc.invalidateQueries({ queryKey: ["work-hours"] }); qc.invalidateQueries({ queryKey: ["slots"] }); onSaved?.(); },
  });

  if (isLoading || !draft) return <Spinner label="Окна" />;

  const setDay = (wd: number, on: boolean) => {
    select();
    const next = structuredClone(draft);
    next.ranges[wd] = on ? [{ start: "10:00", end: "18:00" }] : [];
    setDraft(next);
  };
  const setRange = (wd: number, key: "start" | "end", val: string) => {
    const next = structuredClone(draft);
    if (!next.ranges[wd]?.[0]) next.ranges[wd] = [{ start: "10:00", end: "18:00" }];
    next.ranges[wd][0][key] = val;
    setDraft(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[var(--muted)]">Длительность сессии</span>
        <div className="flex gap-1">
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => { select(); setDraft({ ...draft, sessionMinutes: d }); }}
              className="rounded-full px-3 py-1 text-[12px] font-bold transition-colors duration-150"
              style={{ background: draft.sessionMinutes === d ? "var(--a1)" : "var(--surface-2)", color: draft.sessionMinutes === d ? "#fff" : "var(--muted)" }}
            >
              {d}м
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {WEEKDAYS.map((label, wd) => {
          const on = (draft.ranges[wd]?.length ?? 0) > 0;
          const r = draft.ranges[wd]?.[0];
          return (
            <div key={wd} className="flex items-center gap-3 rounded-2xl bg-[var(--surface-2)] px-3 py-2">
              <button
                onClick={() => setDay(wd, !on)}
                className="flex h-8 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200"
                style={{ background: on ? "var(--a1)" : "#d9d6cd" }}
              >
                <span className={`h-7 w-7 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-3" : ""}`} />
              </button>
              <span className="w-8 shrink-0 text-[13px] font-bold">{label}</span>
              {on && r ? (
                <div className="flex flex-1 items-center gap-2">
                  <TimeSelect value={r.start} onChange={(v) => setRange(wd, "start", v)} />
                  <span className="text-[var(--muted-2)]">–</span>
                  <TimeSelect value={r.end} onChange={(v) => setRange(wd, "end", v)} />
                </div>
              ) : (
                <span className="flex-1 text-[13px] text-[var(--muted-2)]">выходной</span>
              )}
            </div>
          );
        })}
      </div>

      <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isSuccess ? "Сохранено" : "Сохранить окна"}
      </Button>
    </div>
  );
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 rounded-xl bg-white px-2.5 py-1.5 text-[13px] font-semibold outline-none"
      style={{ border: "1.5px solid var(--hairline)" }}
    >
      {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}
