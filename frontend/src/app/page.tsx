"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Arrow, PageHead, SectionTitle } from "@/components/blocks";
import { Icon, type IconName } from "@/components/icons";
import { InviteBanner } from "@/components/invite";
import { MoodHomeCard, MoodSheet } from "@/components/mood-dial";
import { WorkStats } from "@/components/work-stats";
import { motion } from "motion/react";

import { Stagger, StaggerItem } from "@/components/motion";
import { TodayCard, type TodayItem } from "@/components/today";
import { listAppointments, type Appointment } from "@/lib/appointments";
import { listHomework, listMyBookings, type Mood, type MyBooking } from "@/lib/clients";
import { tap } from "@/lib/haptics";
import { displayName } from "@/lib/profile";
import { useRole } from "@/lib/role";
import { Disclosure } from "@/components/ui";
import { getMyTherapy, updateMyTherapy } from "@/lib/therapy";
import { PSYS } from "@/lib/catalog";
import { loadTherapists } from "@/lib/therapists";
import { startTour, tourSeen } from "@/components/room-tour";
import type { Role } from "@/lib/role";

const dateF = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });
const dateTimeF = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

function useName(): string {
  const [name, setName] = useState("");
  useEffect(() => setName(displayName()), []);
  return name;
}

export default function Home() {
  const [role] = useRole();
  return role === "psychologist" ? <PsyHome /> : <PersonHome guest={role === "guest"} />;
}

function PsyHome() {
  const name = useName();
  const { data: appts = [] } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });
  const now = new Date();
  const todayKey = localDay(now);
  const upcoming = useMemo(
    () => appts.filter((a) => a.status === "scheduled" && new Date(a.startsAt) > now).sort(byStart),
    [appts, todayKey],
  );
  const next = upcoming[0];

  return (
    <HomeFrame
      title={`${greeting()}${name ? `, ${name}` : ""}`}
      subtitle={cap(dateF.format(now))}
      subIcon="calendar"
      icon="home"
      focus={<SessionFocus appointment={next} />}
    >
      <TourBanner role="psychologist" />

      <WorkStats items={appts.map((a) => ({ startsAt: a.startsAt, durationMin: a.durationMin, clientKey: String(a.client.id), cancelled: a.status === "cancelled" }))} title="Статистика работы" />

      <HomeRoutesCarousel items={[
        { title: "Сессии", detail: "окна и записи", icon: "calendar", href: "/sessions" },
        { title: "Клиенты", detail: "карточки и прогресс", icon: "users", href: "/clients" },
        { title: "Инструменты", detail: "материалы для практики", icon: "tools", href: "/tools" },
        { title: "Кабинет", detail: "профиль и подписка", icon: "user", href: "/cabinet" },
      ]} />

      <InviteBanner variant="psy" />
    </HomeFrame>
  );
}

