"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { BalanceBars } from "@/components/balance-bars";
import { BalanceFlow } from "@/components/balance-flow";
import { Icon } from "@/components/icons";
import { Button, Disclosure, SkeletonRow, Textarea } from "@/components/ui";
import { listMyBookings, type MyBooking, type Mood } from "@/lib/clients";
import { balanceAverage, getMyTherapy, updateMyTherapy, type BalanceScores } from "@/lib/therapy";
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
  return <TherapyDashboard therapist={therapist} next={next} bookings={ordered} therapy={therapy} onMood={(mood) => save.mutate({ mood })} onGuideSeen={() => save.mutate({ tutorialSeen: true })} onBalance={(balance) => save.mutate({ balance })} />;
}

function TherapyDashboard({ therapist, next, bookings, therapy, onMood, onGuideSeen, onBalance }: { therapist: string; next: MyBooking | null; bookings: MyBooking[]; therapy: Awaited<ReturnType<typeof getMyTherapy>>; onMood: (mood: number) => void; onGuideSeen: () => void; onBalance: (scores: BalanceScores) => void }) {
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => { const raw = localStorage.getItem(TASK_KEY); if (raw) try { setTasks(JSON.parse(raw)); } catch { localStorage.removeItem(TASK_KEY); } }, []);
  const toggleTask = (id: number) => { select(); setTasks((current) => { const nextTasks = current.map((task) => task.id === id ? { ...task, done: !task.done } : task); localStorage.setItem(TASK_KEY, JSON.stringify(nextTasks)); return nextTasks; }); };
  const done = tasks.filter((task) => task.done).length;
  const taskProgress = Math.round(done / tasks.length * 100);
  const completedSessions = bookings.filter((booking) => new Date(booking.startsAt) < new Date()).length;
  const balancePct = balanceAverage(therapy.balance);
  const todayMood = [...therapy.moods].reverse().find((entry) => entry.date.slice(0, 10) === new Date().toISOString().slice(0, 10))?.mood;
  const launchBalance = () => { tap(); setShowGuide(!therapy.tutorialSeen); setBalanceOpen(true); };

  return (
    <div className="-mx-4 -mt-6 @md:-mx-9">
      <header className="relative overflow-hidden bg-[var(--purple)] px-4 pb-16 pt-7 @md:px-9" style={{ borderBottom: "var(--bw-lg) solid var(--purple-edge)" }}>
        <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[.16em]">Между встречами</span><span className="rounded-full bg-[#fffdf7] px-3 py-1 text-[10px] font-black stroke">ТЕРАПИЯ</span></div>
        <h1 className="font-tight mt-2 text-center text-[21px] font-black uppercase tracking-[.02em]">Моя терапия</h1>
        <WeekStrip />
        <div className="mt-5 flex items-center gap-3 rounded-[20px] bg-[#fffdf7] p-3 stroke-lg">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[15px] bg-[var(--green)] text-[20px] font-black stroke">{therapist.charAt(0)}</div>
          <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Ваш терапевт</p><p className="truncate text-[16px] font-black">{therapist}</p><p className="mt-0.5 truncate text-[11px] font-bold text-[var(--muted)]">{next ? `${dateTime.format(new Date(next.startsAt))} · ${next.format === "online" ? "онлайн" : "очно"}` : "встреча пока не назначена"}</p></div>
          <Link href="/sessions" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--amber)] stroke" aria-label="Перейти к сессиям"><Icon name="calendar" width={17} weight="bold" /></Link>
        </div>
      </header>

      <main className="relative -mt-9 rounded-t-[30px] bg-[#fffaf0] px-4 pb-8 pt-5 @md:px-9" style={{ borderTop: "var(--bw-lg) solid var(--edge-neutral)" }}>
        <section className="rounded-[22px] bg-[#fffdf7] p-4 stroke-lg">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Баланс сфер</p><div className="mt-1 flex items-end gap-2"><span className="font-tight tnum text-[38px] font-black leading-none">{therapy.balance ? `${balancePct}%` : "—"}</span><span className="pb-1 text-[10px] font-black uppercase leading-tight">общая<br />оценка</span></div></div><button onClick={launchBalance} className="relative flex h-14 w-14 items-center justify-center rounded-[18px] bg-[var(--purple)] stroke-lg" aria-label={therapy.balance ? "Обновить колесо баланса" : "Пройти колесо баланса"}><Icon name="balance" width={28} weight="bold" />{!therapy.balance && <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--coral)] text-[17px] font-black stroke">!</span>}</button></div>
          <div className="mt-3 h-4 overflow-hidden rounded-full bg-white stroke"><div className="h-full bg-[var(--purple)] transition-[width] duration-700" style={{ width: `${Math.max(therapy.balance ? 4 : 0, balancePct)}%`, borderRight: therapy.balance ? "var(--bw) solid var(--purple-edge)" : 0 }} /></div>
          <div className="mt-3 grid grid-cols-3 gap-2"><Metric value={`${completedSessions}`} label="встреч" color="var(--green-soft)" /><Metric value={`${taskProgress}%`} label="заданий" color="var(--coral-soft)" /><Metric value={todayMood ? `${todayMood}/5` : "—"} label="сегодня" color="var(--amber-soft)" /></div>
        </section>

        <div className="mt-3 grid grid-cols-1 gap-3 @md:grid-cols-2">
          <section className="rounded-[22px] bg-[var(--amber)] p-4 stroke-lg" style={{ borderColor: "var(--amber-edge)" }}>
            <div className="flex items-center gap-2"><Icon name="mood" width={21} weight="bold" /><h2 className="text-[13px] font-black uppercase tracking-[.06em]">Как вы сегодня?</h2></div>
            <div className="mt-3 grid grid-cols-5 gap-1.5">{[1,2,3,4,5].map((mood) => <button key={mood} onClick={() => { success(); onMood(mood); }} className="flex aspect-square items-center justify-center rounded-[13px] text-[14px] font-black stroke" style={{ background: todayMood === mood ? "var(--ink)" : `var(--mood-${mood})`, color: todayMood === mood ? "#fff" : "var(--ink)" }}>{mood}</button>)}</div>
            <MoodBars moods={therapy.moods.slice(-7)} />
          </section>
          <section className="rounded-[22px] bg-[var(--green-soft)] p-4 stroke-lg" style={{ borderColor: "var(--green-edge)" }}>
            <div className="flex items-center justify-between"><h2 className="text-[13px] font-black uppercase tracking-[.06em]">Задания</h2><span className="text-[11px] font-black">{done}/{tasks.length}</span></div>
            <div className="mt-2 space-y-1.5">
              {tasks.map((task) => (
                <button key={task.id} onClick={() => toggleTask(task.id)} className="flex w-full items-center gap-2 rounded-[13px] bg-[#fffdf7] p-2 text-left stroke">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] stroke" style={{ background: task.done ? "var(--green)" : "#fff" }}><Icon name="check" width={15} weight={task.done ? "fill" : "regular"} /></span>
                  <span className={task.done ? "text-[11px] font-bold leading-tight line-through opacity-55" : "text-[11px] font-bold leading-tight"}>{task.text}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-3 rounded-[22px] bg-[#fffdf7] p-4 stroke-lg">
          <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><Icon name="balance" width={21} weight="bold" /><h2 className="text-[13px] font-black uppercase tracking-[.06em]">Колесо баланса</h2></div><button onClick={launchBalance} className="rounded-full bg-[var(--purple-soft)] px-3 py-1 text-[10px] font-black stroke">{therapy.balance ? "Обновить" : "Пройти тест"}</button></div>
          {therapy.balance ? <><BalanceBars balance={therapy.balance} /><p className="mt-3 text-[10px] font-semibold text-[var(--muted)]">Самооценка за последние две недели · видна вашему терапевту</p></> : <button onClick={launchBalance} className="w-full rounded-[16px] bg-[var(--purple-soft)] p-4 text-left stroke"><p className="text-[15px] font-black">Собрать первую карту</p><p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">8 коротких вопросов · около 2 минут</p></button>}
        </section>

        <section className="mt-3 overflow-hidden rounded-[22px] bg-[#fffdf7] stroke-lg"><div className="flex gap-2 p-3"><Button className="flex-1" onClick={() => { tap(); setMessageOpen(!messageOpen); setSent(false); }}>Написать терапевту</Button><Link href="/sessions"><Button variant="soft">Сессии</Button></Link></div><Disclosure open={messageOpen}><div className="border-t p-3" style={{ borderColor: "var(--edge-neutral)" }}>{sent ? <div className="rounded-[14px] bg-[var(--green-soft)] p-3 text-[12px] font-bold stroke">Сообщение сохранено для терапевта.</div> : <div className="space-y-2"><Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder="Коротко опишите, что хотите обсудить" /><div className="flex justify-end"><Button size="sm" disabled={!message.trim()} onClick={() => { success(); setSent(true); setMessage(""); }}>Отправить</Button></div></div>}</div></Disclosure></section>
      </main>
      {balanceOpen && <BalanceFlow guide={showGuide} onClose={() => setBalanceOpen(false)} onGuideSeen={onGuideSeen} onSave={onBalance} />}
    </div>
  );
}

function WeekStrip() { const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - 3); const day = new Intl.DateTimeFormat("ru-RU", { weekday: "short" }); return <div className="mt-5 grid grid-cols-7 gap-1">{Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); const active = date.toDateString() === now.toDateString(); return <div key={index} className="flex flex-col items-center gap-1"><span className="text-[9px] font-black uppercase text-[var(--muted)]">{day.format(date).slice(0,2)}</span><span className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black stroke" style={active ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { borderColor: "transparent" }}>{date.getDate()}</span></div>; })}</div>; }
function Metric({ value, label, color }: { value: string; label: string; color: string }) { return <div className="rounded-[15px] p-2.5 text-center stroke" style={{ background: color }}><p className="font-tight tnum text-[20px] font-black leading-none">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[.05em]">{label}</p></div>; }
function MoodBars({ moods }: { moods: Mood[] }) { const day = new Intl.DateTimeFormat("ru-RU", { weekday: "short" }); return <div className="mt-4 flex h-20 items-end gap-1.5">{moods.map((entry, index) => <div key={`${entry.date}-${index}`} className="flex flex-1 flex-col items-center justify-end gap-1"><div className="w-full rounded-t-[8px] border border-[rgba(32,28,24,.5)] border-b-0" style={{ height: `${15 + entry.mood * 9}px`, background: `var(--mood-${entry.mood})` }} /><span className="text-[8px] font-black uppercase">{day.format(new Date(entry.date)).slice(0,2)}</span></div>)}</div>; }
function EmptyTherapy() { return <div className="mx-auto max-w-sm py-8 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[var(--purple-soft)] stroke"><Icon name="heart" width={28} weight="fill" /></div><h2 className="font-tight mt-4 text-2xl font-extrabold">Здесь появится ваша терапия</h2><p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-[var(--muted)]">После записи здесь будут встречи, задания и ваш прогресс между сессиями.</p><Link href="/" className="mt-5 inline-block"><Button arrow>Найти терапевта на главной</Button></Link></div>; }
