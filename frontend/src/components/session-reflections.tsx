"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Arrow, ArrowGlyph } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Disclosure, Textarea } from "@/components/ui";
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
  const latest = [...reflections].filter((item) => item.feeling).sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
  if (!module.enabled) return <div data-accent="tiffany"><ClientModuleControl module={module} saving={saving} onChange={onModuleChange} /></div>;
  return (
    <div data-accent="tiffany" className="card-soft p-3">
      <Link href="/therapy/notes" onClick={tap} className="card-plain flex items-center gap-3 p-3">
        <span className="ico ico-accent h-11 w-11 shrink-0"><Icon name="note" width={20} weight="bold" /></span>
        <div className="min-w-0 flex-1"><p className="t-head">Заметки</p><p className="t-cap mt-0.5">{reflections.length ? `${reflections.length} записей · последняя оценка ${latest?.feeling ?? "—"}/10` : "Подготовка и итоги встреч"}</p></div>
        <Arrow />
      </Link>
    </div>
  );
}

export function ClientNotesDetail({ meetings, reflections, module, saving, onSave, onModuleChange }: {
  meetings: Meeting[];
  reflections: SessionReflection[];
  module: NotesModuleState;
  saving?: boolean;
  onSave: (patch: ReflectionPatch) => void;
  onModuleChange: (patch: { enabled?: boolean; shared?: boolean }) => void;
}) {
  const current = useMemo(() => {
    const active = meetings.filter((meeting) => meeting.status !== "cancelled");
    const past = active.filter((meeting) => new Date(meeting.startsAt).getTime() < Date.now()).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    const awaitingCheckin = past.find((meeting) => !reflections.find((item) => item.appointmentId === meeting.id)?.feeling);
    const next = active.filter((meeting) => new Date(meeting.startsAt).getTime() >= Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    return awaitingCheckin ?? next ?? past[0] ?? null;
  }, [meetings, reflections]);
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
    <section data-accent="tiffany" className="space-y-3">
      <ClientModuleControl module={module} saving={saving} onChange={onModuleChange} />

      {module.enabled && (
        <>
          <NotesSummary meetings={meetings} reflections={reflections} />
          {current ? (
            <SessionNoteEditor current={current} upcoming={upcoming} saved={Boolean(reflection)} preparation={preparation} takeaway={takeaway} rating={rating} saving={saving} onPreparation={setPreparation} onTakeaway={setTakeaway} onRating={setRating} onSave={save} />
          ) : <div className="card p-4 text-center"><p className="t-head">Встреч пока нет</p><p className="t-cap mt-1">После записи здесь появятся заметки к сессии.</p></div>}

          <MeetingDynamics meetings={meetings} reflections={reflections} />
          <ReflectionHistory reflections={reflections} />
        </>
      )}
    </section>
  );
}

export function PsychologistSessionJourney({ meetings, reflections, module, saving, onToggle, href }: {
  meetings: Meeting[];
  reflections: SessionReflection[];
  module: NotesModuleState;
  saving?: boolean;
  onToggle: () => void | Promise<unknown>;
  href: string;
}) {
  const router = useRouter();
  if (!module.psychologistEnabled) {
    return (
      <div data-accent="tiffany" className="rounded-[var(--r-block)] bg-[var(--head-soft)] p-4" style={{ border: "2.5px dashed var(--edge)" }}>
        <div className="flex items-start gap-3">
          <span className="ico ico-accent h-10 w-10 shrink-0"><Icon name="note" width={19} weight="bold" /></span>
          <div className="min-w-0 flex-1"><p className="t-title">Подключить модуль «Заметки»</p><p className="t-cap mt-1">Помогает сохранять контекст между встречами.</p></div>
        </div>
        <div className="card-nested mt-3 space-y-2 p-3">
          <ModuleBenefit text="Темы, которые клиент хочет обсудить" />
          <ModuleBenefit text="Впечатления и оценка после сессии" />
          <ModuleBenefit text="История и график динамики встреч" />
        </div>
        <button disabled={saving} onClick={async () => { await onToggle(); router.push(href); }} className="btn btn-accent mt-3 w-full py-2">Подключить</button>
      </div>
    );
  }
  return (
    <div data-accent="tiffany" className="card-soft p-3">
      <Link href={href} onClick={tap} className="card-plain flex items-center gap-3 p-3">
        <span className="ico ico-accent h-11 w-11 shrink-0"><Icon name="note" width={20} weight="bold" /></span>
        <div className="min-w-0 flex-1"><p className="t-head">Заметки</p><p className="t-cap mt-0.5">{module.shared ? `${reflections.length} записей · история встреч` : "Клиент пока ведёт записи лично"}</p></div>
        <Arrow />
      </Link>
    </div>
  );
}