function PersonHome({ guest }: { guest: boolean }) {
  const name = useName();
  const { data: bookings = [] } = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings });
  const { data: therapy } = useQuery({ queryKey: ["my-therapy"], queryFn: getMyTherapy });
  const { data: homework = [] } = useQuery({ queryKey: ["my-homework"], queryFn: () => listHomework(1) });
  const now = new Date();
  const todayKey = localDay(now);
  const next = [...bookings].filter((b) => new Date(b.startsAt) > now).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0];
  const todayEntry = therapy ? [...therapy.moods].reverse().find((entry) => localDay(new Date(entry.date)) === todayKey) : undefined;

  const pending = homework.filter((h) => h.status !== "done").length;
  const clientToday: TodayItem[] = [];
  if (pending > 0) clientToday.push({ icon: "note", title: `${pending} ${plural(pending, "задание", "задания", "заданий")} ждут`, sub: "От вашего терапевта", href: "/therapy" });
  if (therapy && !therapy.wheel) clientToday.push({ icon: "balance", title: "Собрать колесо баланса", sub: "5 минут на себя", href: "/therapy", tone: "purple" });
  if (clientToday.length === 0) clientToday.push({ icon: "therapy", title: "Практика на сегодня", sub: "Короткая поддержка себе", href: "/tools" });
  // Терапевт берётся из выбранных в разделе «Терапия» (общий стор).
  const [therapist, setTherapist] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => { const s = loadTherapists(); setTherapist(s.active ?? s.list[0] ?? null); };
    sync();
    window.addEventListener("bereg:therapists", sync);
    return () => window.removeEventListener("bereg:therapists", sync);
  }, []);

  return (
    <HomeFrame
      title={`${greeting()}${name && !guest ? `, ${name}` : ""}`}
      subtitle={guest ? "Начните с подходящего специалиста" : cap(dateF.format(now))}
      subIcon={guest ? undefined : "calendar"}
      icon="home"
      focus={guest ? undefined : <NextSession booking={next} therapist={therapist} />}
    >
      <TourBanner role={guest ? "guest" : "client"} />

      {guest ? <GuestStart /> : <MoodQuick today={todayEntry} moods={therapy?.moods ?? []} />}

      {!guest && <TodayCard items={clientToday} />}

      {/* в) разделы — листающаяся вбок карусель */}
      <HomeRoutesCarousel items={guest ? [
        { title: "Каталог", detail: "подобрать психолога", icon: "compass", href: "/catalog" },
        { title: "Инструменты", detail: "практики для себя", icon: "tools", href: "/tools" },
        { title: "Кабинет", detail: "профиль и настройки", icon: "user", href: "/cabinet" },
      ] : [
        { title: "Терапия", detail: "прогресс и задания", icon: "therapy", href: "/therapy" },
        { title: "Каталог", detail: "подобрать специалиста", icon: "compass", href: "/catalog" },
        { title: "Инструменты", detail: "практики для себя", icon: "tools", href: "/tools" },
        { title: "Кабинет", detail: "профиль и настройки", icon: "user", href: "/cabinet" },
      ]} />

      {!guest && <InviteBanner variant="client" />}
    </HomeFrame>
  );
}

