"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { ClientAvatar } from "@/components/client-avatar";
import { Icon, type IconName } from "@/components/icons";
import { Block, Decor } from "@/components/web-ui";
import { hasEnded, isAhead, listAppointments, type Appointment } from "@/lib/appointments";
import { HW_LABEL, listClients, listHomework, type Client } from "@/lib/clients";
import { displayName } from "@/lib/profile";
import { getMonthAvailability, getSlots, ymdLocal, type Slot } from "@/lib/schedule";

// Палитра эталона. Цвет плиток тут смысловой, а не «тон текущего раздела»,
// поэтому держим его здесь, а не в токенах.
const INK = "#201c18";
// Фон блоков — лёгкая ступень тона, акцентная остаётся плашкам иконок,
// плиткам занятых окон и полоскам графика.
const PINK = "var(--raspberry-soft)";
const PINK_MID = "var(--raspberry)";
const YELLOW = "var(--amber-soft)";
const YELLOW_MID = "var(--amber)";
const GREEN = "var(--green)";
const BLUE = "var(--tiffany)";
const MUTED_CARD = "var(--surface-2)";
const LINE = "var(--hairline)";
const SUB = "var(--muted)";
const PAPER = "var(--surface)";

const WEEKDAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const EASE = [0.16, 1, 0.3, 1] as const;

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

export function WebDashboard() {
  const { data: appts = [] } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const name = displayName();
  const now = new Date();

  const [day, setDay] = useState(() => ymdLocal(new Date()));

  const ahead = useMemo(
    () => appts.filter((a) => a.status === "scheduled" && isAhead(a)).sort((x, y) => x.startsAt.localeCompare(y.startsAt)),
    [appts],
  );
  const todayCount = appts.filter((a) => a.status !== "cancelled" && sameDay(new Date(a.startsAt), now)).length;

  return (
    <div data-wide className="pb-4">
      <Greeting name={name} today={todayCount} clients={clients.length} ahead={ahead.length} />

      <div className="mt-4 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_268px]">
        <div className="grid content-start gap-2.5">
          <WeekStats appts={appts} />
          <div className="grid gap-2.5 sm:grid-cols-[176px_minmax(0,1fr)]">
            <ClientsCard clients={clients} />
            <NextAppointments items={ahead} />
          </div>
          <HomeworkBoard clients={clients} />
        </div>

        <Block delay={0.2} className="self-start rounded-[18px]" style={{ background: PAPER, border: `1px solid ${LINE}` }}>
          <MiniCalendar day={day} onPick={setDay} appts={appts} />
          <div style={{ borderTop: `1px solid ${LINE}` }}>
            <DayWindows day={day} appts={appts} />
          </div>
        </Block>
      </div>
    </div>
  );
}

function Greeting({ name, today, clients, ahead }: { name: string; today: number; clients: number; ahead: number }) {
  return (
    <div className="mt-5">
      <h1 className="font-tight text-[28px] font-black leading-[1.1]" style={{ color: INK }}>
        {greeting()}, {name}
      </h1>
      <p className="mt-2 max-w-[495px] text-[11px] font-medium leading-[1.5]" style={{ color: SUB }}>
        {today > 0
          ? `Сегодня ${today} ${plural(today, "сессия", "сессии", "сессий")}.`
          : "На сегодня записей нет."}
      </p>
    </div>
  );
}

const SECTIONS: { href: string; label: string; hint: string; tone: string; mid: string; icon: IconName }[] = [
  { href: "/sessions", label: "Сессии", hint: "график и записи", tone: "var(--green-soft)", mid: "var(--green)", icon: "calendar" },
  { href: "/clients", label: "Клиенты", hint: "карточки и домашки", tone: YELLOW, mid: YELLOW_MID, icon: "users" },
  { href: "/catalog", label: "Каталог", hint: "ваша анкета", tone: "var(--tiffany-soft)", mid: "var(--tiffany)", icon: "compass" },
  { href: "/cabinet", label: "Кабинет", hint: "профиль и оплата", tone: "var(--purple-soft)", mid: "var(--purple)", icon: "user" },
];

/** Активные задания по всем клиентам. Роут отдаёт домашки по одному человеку,
 *  поэтому спрашиваем только тех, у кого по счётчику карточки есть незакрытые —
 *  иначе на каждом заходе летел бы запрос за каждого клиента. */