export function PsychologistNotesDetail({ meetings, reflections, module, saving, onToggle }: {
  meetings: Meeting[];
  reflections: SessionReflection[];
  module: NotesModuleState;
  saving?: boolean;
  onToggle: () => void;
}) {
  if (!module.psychologistEnabled) return <div className="rounded-[var(--r-block)] bg-[var(--head-soft)] p-4" style={{ border: "2.5px dashed var(--edge)" }}><div className="flex items-start gap-3"><span className="ico ico-accent h-10 w-10 shrink-0"><Icon name="note" width={19} weight="bold" /></span><div className="min-w-0 flex-1"><p className="t-title">Модуль «Заметки» отключён</p><p className="t-cap mt-1">Подключите его, чтобы снова видеть переданные записи клиента.</p></div></div><button disabled={saving} onClick={onToggle} className="btn btn-accent mt-3 w-full py-2">Подключить</button></div>;
  return (
    <section data-accent="tiffany" className="space-y-3">
      <div className="card flex items-center gap-3 p-4"><span className="ico ico-accent h-10 w-10 shrink-0"><Icon name="note" width={19} weight="bold" /></span><div className="min-w-0 flex-1"><p className="t-title">Заметки</p><p className="t-cap mt-0.5">Модуль подключён у вас и клиента</p></div><button disabled={saving} onClick={onToggle} className="btn btn-white shrink-0 px-3 py-1.5 text-[11px]">Отключить</button></div>
      {!module.shared && <div className="card-soft p-4"><p className="t-head">Клиент ведёт заметки лично</p><p className="t-cap mt-1">Когда клиент включит передачу, записи появятся здесь автоматически.</p></div>}
      {module.shared && <>{!module.enabled && <div className="card-soft p-4"><p className="t-head">Модуль приостановлен клиентом</p><p className="t-cap mt-1">Сохранённая история остаётся доступной.</p></div>}<NotesSummary meetings={meetings} reflections={reflections} /><MeetingDynamics meetings={meetings} reflections={reflections} /><ReflectionHistory reflections={reflections} empty="Клиент пока не сохранил заметок к встречам." /></>}
    </section>
  );
}

function NotesSummary({ meetings, reflections }: { meetings: Meeting[]; reflections: SessionReflection[] }) {
  const held = meetings.filter((meeting) => meeting.status === "done" || new Date(meeting.startsAt).getTime() < Date.now()).length;
  const scores = reflections.flatMap((item) => item.feeling ? [item.feeling] : []);
  const average = scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1) : "—";
  return <div className="card-soft grid grid-cols-3 gap-2 p-3"><SummaryStat value={held} label="встреч" /><SummaryStat value={reflections.length} label="заметок" /><SummaryStat value={average} label="средняя оценка" /></div>;
}

function SummaryStat({ value, label }: { value: string | number; label: string }) {
  return <div className="card-nested p-2 text-center"><p className="tnum text-[20px] font-black">{value}</p><p className="t-micro mt-1">{label}</p></div>;
}

