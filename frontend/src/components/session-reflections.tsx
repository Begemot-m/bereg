"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import { Textarea } from "@/components/ui";
import { tap } from "@/lib/haptics";
import type { NotesModuleState, ReflectionPatch, SessionReflection } from "@/lib/therapy";

type Meeting = { id: number; startsAt: string; status?: string; psyName?: string };
const sessionDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function ClientSessionJourney({ meetings, reflections, module, saving, onSave, onModuleChange }: {
  meetings: Meeting[];
  reflections: SessionReflection[];
  module: NotesModuleState;
  saving?: boolean;
  onSave: (patch: ReflectionPatch) => void;
  onModuleChange: (patch: { enabled?: boolean; shared?: boolean }) => void;
}) {
  const current = useMemo(() => {
    const active = meetings.filter((meeting) => meeting.status !== "cancelled");
    const next = active.filter((meeting) => new Date(meeting.startsAt).getTime() >= Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    return next ?? [...active].sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0] ?? null;
  }, [meetings]);
  const reflection = current ? reflections.find((item) => item.appointmentId === current.id) : undefined;
  const [preparation, setPreparation] = useState("");
  const [takeaway, setTakeaway] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const upcoming = current ? new Date(current.startsAt).getTime() >= Date.now() : false;

  useEffect(() => {
    setPreparation(reflection?.preparation ?? "");
    setTakeaway(reflection?.takeaway ?? "");
    setRating(reflection?.feeling ?? null);
  }, [current?.id, reflection?.updatedAt]);

  const save = () => {
    if (!current) return;
    tap();
    onSave({ appointmentId: current.id, preparation, takeaway, feeling: rating });
  };

  return (
    <section className="space-y-3">
      <ModuleHead
        enabled={module.enabled}
        subtitle={module.psychologistEnabled ? "Подключён вашим психологом" : "Можно вести самостоятельно"}
        onToggle={() => onModuleChange({ enabled: !module.enabled })}
      />

      {module.enabled && (
        <>
          <div className="card-soft p-4">
            <div className="flex items-center justify-between gap-3">
              <div><p className="t-head">Доступ к заметкам</p><p className="t-cap mt-0.5">{module.shared && module.psychologistEnabled ? "Психолог видит ваши записи" : "Записи остаются только у вас"}</p></div>
              <CompactSwitch checked={module.shared} onChange={() => onModuleChange({ shared: !module.shared })} label="Показывать психологу" />
            </div>
          </div>

          <MeetingDynamics meetings={meetings} reflections={reflections} />

          {current ? (
            <div className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <div><p className="t-micro">{upcoming ? "БЛИЖАЙШАЯ ВСТРЕЧА" : "ПОСЛЕДНЯЯ ВСТРЕЧА"}</p><p className="t-head mt-0.5 capitalize">{sessionDate.format(new Date(current.startsAt))}</p></div>
                <span className="chip chip-strong">{upcoming ? "До встречи" : "После встречи"}</span>
              </div>
              <div className="mt-3 space-y-3">
                <label className="block"><span className="t-cap mb-1.5 block font-bold">Что хочется обсудить</span><Textarea value={preparation} onChange={(event) => setPreparation(event.target.value)} rows={3} placeholder="Запишите важные темы или вопросы…" /></label>
                {!upcoming && (
                  <>
                    <label className="block"><span className="t-cap mb-1.5 block font-bold">Впечатления после сессии</span><Textarea value={takeaway} onChange={(event) => setTakeaway(event.target.value)} rows={3} placeholder="Что было важным, что хочется сохранить…" /></label>
                    <Rating value={rating} onChange={setRating} />
                  </>
                )}
                <button onClick={save} disabled={saving || (!preparation.trim() && !takeaway.trim() && !rating)} className="btn btn-accent w-full py-2">{saving ? "Сохраняем…" : "Сохранить заметку"}</button>
              </div>
            </div>
          ) : <div className="card p-4 text-center"><p className="t-head">Встреч пока нет</p><p className="t-cap mt-1">После записи здесь появятся заметки к сессии.</p></div>}

          <ReflectionHistory reflections={reflections} />
        </>
      )}
    </section>
  );
}

export function PsychologistSessionJourney({ meetings, reflections, module, saving, onToggle }: {
  meetings: Meeting[];
  reflections: SessionReflection[];
  module: NotesModuleState;
  saving?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-3">
      <ModuleHead enabled={module.psychologistEnabled} disabled={saving} subtitle={module.psychologistEnabled ? "Модуль ведётся у вас и клиента" : "Подключите, чтобы работать с заметками вместе"} onToggle={onToggle} />
      {module.psychologistEnabled && !module.shared && <div className="card-soft p-4"><p className="t-head">Клиент ведёт заметки лично</p><p className="t-cap mt-1">Когда клиент включит передачу, записи появятся здесь автоматически.</p></div>}
      {module.psychologistEnabled && module.shared && (
        <>
          {!module.enabled && <div className="card-soft p-4"><p className="t-head">Модуль приостановлен клиентом</p><p className="t-cap mt-1">Сохранённая история остаётся доступной.</p></div>}
          <MeetingDynamics meetings={meetings} reflections={reflections} />
          <ReflectionHistory reflections={reflections} empty="Клиент пока не сохранил заметок к встречам." />
        </>
      )}
    </div>
  );
}

