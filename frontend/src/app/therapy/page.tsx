"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageHead, SectionTitle } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Button, Card, Disclosure, SkeletonRow, Textarea } from "@/components/ui";
import { listMyBookings, type MyBooking } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";

type TherapyTask = { id: number; text: string; done: boolean };

const TASK_KEY = "bereg_therapy_tasks";
const DEFAULT_TASKS: TherapyTask[] = [
  { id: 1, text: "Отмечать уровень тревоги вечером", done: true },
  { id: 2, text: "Записать три автоматические мысли", done: false },
  { id: 3, text: "Практика дыхания — 5 минут", done: false },
];
const dateTime = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default function TherapyPage() {
  const { data: bookings = [], isLoading } = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings });
  const now = new Date();
  const ordered = useMemo(() => [...bookings].sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [bookings]);
  const next = ordered.find((item) => new Date(item.startsAt) > now) ?? null;
  const therapist = next?.psyName ?? ordered.at(-1)?.psyName ?? null;

  return (
    <div>
      <PageHead title="Терапия" sub="Ваше пространство между встречами">
        {isLoading ? <SkeletonRow /> : therapist ? <TherapistHead therapist={therapist} next={next} /> : null}
      </PageHead>

      <Reveal y={10}>
        <main className="-mx-4 min-h-[66vh] rounded-t-[30px] bg-[var(--surface)] px-4 pb-7 pt-5 @md:-mx-9 @md:px-9" style={{ borderTop: "var(--bw-lg) solid var(--edge-neutral)" }}>
          {isLoading ? <div className="space-y-3"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div> : therapist ? <TherapyContent bookings={ordered} next={next} /> : <EmptyTherapy />}
        </main>
      </Reveal>
    </div>
  );
}

function TherapistHead({ therapist, next }: { therapist: string; next: MyBooking | null }) {
  return (
    <div className="chunk fill-purple p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[17px] bg-white text-xl font-extrabold stroke">{therapist.charAt(0)}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold text-[var(--muted)]">Ваш терапевт</p>
          <h2 className="truncate font-tight text-[19px] font-extrabold">{therapist}</h2>
          <p className="mt-0.5 text-[12px] font-semibold text-[var(--muted)]">{next ? `Следующая встреча · ${dateTime.format(new Date(next.startsAt))}` : "Новая встреча пока не назначена"}</p>
        </div>
      </div>
    </div>
  );
}

function TherapyContent({ bookings, next }: { bookings: MyBooking[]; next: MyBooking | null }) {
  const [tasks, setTasks] = useState<TherapyTask[]>(DEFAULT_TASKS);
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(TASK_KEY);
    if (raw) try { setTasks(JSON.parse(raw) as TherapyTask[]); } catch { localStorage.removeItem(TASK_KEY); }
  }, []);
  const toggleTask = (id: number) => {
    select();
    setTasks((current) => {
      const nextTasks = current.map((task) => task.id === id ? { ...task, done: !task.done } : task);
      localStorage.setItem(TASK_KEY, JSON.stringify(nextTasks));
      return nextTasks;
    });
  };
  const done = tasks.filter((task) => task.done).length;
  const taskProgress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const completedSessions = bookings.filter((booking) => new Date(booking.startsAt) < new Date()).length;

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <section>
          <SectionTitle>Сейчас</SectionTitle>
          <div className="grid grid-cols-[1.35fr_.65fr] gap-3">
            <Card className="fill-coral">
              <div className="flex items-start justify-between gap-2"><Icon name="chart" width={21} weight="fill" /><span className="text-[11px] font-extrabold">задания</span></div>
              <p className="font-tight mt-5 text-[34px] font-extrabold leading-none tnum">{taskProgress}%</p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white stroke"><div className="h-full bg-[var(--ink)] transition-[width] duration-500" style={{ width: `${taskProgress}%` }} /></div>
            </Card>
            <Card className="fill-green">
              <Icon name="calendar" width={21} weight="fill" />
              <p className="font-tight mt-5 text-[34px] font-extrabold leading-none tnum">{completedSessions}</p>
              <p className="mt-1 text-[11px] font-extrabold">встреч пройдено</p>
            </Card>
          </div>
        </section>
      </StaggerItem>

      <StaggerItem>
        <section>
          <SectionTitle action={<span className="text-[12px] font-bold text-[var(--muted)]">{done}/{tasks.length}</span>}>Задания</SectionTitle>
          <Card className="space-y-2 p-3">
            {tasks.map((task) => (
              <button key={task.id} onClick={() => toggleTask(task.id)} className="flex w-full items-center gap-3 rounded-[15px] p-2 text-left transition-colors hover:bg-[var(--surface-2)]">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] stroke ${task.done ? "bg-[var(--green)]" : "bg-white"}`}><Icon name="check" width={17} weight={task.done ? "fill" : "regular"} /></span>
                <span className={`text-[13px] font-semibold ${task.done ? "text-[var(--muted)] line-through" : ""}`}>{task.text}</span>
              </button>
            ))}
          </Card>
        </section>
      </StaggerItem>

      <StaggerItem>
        <section>
          <SectionTitle>Последние 7 дней</SectionTitle>
          <Card>
            <div className="flex h-28 items-end gap-2">
              {[42, 57, 48, 72, 64, 78, 69].map((value, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="w-full rounded-t-[10px] border-[var(--bw)] border-[var(--stroke)] bg-[var(--purple)]" style={{ height: `${value}%` }} />
                  <span className="text-[10px] font-bold text-[var(--muted-2)]">{"пнвсчпс"[index]}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] font-semibold text-[var(--muted)]">Самочувствие стало устойчивее к концу недели.</p>
          </Card>
        </section>
      </StaggerItem>

      <StaggerItem>
        <section>
          <SectionTitle>Связь и встреча</SectionTitle>
          <div className="chunk overflow-hidden">
            <div className="flex gap-2 p-3">
              <Button className="flex-1" onClick={() => { tap(); setMessageOpen(!messageOpen); setSent(false); }}>Написать терапевту</Button>
              <Link href="/sessions"><Button variant="soft">{next ? "Перенести" : "Сессии"}</Button></Link>
            </div>
            <Disclosure open={messageOpen}>
              <div className="border-t p-3" style={{ borderColor: "var(--edge-neutral)" }}>
                {sent ? <div className="rounded-[15px] bg-[var(--green-soft)] p-3 text-[13px] font-bold stroke">Сообщение сохранено для терапевта.</div> : (
                  <div className="space-y-2">
                    <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder="Коротко опишите, что хотите обсудить" />
                    <div className="flex justify-end"><Button size="sm" disabled={!message.trim()} onClick={() => { success(); setSent(true); setMessage(""); }}>Отправить</Button></div>
                  </div>
                )}
              </div>
            </Disclosure>
          </div>
        </section>
      </StaggerItem>
    </Stagger>
  );
}

function EmptyTherapy() {
  return (
    <div className="mx-auto max-w-sm py-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[var(--purple-soft)] stroke"><Icon name="heart" width={28} weight="fill" /></div>
      <h2 className="font-tight mt-4 text-2xl font-extrabold">Здесь появится ваша терапия</h2>
      <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-[var(--muted)]">После записи здесь будут ближайшие встречи, задания и ваш прогресс между сессиями.</p>
      <Link href="/" className="mt-5 inline-block"><Button arrow>Найти терапевта на главной</Button></Link>
    </div>
  );
}