function ClientModuleControl({ module, saving, onChange }: { module: NotesModuleState; saving?: boolean; onChange: (patch: { enabled?: boolean; shared?: boolean }) => void }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className="ico ico-accent h-10 w-10 shrink-0"><Icon name="note" width={19} weight="bold" /></span>
        <div className="min-w-0 flex-1"><p className="t-title">Заметки</p><p className="t-cap mt-0.5">{module.enabled ? "Темы и впечатления от встреч" : "Модуль сейчас отключён"}</p></div>
        <button disabled={saving} onClick={() => onChange({ enabled: !module.enabled })} className={module.enabled ? "btn btn-white shrink-0 px-3 py-1.5 text-[11px]" : "btn btn-accent shrink-0 px-3 py-1.5 text-[11px]"}>{module.enabled ? "Отключить" : "Включить"}</button>
      </div>
      {module.enabled && (
        <div className="card-nested mt-3 p-1">
          <div className="grid grid-cols-2 gap-1">
            <button disabled={saving} onClick={() => onChange({ shared: false })} className={`rounded-[10px] px-2 py-2 text-[11px] font-black ${!module.shared ? "bg-[var(--edge)] text-white" : "text-[var(--muted)]"}`}>Только мне</button>
            <button disabled={saving} onClick={() => onChange({ shared: true })} className={`rounded-[10px] px-2 py-2 text-[11px] font-black ${module.shared ? "bg-[var(--edge)] text-white" : "text-[var(--muted)]"}`}>Психологу</button>
          </div>
          <p className="t-cap px-2 pb-1 pt-2 text-center">{module.shared ? module.psychologistEnabled ? "Записи видит ваш психолог" : "Передача начнётся после подключения психолога" : "Записи остаются только у вас"}</p>
        </div>
      )}
    </div>
  );
}

function ModuleBenefit({ text }: { text: string }) {
  return <div className="flex items-center gap-2"><Icon name="check" width={14} weight="bold" color="var(--edge)" /><span className="t-body">{text}</span></div>;
}

function SessionNoteEditor({ current, upcoming, saved, preparation, takeaway, rating, saving, onPreparation, onTakeaway, onRating, onSave }: {
  current: Meeting;
  upcoming: boolean;
  saved: boolean;
  preparation: string;
  takeaway: string;
  rating: number | null;
  saving?: boolean;
  onPreparation: (value: string) => void;
  onTakeaway: (value: string) => void;
  onRating: (value: number) => void;
  onSave: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card p-3">
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-3 p-1 text-left" aria-expanded={open}>
        <span className="ico h-9 w-9 shrink-0"><Icon name="note" width={17} weight="bold" /></span>
        <div className="min-w-0 flex-1"><p className="t-head">{upcoming ? "К ближайшей встрече" : "Итог последней встречи"}</p><p className="t-cap mt-0.5 capitalize">{sessionDate.format(new Date(current.startsAt))}</p></div>
        {saved && <span className="chip chip-strong">Сохранено</span>}
        <span className="arrow transition-transform" style={{ transform: open ? "rotate(90deg)" : undefined }}><ArrowGlyph /></span>
      </button>
      <Disclosure open={open} autoScroll={false}>
        <div className="line-top mt-3 space-y-3 pt-3">
          <label className="block"><span className="t-cap mb-1.5 block font-bold">Что хочется обсудить</span><Textarea value={preparation} onChange={(event) => onPreparation(event.target.value)} rows={3} placeholder="Запишите важные темы или вопросы…" /></label>
          {!upcoming && <><label className="block"><span className="t-cap mb-1.5 block font-bold">Впечатления после сессии</span><Textarea value={takeaway} onChange={(event) => onTakeaway(event.target.value)} rows={3} placeholder="Что было важным, что хочется сохранить…" /></label><Rating value={rating} onChange={onRating} /></>}
          <button onClick={onSave} disabled={saving || (!preparation.trim() && !takeaway.trim() && !rating)} className="btn btn-accent w-full py-2">{saving ? "Сохраняем…" : "Сохранить заметку"}</button>
        </div>
      </Disclosure>
    </div>
  );
}