function HomeworkBoard({ clients }: { clients: Client[] }) {
  const withOpen = clients.filter((c) => c.hwTotal > c.hwDone);
  const queries = useQueries({
    queries: withOpen.map((c) => ({
      queryKey: ["homework", c.id],
      queryFn: () => listHomework(c.id),
    })),
  });

  const items = withOpen
    .flatMap((c, i) =>
      (queries[i]?.data ?? [])
        .filter((h) => h.status !== "done")
        .map((h) => ({ hw: h, client: c })),
    )
    .sort((a, b) => b.hw.sentAt.localeCompare(a.hw.sentAt))
    .slice(0, 6);

  return (
    <Block delay={0.18} className="relative overflow-hidden rounded-[16px] p-4" style={{ background: "var(--tiffany-soft)" }}>
      <Decor kind="burst" />
      <CardTitle>Задания в работе:</CardTitle>
      <div className="relative mt-3 grid gap-1.5">
        {items.length === 0 && (
          <p className="text-[11px] font-medium" style={{ color: SUB }}>Активных заданий нет.</p>
        )}
        {items.map(({ hw, client }, i) => (
          <Link
            key={hw.id}
            href={`/clients/?id=${client.id}`}
            className="dash-row flex items-center gap-2.5 rounded-[14px] px-2.5 py-2"
            style={{ background: "rgba(255,255,255,.55)", "--i": i } as CSSProperties}
          >
            <ClientAvatar name={client.name} photo={client.photo} className="h-7 w-7 shrink-0 text-[10px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-bold" style={{ color: INK }}>{hw.text}</span>
              <span className="block truncate text-[8px] font-medium" style={{ color: SUB }}>{client.name}</span>
            </span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em]"
              style={{ background: hw.status === "doing" ? GREEN : YELLOW_MID, color: INK }}
            >
              {HW_LABEL[hw.status]}
            </span>
          </Link>
        ))}
      </div>
    </Block>
  );
}

function SectionCarousel() {
  return (
    <div className="-mx-1 mt-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {SECTIONS.map((s, i) => (
        <motion.div
          key={s.href}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 * i, duration: 0.4, ease: EASE }}
          whileHover={{ y: -4 }}
          className="shrink-0 snap-start"
        >
          <Link
            href={s.href}
            className="flex h-[82px] w-[168px] flex-col justify-between rounded-[16px] p-3"
            style={{ background: s.tone }}
          >
            <span className="flex items-center justify-between">
              <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: s.mid }}>
                <Icon name={s.icon} width={15} color={INK} />
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.45">
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </span>
            <span>
              <span className="block text-[13px] font-black leading-none" style={{ color: INK }}>{s.label}</span>
              <span className="mt-1 block text-[8px] font-bold uppercase tracking-[0.1em]" style={{ color: INK, opacity: 0.5 }}>
                {s.hint}
              </span>
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

function CardTitle({ children }: { children: string; onLight?: boolean }) {
  return <h2 className="text-[13px] font-black leading-none" style={{ color: INK }}>{children}</h2>;
}

function Stat({ value, caption, dim }: { value: string; caption: string; dim?: boolean }) {
  return (
    <div>
      <div className="text-[15px] font-black leading-none" style={{ color: INK, opacity: dim ? 0.55 : 1 }}>{value}</div>
      <div className="mt-1 text-[7px] font-bold uppercase tracking-[0.12em]" style={{ color: INK, opacity: 0.55 }}>
        {caption}
      </div>
    </div>
  );
}

/** Неделя считается по завершённым встречам: предстоящее в статистику не идёт. */
function WeekStats({ appts }: { appts: Appointment[] }) {
  const week = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const items = appts.filter(
        (a) => a.status !== "cancelled" && hasEnded(a) && sameDay(new Date(a.startsAt), d),
      );
      return { date: d, count: items.length, minutes: items.reduce((s, a) => s + a.durationMin, 0) };
    });
    return days;
  }, [appts]);

  const total = week.reduce((s, d) => s + d.count, 0);
  const minutes = week.reduce((s, d) => s + d.minutes, 0);
  const people = new Set(
    appts
      .filter((a) => a.status !== "cancelled" && hasEnded(a) && new Date(a.startsAt) >= week[0].date)
      .map((a) => a.client.id),
  ).size;
  const avg = total ? Math.round(minutes / total) : 0;
  const peak = Math.max(...week.map((d) => d.count), 1);

  return (
    <Block delay={0.05} className="relative overflow-hidden rounded-[16px] p-4" style={{ background: PINK }}>
      <Decor kind="heart" />
      <CardTitle>Работа за неделю:</CardTitle>

      <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
        <Stat value={`${total}`} caption="сессий" />
        <Stat value={`${Math.floor(minutes / 60)} ч ${minutes % 60} мин`} caption="в работе" />
        <Stat value={`${people} чел`} caption="человек" />
        <Stat value={`${avg} мин`} caption="в среднем" dim />
      </div>

      <div className="mt-4 flex items-end gap-2" style={{ height: 56 }}>
        {week.map((d, i) => (
          <span key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className="dash-bar w-full rounded-[3px]"
              style={{
                height: `${Math.max(6, (d.count / peak) * 44)}px`,
                background: sameDay(d.date, new Date()) ? INK : "rgba(17,17,17,.35)",
                "--i": i,
              } as CSSProperties}
            />
            <span className="text-[7px] font-bold uppercase tracking-[0.1em]" style={{ color: INK, opacity: 0.55 }}>
              {WEEKDAYS[(d.date.getDay() + 6) % 7]}
            </span>
          </span>
        ))}
      </div>

    </Block>
  );
}