// а) Ближайшая сессия. Нет записи, но выбран терапевт → записаться. Не выбран → подобрать.
function NextSession({ booking, therapist }: { booking?: MyBooking; therapist: string | null }) {
  if (!booking) {
    if (!therapist) return <FindTherapistCard />;
    const psy = PSYS.find((p) => p.name === therapist);
    return (
      <Link href={psy ? `/catalog?psy=${psy.id}` : "/catalog"} onClick={tap} className="card-plain flex items-center gap-3 p-4 transition-transform active:scale-[0.99]">
        <span className="ico h-12 w-12"><Icon name="calendar" width={22} weight="bold" color="var(--edge)" /></span>
        <span className="min-w-0 flex-1">
          <span className="t-micro block">{therapist}</span>
          <span className="t-head mt-0.5 block leading-tight">Нет ближайших записей</span>
        </span>
        <span className="btn shrink-0">Записаться</span>
      </Link>
    );
  }
  const date = new Date(booking.startsAt);
  return (
    <Link href="/therapy?booking=1" onClick={tap} className="card-plain group flex items-center gap-3 p-4 text-left transition-transform duration-200 active:scale-[0.99]">
      <span className="ico h-14 w-14 text-[21px] font-black" style={{ color: "var(--edge)" }}>{booking.psyName.charAt(0)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="t-micro whitespace-nowrap">Ближайшая сессия</span>
          {/* Статус — тёмная заливка и белый текст, чтобы читался с одного взгляда */}
          {(() => { const b = whenBadge(booking.startsAt); return b && <span className="chip chip-strong uppercase">{b}</span>; })()}
        </span>
        <span className="t-title mt-1 block truncate">{booking.psyName}</span>
        <span className="t-sub block truncate">{cap(dateTimeF.format(date))} · {formatLabel(booking.format)}</span>
      </span>
      <Arrow />
    </Link>
  );
}

// Компактный блок подбора терапевта.
function FindTherapistCard() {
  return (
    <Link href="/catalog" onClick={tap} className="card-plain flex items-center gap-3 p-3.5 transition-transform active:scale-[0.99]">
      <span className="ico h-11 w-11 shrink-0">
        <Icon name="compass" width={22} weight="bold" color="var(--edge)" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="t-head block">Подобрать терапевта</span>
        <span className="t-sub block">У вас пока нет специалиста</span>
      </span>
      <span className="btn shrink-0">В каталог</span>
    </Link>
  );
}

function HomeFrame({ title, subtitle, subIcon, icon, focus, children }: { title: string; subtitle: string; subIcon?: IconName; icon?: IconName; focus?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <PageHead title={title} sub={subtitle} subIcon={subIcon} icon={icon}>{focus}</PageHead>
      <div className="sheet">
        <Stagger className="space-y-6">
          {Array.isArray(children)
            ? children.map((child, index) => child ? <StaggerItem key={index}>{child}</StaggerItem> : null)
            : <StaggerItem>{children}</StaggerItem>}
        </Stagger>
      </div>
    </div>
  );
}

function FocusIcon({ icon }: { icon: IconName }) {
  return <span className="ico h-14 w-14"><Icon name={icon} width={24} weight="bold" color="var(--edge)" /></span>;
}

function SessionFocus({ appointment }: { appointment?: Appointment }) {
  if (!appointment) {
    return (
      <Link href="/sessions" onClick={tap} className="card-plain group flex items-center gap-3 p-4 text-left transition-transform duration-200 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--edge)]">
        <FocusIcon icon="calendar" />
        <span className="min-w-0 flex-1">
          <span className="t-micro block">Ближайший шаг</span>
          <span className="t-head mt-0.5 block">Открыть окна для записи</span>
          <span className="t-sub block">Предстоящих сессий пока нет</span>
        </span>
        <Arrow />
      </Link>
    );
  }
  const date = new Date(appointment.startsAt);
  const badge = whenBadge(appointment.startsAt);
  return (
    <Link href="/sessions" onClick={tap} className="card-plain group relative flex items-center gap-3 overflow-hidden p-4 text-left transition-transform duration-200 active:scale-[0.99]">
      <span className="ico relative h-14 w-14 text-[21px] font-black" style={{ color: "var(--edge)" }}>
        {appointment.client.name.charAt(0)}
        {/* пульсирующая точка «скоро» */}
        <motion.span className="absolute -right-1 -top-1 h-3 w-3 rounded-full" style={{ background: "var(--edge)" }} animate={{ scale: [1, 1.35, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="t-micro whitespace-nowrap">Ближайшая сессия</span>
          {badge && <span className="chip chip-strong uppercase">{badge}</span>}
        </span>
        <span className="t-title mt-1 block truncate">{appointment.client.name}</span>
        <span className="t-sub block truncate">{cap(dateTimeF.format(date))} · {formatLabel(appointment.format)}</span>
      </span>
      <Arrow />
    </Link>
  );
}


function MoodQuick({ today, moods }: { today?: Mood; moods: Mood[] }) {
  const qc = useQueryClient();
  const save = useMutation({ mutationFn: updateMyTherapy, onSuccess: (state) => qc.setQueryData(["my-therapy"], state) });
  const [sheet, setSheet] = useState(false);
  return (
    <section data-tour="mood">
      <MoodHomeCard mood={today?.mood} moods={moods} onOpen={() => setSheet(true)} />
      <MoodSheet open={sheet} mood={today?.mood} emotions={today?.emotions} onClose={() => setSheet(false)} onSave={(mood, emotions) => save.mutate({ mood, emotions })} />
    </section>
  );
}

function GuestStart() {
  const steps = [
    ["1", "Ответьте на несколько вопросов", "Уточним запрос, формат и важные предпочтения."],
    ["2", "Посмотрите короткую подборку", "Покажем десять подходящих специалистов без бесконечной ленты."],
    ["3", "Выберите удобное окно", "Запись появится в ваших сессиях."],
  ];
  return (
    <section>
      <SectionTitle>Как начать</SectionTitle>
      <div className="chunk overflow-hidden">
        {steps.map(([number, title, text], index) => (
          <div key={number} className={`flex gap-3 px-4 py-3.5 ${index ? "line-top" : ""}`}>
            <span className="tnum flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[14px] font-black" style={{ background: "var(--head-soft)", color: "var(--edge)" }}>{number}</span>
            <span><span className="t-head block">{title}</span><span className="t-sub block">{text}</span></span>
          </div>
        ))}
        <div className="px-4 pb-4 pt-2"><Link href="/catalog" onClick={tap} className="btn w-full py-3 transition-transform active:scale-[0.98]">Начать подбор</Link></div>
      </div>
    </section>
  );
}

// Баннер обучения: ярко-лавандовый постер с игровым «!». Запускает прожекторный тур.
function TourBanner({ role }: { role: Role }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const sync = () => setShow(!tourSeen(role));
    sync();
    window.addEventListener("bereg:tour-change", sync);
    return () => window.removeEventListener("bereg:tour-change", sync);
  }, [role]);
  if (!show) return null;
  const title = role === "psychologist" ? "Освойте кабинет психолога" : "Познакомьтесь с приложением";
  const sub = role === "psychologist"
    ? "Пошагово покажем, как вести клиентов, записи и практику"
    : "Короткий гид по разделам — за минуту";
  return (
    <button onClick={() => { tap(); startTour(); }} className="card-soft relative w-full overflow-hidden p-4 text-left transition-transform active:scale-[0.99]">
      <div className="relative flex items-center gap-3.5">
        <motion.span
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[24px] font-black leading-none text-white"
          style={{ background: "var(--edge)" }}
        >!</motion.span>
        <span className="min-w-0 flex-1">
          <span className="t-micro block">Обучение</span>
          <span className="t-head block">{title}</span>
          <span className="t-sub mt-0.5 block">{sub}</span>
        </span>
        <span className="btn shrink-0">Пройти</span>
      </div>
    </button>
  );
}

// Каждый раздел живёт в своём тоне — плитка на главной берёт его же.
const ROUTE_TONE: Record<string, string> = { "/sessions": "olive", "/clients": "purple", "/tools": "peach", "/cabinet": "salmon", "/therapy": "purple", "/catalog": "green" };

// Разделы — листающаяся вбок карусель.
function HomeRoutesCarousel({ items }: { items: { title: string; detail: string; icon: IconName; href: string }[] }) {
  return (
    <section>
      <SectionTitle>Разделы</SectionTitle>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 @md:mx-0 @md:px-0">
        {items.map((item) => {
          const tone = ROUTE_TONE[item.href] ?? "amber";
          return (
            <Link key={item.href} href={item.href} onClick={tap} className="card-soft w-[164px] shrink-0 snap-start p-4 transition-transform duration-200 active:scale-[0.97]" style={{ background: `var(--${tone}-soft)` }}>
              <span className="ico ico-white h-12 w-12"><Icon name={item.icon} width={23} weight="bold" color={`var(--${tone}-edge)`} /></span>
              <span className="t-head mt-5 block">{item.title}</span>
              <span className="t-sub mt-1 block min-h-[34px]">{item.detail}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function byStart(a: Appointment, b: Appointment): number {
  return +new Date(a.startsAt) - +new Date(b.startsAt);
}

function localDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatLabel(format: "online" | "offline"): string {
  return format === "online" ? "онлайн" : "очно";
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Относительный день. Цвет не нужен: статус всегда в акценте раздела.
function whenBadge(iso: string): string | undefined {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const target = new Date(date); target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  // Только относительный день — точное время уже показано в основной строке.
  if (diff === 0) return "сегодня";
  if (diff === 1) return "завтра";
  if (diff === -1) return "вчера";
  return undefined;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