function Rating({ value, onChange }: { value: number | null; onChange: (value: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between"><p className="t-cap font-bold">Самочувствие после сессии</p><span className="chip chip-strong">{value ? `${value}/10` : "—"}</span></div>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => <button key={score} type="button" onClick={() => { tap(); onChange(score); }} className={`flex h-8 items-center justify-center rounded-[9px] text-[11px] font-black ${value === score ? "bg-[var(--edge)] text-white" : "bg-[var(--head-soft)] text-[var(--ink)]"}`} aria-pressed={value === score}>{score}</button>)}
      </div>
    </div>
  );
}

function MeetingDynamics({ meetings, reflections }: { meetings: Meeting[]; reflections: SessionReflection[] }) {
  const [open, setOpen] = useState(false);
  const points = [...reflections].filter((item) => item.feeling).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(-8);
  const completed = meetings.filter((meeting) => meeting.status === "done" || new Date(meeting.startsAt).getTime() < Date.now()).length;
  const latest = points.at(-1)?.feeling ?? null;
  return (
    <div className="card p-3">
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-3 p-1 text-left" aria-expanded={open}>
        <span className="ico h-9 w-9 shrink-0"><Icon name="chart" width={17} weight="bold" /></span>
        <div className="min-w-0 flex-1"><p className="t-head">Динамика встреч</p><p className="t-cap mt-0.5">{completed} встреч · {points.length} оценок</p></div>
        {latest && <span className="chip chip-strong">{latest}/10</span>}
        <span className="arrow transition-transform" style={{ transform: open ? "rotate(90deg)" : undefined }}><ArrowGlyph /></span>
      </button>
      <Disclosure open={open} autoScroll={false}>
        {points.length >= 2 ? <TrendChart points={points} /> : <div className="card-nested mt-3 p-3 text-center"><p className="t-cap">График появится после двух оценённых встреч.</p></div>}
      </Disclosure>
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
  const [open, setOpen] = useState(false);
  const history = [...reflections].filter((item) => item.preparation || item.takeaway || item.feeling).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return (
    <div className="card p-3">
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-3 p-1 text-left" aria-expanded={open}>
        <span className="ico h-9 w-9 shrink-0"><Icon name="note" width={17} weight="bold" /></span>
        <div className="min-w-0 flex-1"><p className="t-head">История заметок</p><p className="t-cap mt-0.5">Сохранено: {history.length}</p></div>
        <span className="arrow transition-transform" style={{ transform: open ? "rotate(90deg)" : undefined }}><ArrowGlyph /></span>
      </button>
      <Disclosure open={open} autoScroll={false}>
        <div className="line-top mt-3 pt-3">
          {history.length === 0 ? <p className="t-cap">{empty}</p> : <div className="space-y-3">{history.map((item, index) => (
            <article key={item.appointmentId} className={index ? "line-top pt-3" : ""}>
              <div className="flex items-center justify-between gap-3"><p className="t-sub font-bold capitalize">{sessionDate.format(new Date(item.startsAt))} · {item.therapistName.split(" ")[0]}</p>{item.feeling && <span className="chip chip-strong">{item.feeling}/10</span>}</div>
              {item.preparation && <div className="mt-2"><p className="t-micro">ХОТЕЛОСЬ ОБСУДИТЬ</p><p className="t-body mt-0.5 whitespace-pre-wrap">{item.preparation}</p></div>}
              {item.takeaway && <div className="mt-2 rounded-[var(--r-sm)] bg-[var(--head-soft)] p-3"><p className="t-micro">ВПЕЧАТЛЕНИЯ ПОСЛЕ</p><p className="t-body mt-0.5 whitespace-pre-wrap">{item.takeaway}</p></div>}
            </article>
          ))}</div>}
        </div>
      </Disclosure>
    </div>
  );
}