function ModuleHead({ enabled, subtitle, disabled, onToggle }: { enabled: boolean; subtitle: string; disabled?: boolean; onToggle: () => void }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="ico ico-accent h-10 w-10 shrink-0"><Icon name="note" width={19} weight="bold" /></span>
      <div className="min-w-0 flex-1"><p className="t-title">Заметки</p><p className="t-cap mt-0.5">{subtitle}</p></div>
      <CompactSwitch checked={enabled} disabled={disabled} onChange={onToggle} label={enabled ? "Отключить модуль" : "Подключить модуль"} />
    </div>
  );
}

function CompactSwitch({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => { tap(); onChange(); }} className="relative h-7 w-12 shrink-0 rounded-full disabled:opacity-50" style={{ background: checked ? "var(--edge)" : "var(--surface-2)", border: "var(--bw) solid var(--edge)" }}><span className="absolute top-[2px] h-[19px] w-[19px] rounded-full bg-white transition-transform" style={{ left: 2, transform: `translateX(${checked ? 20 : 0}px)`, border: "1px solid var(--edge)" }} /></button>;
}

function Rating({ value, onChange }: { value: number | null; onChange: (value: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between"><p className="t-cap font-bold">Оценка встречи</p><span className="chip chip-strong">{value ? `${value}/10` : "—"}</span></div>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => <button key={score} type="button" onClick={() => { tap(); onChange(score); }} className={`flex h-8 items-center justify-center rounded-[9px] text-[11px] font-black ${value === score ? "bg-[var(--edge)] text-white" : "bg-[var(--head-soft)] text-[var(--ink)]"}`} aria-pressed={value === score}>{score}</button>)}
      </div>
    </div>
  );
}

function MeetingDynamics({ meetings, reflections }: { meetings: Meeting[]; reflections: SessionReflection[] }) {
  const points = [...reflections].filter((item) => item.feeling).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(-8);
  const completed = meetings.filter((meeting) => meeting.status === "done" || new Date(meeting.startsAt).getTime() < Date.now()).length;
  const latest = points.at(-1)?.feeling ?? null;
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3"><div><p className="t-head">Динамика встреч</p><p className="t-cap mt-0.5">{completed} встреч · {points.length} оценок</p></div>{latest && <span className="chip chip-strong">Сейчас {latest}/10</span>}</div>
      {points.length >= 2 ? <TrendChart points={points} /> : <div className="card-nested mt-3 p-3 text-center"><p className="t-cap">График появится после двух оценённых встреч.</p></div>}
    </div>
  );
}

function TrendChart({ points }: { points: SessionReflection[] }) {
  const coords = points.map((item, index) => ({ x: points.length === 1 ? 120 : 8 + index * (224 / (points.length - 1)), y: 66 - ((item.feeling ?? 1) - 1) * (52 / 9), value: item.feeling ?? 1 }));
  return (
    <div className="card-nested mt-3 px-2 pb-2 pt-3">
      <svg viewBox="0 0 240 76" className="h-[92px] w-full" role="img" aria-label="График оценок встреч от 1 до 10">
        <path d="M8 14H232 M8 40H232 M8 66H232" fill="none" stroke="var(--edge-neutral)" strokeWidth="1" strokeDasharray="4 4" />
        <polyline points={coords.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="var(--edge)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point, index) => <g key={`${point.x}-${index}`}><circle cx={point.x} cy={point.y} r="4" fill="var(--edge)" /><text x={point.x} y={Math.max(10, point.y - 7)} textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--ink)">{point.value}</text></g>)}
      </svg>
      <div className="flex justify-between"><span className="t-micro">РАНЬШЕ</span><span className="t-micro">СЕЙЧАС</span></div>
    </div>
  );
}

function ReflectionHistory({ reflections, empty = "Сохранённые заметки появятся здесь." }: { reflections: SessionReflection[]; empty?: string }) {
  const history = [...reflections].filter((item) => item.preparation || item.takeaway || item.feeling).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><p className="t-head">История заметок</p><span className="chip">{history.length}</span></div>
      {history.length === 0 ? <p className="t-cap">{empty}</p> : <div className="space-y-3">{history.map((item, index) => (
        <article key={item.appointmentId} className={index ? "line-top pt-3" : ""}>
          <div className="flex items-center justify-between gap-3"><p className="t-sub font-bold capitalize">{sessionDate.format(new Date(item.startsAt))} · {item.therapistName.split(" ")[0]}</p>{item.feeling && <span className="chip chip-strong">{item.feeling}/10</span>}</div>
          {item.preparation && <div className="mt-2"><p className="t-micro">ХОТЕЛОСЬ ОБСУДИТЬ</p><p className="t-body mt-0.5 whitespace-pre-wrap">{item.preparation}</p></div>}
          {item.takeaway && <div className="mt-2 rounded-[var(--r-sm)] bg-[var(--head-soft)] p-3"><p className="t-micro">ВПЕЧАТЛЕНИЯ ПОСЛЕ</p><p className="t-body mt-0.5 whitespace-pre-wrap">{item.takeaway}</p></div>}
        </article>
      ))}</div>}
    </div>
  );
}