function ClientsCard({ clients }: { clients: Client[] }) {
  const therapy = clients.filter((c) => c.status === "therapy").length;
  const fresh = clients.filter((c) => c.status === "new").length;
  const paused = clients.filter((c) => c.status === "paused").length;
  const top = Math.max(therapy, fresh, paused, 1);

  return (
    <Block delay={0.1} className="relative overflow-hidden rounded-[16px] p-4" style={{ background: YELLOW, minHeight: 180 }}>
      <Decor kind="plus" />
      <CardTitle>Клиенты:</CardTitle>
      <div className="mt-3 grid gap-2">
        <Stat value={`${therapy} чел`} caption="в терапии" />
        <Stat value={`${fresh} чел`} caption="новые" />
        <Stat value={`${paused} чел`} caption="пауза" dim />
      </div>
      <div className="mt-3 flex items-end gap-1.5" style={{ height: 34 }}>
        {[therapy, fresh, paused].map((v, i) => (
          <span
            key={i}
            className="dash-bar flex-1 rounded-[3px]"
            style={{ height: `${Math.max(8, (v / top) * 100)}%`, background: i === 0 ? INK : "var(--amber-edge)", "--i": i } as CSSProperties}
          />
        ))}
      </div>
    </Block>
  );
}

function tone(format: string) {
  if (format === "video") return BLUE;
  if (format === "chat") return GREEN;
  return PINK;
}

