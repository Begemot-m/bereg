"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Who5Flow } from "@/components/balance-flow";
import { Icon } from "@/components/icons";
import { WellbeingCard } from "@/components/wellbeing-card";
import { Button, Disclosure, SkeletonRow, Textarea } from "@/components/ui";
import { listMyBookings, type MyBooking, type Mood } from "@/lib/clients";
import { getMyTherapy, updateMyTherapy, type TherapyState } from "@/lib/therapy";
import { select, success, tap } from "@/lib/haptics";

type TherapyTask = { id: number; text: string; done: boolean };
const TASK_KEY = "bereg_therapy_tasks";
const DEFAULT_TASKS: TherapyTask[] = [
  { id: 1, text: "Отмечать уровень тревоги вечером", done: true },
  { id: 2, text: "Записать три автоматические мысли", done: false },
  { id: 3, text: "Практика дыхания — 5 минут", done: false },
];
const dateTime = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default function TherapyPage() {
  const qc = useQueryClient();
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings });
  const { data: therapy, isLoading: therapyLoading } = useQuery({ queryKey: ["my-therapy"], queryFn: getMyTherapy });
  const ordered = useMemo(() => [...bookings].sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [bookings]);
  const next = ordered.find((item) => new Date(item.startsAt) > new Date()) ?? null;
  const therapist = next?.psyName ?? ordered.at(-1)?.psyName ?? null;
  const save = useMutation({ mutationFn: updateMyTherapy, onSuccess: (state) => qc.setQueryData(["my-therapy"], state) });

  if (bookingsLoading || therapyLoading) return <div className="space-y-3 py-8"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>;
  if (!therapist || !therapy) return <EmptyTherapy />;
  return <TherapyDashboard therapist={therapist} next={next} bookings={ordered} therapy={therapy} onMood={(mood) => save.mutate({ mood })} onGuideSeen={() => save.mutate({ tutorialSeen: true })} onWho5={(answers) => save.mutate({ who5: answers })} />;
}

