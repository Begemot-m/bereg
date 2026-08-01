"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import { Textarea } from "@/components/ui";
import { tap } from "@/lib/haptics";
import type { ReflectionPatch, SessionReflection } from "@/lib/therapy";

type Meeting = { id: number; startsAt: string; status?: string; psyName?: string };

const sessionDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const FEELINGS = ["Тяжело", "Напряжённо", "Ровно", "Легче", "Яснее"];

export function ClientSessionJourney({ meetings, reflections, saving, onSave }: {
  meetings: Meeting[];
  reflections: SessionReflection[];
  saving?: boolean;
  onSave: (patch: ReflectionPatch) => void;
}) {
  const current = useMemo(() => {
    const active = meetings.filter((meeting) => meeting.status !== "cancelled");
    const next = active.filter((meeting) => new Date(meeting.startsAt).getTime() >= Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    return next ?? [...active].sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0] ?? null;
  }, [meetings]);
  const reflection = current ? reflections.find((item) => item.appointmentId === current.id) : undefined;
  const [preparation, setPreparation] = useState("");
  const [takeaway, setTakeaway] = useState("");
  const [feeling, setFeeling] = useState<number | null>(null);
  const upcoming = current ? new Date(current.startsAt).getTime() >= Date.now() : false;

  useEffect(() => {
    setPreparation(reflection?.preparation ?? "");
    setTakeaway(reflection?.takeaway ?? "");
    setFeeling(reflection?.feeling ?? null);
  }, [current?.id, reflection?.updatedAt]);

  const save = () => {
    if (!current) return;
    tap();
    onSave({ appointmentId: current.id, preparation, takeaway, feeling });
  };

  const completed = meetings.filter((meeting) => meeting.status === "done" || new Date(meeting.startsAt).getTime() < Date.now()).length;
  const filled = reflections.filter((item) => item.preparation || item.takeaway || item.feeling).length;
  const latestFeeling = [...reflections].sort((a, b) => b.startsAt.localeCompare(a.startsAt)).find((item) => item.feeling)?.feeling ?? null;

  return (
    <section className="space-y-3">
      <div className="card p-4">
        <div className="flex items-start gap-3">
          <span className="ico ico-accent h-11 w-11 shrink-0"><Icon name="note" width={21} weight="bold" /></span>
          <div className="min-w-0 flex-1">
            <p className="t-title">Мои встречи</p>
            <p className="t-cap mt-0.5">Подготовка и главное после сессии видны вашему психологу</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <JourneyStat value={completed} label="прошло" />
          <JourneyStat value={filled} label="сохранено" />
          <JourneyStat value={latestFeeling ? `${latestFeeling}/5` : "—"} label="после встречи" />
        </div>
      </div>

      {current ? (
        <div className="card-soft p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="t-micro">{upcoming ? "БЛИЖАЙШАЯ ВСТРЕЧА" : "ПОСЛЕДНЯЯ ВСТРЕЧА"}</p>
              <p className="t-head mt-0.5 capitalize">{sessionDate.format(new Date(current.startsAt))}</p>
            </div>
            <span className="chip chip-strong">{upcoming ? "Подготовка" : "Итог"}</span>
          </div>

          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="t-cap mb-1.5 block font-bold">Что хочу обсудить</span>
              <Textarea value={preparation} onChange={(event) => setPreparation(event.target.value)} rows={3} placeholder="Одна или несколько важных тем…" />
            </label>
            {!upcoming && (
              <>
                <label className="block">
                  <span className="t-cap mb-1.5 block font-bold">Что забираю после встречи</span>
                  <Textarea value={takeaway} onChange={(event) => setTakeaway(event.target.value)} rows={3} placeholder="Главная мысль, решение или наблюдение…" />
                </label>
                <div>
                  <p className="t-cap mb-1.5 font-bold">Как мне после встречи</p>
                  <div className="grid grid-cols-5 gap-1">
                    {FEELINGS.map((label, index) => {
                      const value = index + 1;
                      const selected = feeling === value;
                      return <button key={label} type="button" onClick={() => { tap(); setFeeling(value); }} className={selected ? "chip chip-strong h-9 justify-center px-1" : "chip h-9 justify-center px-1"} aria-label={label} aria-pressed={selected}>{value}</button>;
                    })}
                  </div>
                  <p className="t-cap mt-1.5 text-center">{feeling ? FEELINGS[feeling - 1] : "Выберите состояние от 1 до 5"}</p>
                </div>
              </>
            )}
            <button onClick={save} disabled={saving || (!preparation.trim() && !takeaway.trim() && !feeling)} className="btn btn-accent w-full">{saving ? "Сохраняем…" : "Сохранить"}</button>
          </div>
        </div>
      ) : (
        <div className="card-soft p-4 text-center"><p className="t-head">Встреч пока нет</p><p className="t-cap mt-1">После записи здесь появятся подготовка, итоги и история.</p></div>
      )}

      <ReflectionHistory reflections={reflections} />
    </section>
  );
}

export function PsychologistSessionJourney({ meetings, reflections }: { meetings: Meeting[]; reflections: SessionReflection[] }) {
  const completed = meetings.filter((meeting) => meeting.status === "done" || new Date(meeting.startsAt).getTime() < Date.now()).length;
  const latestFeeling = [...reflections].sort((a, b) => b.startsAt.localeCompare(a.startsAt)).find((item) => item.feeling)?.feeling ?? null;
  return (
    <div className="space-y-3">
      <div className="card grid grid-cols-3 gap-2 p-3">
        <JourneyStat value={completed} label="встреч" />
        <JourneyStat value={reflections.length} label="сохранений" />
        <JourneyStat value={latestFeeling ? `${latestFeeling}/5` : "—"} label="после встречи" />
      </div>
      <ReflectionHistory reflections={reflections} empty="Клиент пока ничего не сохранял к встречам." />
    </div>
  );
}

function JourneyStat({ value, label }: { value: number | string; label: string }) {
  return <div className="card-nested min-w-0 px-2 py-3 text-center"><p className="font-tight text-[22px] font-black leading-none">{value}</p><p className="t-micro mt-1 truncate normal-case tracking-normal">{label}</p></div>;
}

function ReflectionHistory({ reflections, empty = "Сохранённые подготовки и итоги появятся здесь." }: { reflections: SessionReflection[]; empty?: string }) {
  const history = [...reflections].filter((item) => item.preparation || item.takeaway || item.feeling).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><p className="t-head">История встреч</p><span className="chip">{history.length}</span></div>
      {history.length === 0 ? <p className="t-cap">{empty}</p> : (
        <div className="space-y-3">
          {history.map((item, index) => (
            <article key={item.appointmentId} className={index ? "line-top pt-3" : ""}>
              <div className="flex items-center justify-between gap-3">
                <p className="t-sub font-bold capitalize">{sessionDate.format(new Date(item.startsAt))} · {item.therapistName.split(" ")[0]}</p>
                {item.feeling && <span className="chip chip-strong">{item.feeling}/5</span>}
              </div>
              {item.preparation && <div className="mt-2"><p className="t-micro">К ВСТРЕЧЕ</p><p className="t-body mt-0.5 whitespace-pre-wrap">{item.preparation}</p></div>}
              {item.takeaway && <div className="mt-2 rounded-[var(--r-sm)] bg-[var(--head-soft)] p-3"><p className="t-micro">ПОСЛЕ ВСТРЕЧИ</p><p className="t-body mt-0.5 whitespace-pre-wrap">{item.takeaway}</p></div>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