function formatLabel(format: string) {
  if (format === "video") return "Видеосессия";
  if (format === "chat") return "В переписке";
  return "Очно";
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (sameDay(d, today)) return "сегодня";
  if (sameDay(d, tomorrow)) return "завтра";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function NextAppointments({ items }: { items: Appointment[] }) {
  const shown = items.slice(0, 5);
  return (
    <Block delay={0.15} className="rounded-[16px] p-4" style={{ background: PAPER, border: `1px solid ${LINE}` }}>
      <CardTitle onLight>Ближайшие записи:</CardTitle>
      <div className="mt-3 grid gap-1.5">
        {shown.length === 0 && (
          <p className="text-[11px] font-medium" style={{ color: SUB }}>Записей впереди нет.</p>
        )}
        {shown.map((a, i) => (
          <Link
            key={a.id}
            href={`/clients?id=${a.client.id}`}
            className="dash-row flex h-[39px] items-center gap-2.5 rounded-[14px] px-2.5"
            style={{ background: MUTED_CARD, "--i": i } as CSSProperties}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: tone(a.format) }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" /><path className="dash-hand" d="M12 7v5l3 2" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-bold" style={{ color: INK }}>{a.client.name}</span>
              <span className="block truncate text-[8px] font-medium" style={{ color: SUB }}>{formatLabel(a.format)}</span>
            </span>
            <span className="text-right">
              <span className="block text-[9px] font-bold" style={{ color: INK }}>{hhmm(a.startsAt)}</span>
              <span className="block text-[7px] font-bold uppercase tracking-[0.1em]" style={{ color: SUB }}>
                {dayLabel(a.startsAt)}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </Block>
  );
}

/** Мини-календарь: та же картина, что в «Сессиях» — занятость дня берётся из
 *  расписания, а не считается на глаз. */
function MiniCalendar({ day, onPick, appts }: { day: string; onPick: (ymd: string) => void; appts: Appointment[] }) {
  const now = new Date();
  const [shift, setShift] = useState(0);
  const view = new Date(now.getFullYear(), now.getMonth() + shift, 1);
  const first = (view.getDay() + 6) % 7;
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();

  const { data: avail = {} } = useQuery({ queryKey: ["month-avail", null], queryFn: () => getMonthAvailability() });

  const booked = useMemo(() => {
    const set = new Set<string>();
    for (const a of appts) if (a.status !== "cancelled") set.add(ymdLocal(new Date(a.startsAt)));
    return set;
  }, [appts]);

  return (
    <div className="p-3.5">
      <div className="flex items-center justify-between">
        <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: PINK, color: INK }}>
          {MONTHS[view.getMonth()]} {view.getFullYear()}
        </span>
        <span className="flex gap-1">
          <Arrow dir="left" onClick={() => setShift((s) => s - 1)} />
          <Arrow dir="right" onClick={() => setShift((s) => s + 1)} />
        </span>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-[7px] font-bold uppercase tracking-[0.1em]" style={{ color: SUB }}>{d}</span>
        ))}
        {Array.from({ length: first }, (_, i) => <span key={`x${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const date = new Date(view.getFullYear(), view.getMonth(), i + 1);
          const ymd = ymdLocal(date);
          const picked = ymd === day;
          const state = avail[ymd];
          const has = booked.has(ymd);
          return (
            <button key={ymd} onClick={() => onPick(ymd)} className="flex h-[24px] items-center justify-center">
              <span
                className="relative flex h-[20px] w-[20px] items-center justify-center rounded-full text-[9px] font-bold"
                style={{
                  background: picked ? PINK : "transparent",
                  color: INK,
                  opacity: picked || state === "free" || has ? 1 : 0.4,
                }}
              >
                {i + 1}
                {has && !picked && (
                  <span className="absolute -bottom-[1px] h-[3px] w-[3px] rounded-full" style={{ background: INK }} />
                )}
              </span>
            </button>
          );
        })}
      </div>

    </div>
  );
}

function Arrow({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-5 w-5 items-center justify-center rounded-full" style={{ border: `1px solid ${LINE}` }}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
}

/** Окна выбранного дня — тот же ответ `/slots`, что показывает раздел «Сессии»:
 *  свободное окно и занятое различаются ровно так же. */
function DayWindows({ day, appts }: { day: string; appts: Appointment[] }) {
  const { data: slots = [], isLoading } = useQuery({ queryKey: ["slots", day], queryFn: () => getSlots(day) });

  const byTime = useMemo(() => {
    const map = new Map<string, Appointment>();
    for (const a of appts) if (a.status !== "cancelled") map.set(new Date(a.startsAt).toISOString(), a);
    return map;
  }, [appts]);

  const who = (s: Slot) => byTime.get(new Date(s.start).toISOString());
  const free = slots.filter((s) => !s.taken).length;
  const title = new Date(day).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

  return (
    <div className="p-3.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-black" style={{ color: INK }}>{title}</h2>
        <span className="text-[8px] font-bold uppercase tracking-[0.12em]" style={{ color: SUB }}>
          {free} {plural(free, "окно", "окна", "окон")}
        </span>
      </div>

      <div className="mt-3 grid gap-1.5">
        {isLoading && <p className="text-[10px] font-medium" style={{ color: SUB }}>Смотрим график…</p>}
        {!isLoading && slots.length === 0 && (
          <p className="text-[10px] font-medium" style={{ color: SUB }}>В этот день вы не работаете.</p>
        )}
        {slots.map((s) => {
          const appt = who(s);
          return (
            <div
              key={s.start}
              className="flex h-[30px] items-center gap-2 rounded-[12px] px-2.5"
              style={{ background: s.taken ? tone(appt?.format ?? "offline") : MUTED_CARD }}
            >
              <span className="text-[9px] font-bold" style={{ color: INK }}>{hhmm(s.start)}</span>
              <span className="min-w-0 flex-1 truncate text-[9px] font-semibold" style={{ color: INK, opacity: s.taken ? 1 : 0.55 }}>
                {s.taken ? appt?.client.name ?? "Занято" : "Свободно"}
              </span>
              <span className="text-[7px] font-bold uppercase tracking-[0.1em]" style={{ color: INK, opacity: 0.5 }}>
                {s.fmt === "online" ? "онлайн" : "очно"}
              </span>
            </div>
          );
        })}
      </div>

      <Link
        href="/sessions"
        className="mt-3 flex h-[29px] w-full items-center justify-center rounded-[18px] text-[10px] font-bold"
        style={{ background: INK, color: "#fff" }}
      >
        Открыть расписание
      </Link>
    </div>
  );
}