function TherapyDashboard({ therapist, next, bookings, therapy, onMood, onGuideSeen, onWho5 }: { therapist: string; next: MyBooking | null; bookings: MyBooking[]; therapy: TherapyState; onMood: (mood: number) => void; onGuideSeen: () => void; onWho5: (answers: number[]) => void }) {
  const [tab, setTab] = useState<"общее" | "терапевт">("общее");
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => { const raw = localStorage.getItem(TASK_KEY); if (raw) try { setTasks(JSON.parse(raw)); } catch { localStorage.removeItem(TASK_KEY); } }, []);
  const toggleTask = (id: number) => { select(); setTasks((cur) => { const nextTasks = cur.map((t) => t.id === id ? { ...t, done: !t.done } : t); localStorage.setItem(TASK_KEY, JSON.stringify(nextTasks)); return nextTasks; }); };
  const done = tasks.filter((t) => t.done).length;
  const taskProgress = Math.round(done / tasks.length * 100);
  const completedSessions = bookings.filter((b) => new Date(b.startsAt) < new Date()).length;
  const todayMood = [...therapy.moods].reverse().find((e) => e.date.slice(0, 10) === new Date().toISOString().slice(0, 10))?.mood;
  const startFlow = () => { tap(); setShowGuide(!therapy.tutorialSeen); setFlowOpen(true); };

  return (
    <div className="-mx-4 -mt-2 @md:-mx-9">
      <header className="relative overflow-hidden bg-[var(--purple)] px-4 pb-16 pt-7 @md:px-9" style={{ borderBottom: "var(--bw-lg) solid var(--purple-edge)" }}>
        <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[.16em]">Между встречами</span><span className="rounded-full bg-[#fffdf7] px-3 py-1 text-[10px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>ТЕРАПИЯ</span></div>
        <h1 className="font-tight mt-2 text-center text-[21px] font-black uppercase tracking-[.02em]">Моя терапия</h1>
        <div className="mt-5 flex items-center gap-3 rounded-[20px] bg-[#fffdf7] p-3" style={{ border: "var(--bw-lg) solid var(--purple-edge)" }}>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[15px] bg-[var(--green)] text-[20px] font-black" style={{ border: "var(--bw) solid var(--green-edge)" }}>{therapist.charAt(0)}</div>
          <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Ваш терапевт</p><p className="truncate text-[16px] font-black">{therapist}</p><p className="mt-0.5 truncate text-[11px] font-bold text-[var(--muted)]">{next ? `${dateTime.format(new Date(next.startsAt))} · ${next.format === "online" ? "онлайн" : "очно"}` : "встреча пока не назначена"}</p></div>
          <Link href="/sessions" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--amber)]" style={{ border: "var(--bw) solid var(--amber-edge)" }} aria-label="Перейти к сессиям"><Icon name="calendar" width={17} weight="bold" /></Link>
        </div>
      </header>

      <main className="relative -mt-9 rounded-t-[30px] bg-[#fffaf0] px-4 pb-8 pt-5 @md:px-9" style={{ borderTop: "var(--bw-lg) solid var(--edge-neutral)" }}>
        <Segmented tab={tab} onChange={setTab} />

        {tab === "общее" ? (
          <div className="mt-4 space-y-3">
            <WellbeingCard who5={therapy.who5} onStart={startFlow} subtitle="видно вашему терапевту" />
            <section className="rounded-[22px] bg-[var(--amber)] p-4" style={{ border: "var(--bw-lg) solid var(--amber-edge)" }}>
              <div className="flex items-center gap-2"><Icon name="mood" width={21} weight="bold" /><h2 className="text-[13px] font-black uppercase tracking-[.06em]">Как вы сегодня?</h2></div>
              <div className="mt-3 grid grid-cols-5 gap-1.5">{[1,2,3,4,5].map((mood) => <button key={mood} onClick={() => { success(); onMood(mood); }} className="flex aspect-square items-center justify-center rounded-[13px] text-[14px] font-black" style={{ background: todayMood === mood ? "var(--ink)" : `var(--mood-${mood})`, color: todayMood === mood ? "#fff" : "var(--ink)", border: `var(--bw) solid ${todayMood === mood ? "var(--ink)" : "rgba(32,28,24,.4)"}` }}>{mood}</button>)}</div>
              <MoodBars moods={therapy.moods.slice(-7)} />
              <p className="mt-3 text-[10px] font-semibold text-[var(--muted)]">Ежедневная отметка настроения · общая, не привязана к терапевту</p>
            </section>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <section className="rounded-[22px] bg-[var(--green-soft)] p-4" style={{ border: "var(--bw-lg) solid var(--green-edge)" }}>
              <p className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Прогресс с терапевтом</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Metric value={`${completedSessions}`} label="встреч" edge="var(--green-edge)" />
                <Metric value={`${taskProgress}%`} label="заданий" edge="var(--coral-edge)" bg="var(--coral-soft)" />
                <Metric value={next ? "1" : "0"} label="впереди" edge="var(--amber-edge)" bg="var(--amber-soft)" />
              </div>
              <p className="mt-3 text-[10px] font-semibold text-[var(--muted)]">{next ? `Ближайшая: ${dateTime.format(new Date(next.startsAt))}` : "Новая встреча пока не назначена"}</p>
            </section>

            <section className="rounded-[22px] bg-[#fffdf7] p-4" style={{ border: "var(--bw-lg) solid var(--edge-neutral)" }}>
              <div className="flex items-center justify-between"><h2 className="text-[13px] font-black uppercase tracking-[.06em]">Задания от терапевта</h2><span className="text-[11px] font-black">{done}/{tasks.length}</span></div>
              <div className="mt-3 space-y-1.5">
                {tasks.map((task) => (
                  <button key={task.id} onClick={() => toggleTask(task.id)} className="flex w-full items-center gap-2 rounded-[13px] bg-white p-2 text-left" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px]" style={{ background: task.done ? "var(--green)" : "#fff", border: `var(--bw) solid ${task.done ? "var(--green-edge)" : "var(--edge-neutral)"}` }}><Icon name="check" width={15} weight={task.done ? "fill" : "regular"} /></span>
                    <span className={task.done ? "text-[12px] font-bold leading-tight line-through opacity-55" : "text-[12px] font-bold leading-tight"}>{task.text}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-[22px] bg-[#fffdf7]" style={{ border: "var(--bw-lg) solid var(--edge-neutral)" }}>
              <div className="flex gap-2 p-3"><Button className="flex-1" onClick={() => { tap(); setMessageOpen(!messageOpen); setSent(false); }}>Написать терапевту</Button><Link href="/sessions"><Button variant="soft">Сессии</Button></Link></div>
              <Disclosure open={messageOpen}><div className="border-t p-3" style={{ borderColor: "var(--edge-neutral)" }}>{sent ? <div className="rounded-[14px] bg-[var(--green-soft)] p-3 text-[12px] font-bold" style={{ border: "var(--bw) solid var(--green-edge)" }}>Сообщение сохранено для терапевта.</div> : <div className="space-y-2"><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Коротко опишите, что хотите обсудить" /><div className="flex justify-end"><Button size="sm" disabled={!message.trim()} onClick={() => { success(); setSent(true); setMessage(""); }}>Отправить</Button></div></div>}</div></Disclosure>
            </section>
          </div>
        )}
      </main>
      {flowOpen && <Who5Flow guide={showGuide} onClose={() => setFlowOpen(false)} onGuideSeen={onGuideSeen} onSave={onWho5} />}
    </div>
  );
}

function Segmented({ tab, onChange }: { tab: "общее" | "терапевт"; onChange: (t: "общее" | "терапевт") => void }) {
  const items: { key: "общее" | "терапевт"; label: string }[] = [{ key: "общее", label: "Общее" }, { key: "терапевт", label: "С терапевтом" }];
  return (
    <div className="flex gap-1 rounded-full bg-white p-1" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
      {items.map((it) => (
        <button key={it.key} onClick={() => { tap(); onChange(it.key); }} className="flex-1 rounded-full py-2 text-[13px] font-black transition-colors" style={tab === it.key ? { background: "var(--ink)", color: "#fff" } : { color: "var(--muted)" }}>{it.label}</button>
      ))}
    </div>
  );
}

function Metric({ value, label, edge, bg = "var(--green-soft)" }: { value: string; label: string; edge: string; bg?: string }) {
  return <div className="rounded-[15px] p-2.5 text-center" style={{ background: bg, border: `var(--bw) solid ${edge}` }}><p className="font-tight tnum text-[20px] font-black leading-none">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[.05em]">{label}</p></div>;
}

function MoodBars({ moods }: { moods: Mood[] }) {
  const day = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
  return <div className="mt-4 flex h-20 items-end gap-1.5">{moods.map((entry, index) => <div key={`${entry.date}-${index}`} className="flex flex-1 flex-col items-center justify-end gap-1"><div className="w-full rounded-t-[8px]" style={{ height: `${15 + entry.mood * 9}px`, background: `var(--mood-${entry.mood})`, border: `var(--bw) solid color-mix(in srgb, var(--mood-${entry.mood}) 62%, var(--ink))`, borderBottom: "none" }} /><span className="text-[8px] font-black uppercase">{day.format(new Date(entry.date)).slice(0,2)}</span></div>)}</div>;
}

function EmptyTherapy() { return <div className="mx-auto max-w-sm py-8 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[var(--purple-soft)]" style={{ border: "var(--bw) solid var(--purple-edge)" }}><Icon name="heart" width={28} weight="fill" /></div><h2 className="font-tight mt-4 text-2xl font-extrabold">Здесь появится ваша терапия</h2><p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-[var(--muted)]">После записи здесь будут встречи, задания и ваш прогресс между сессиями.</p><Link href="/" className="mt-5 inline-block"><Button arrow>Найти терапевта на главной</Button></Link></div>; }
