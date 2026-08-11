"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { PageHead, SectionTitle } from "@/components/blocks";
import { Icon, type IconName } from "@/components/icons";
import { InviteBanner } from "@/components/invite";
import { MoodHomeCard, MoodSheet } from "@/components/mood-dial";
import { WorkStats } from "@/components/work-stats";
import { motion } from "motion/react";

import { Stagger, StaggerItem } from "@/components/motion";
import { listAppointments, type Appointment } from "@/lib/appointments";
import { listMyBookings, type Mood, type MyBooking } from "@/lib/clients";
import { tap } from "@/lib/haptics";
import { displayName } from "@/lib/profile";
import { useRole } from "@/lib/role";
import { getMyTherapy, updateMyTherapy } from "@/lib/therapy";
import { asset } from "@/lib/asset";
import { loadTherapists, mergeWithBookings, syncTherapists, therapistCard, type TherapistStore } from "@/lib/therapists";
import { startTour, tourSeen } from "@/components/room-tour";
import type { Role } from "@/lib/role";
import { zoneDayDiff, zoneFormat } from "@/lib/zone";

const dateF = zoneFormat({ weekday: "long", day: "numeric", month: "long" });
const dateTimeF = zoneFormat({ weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

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
  const now = new Date();
  const todayKey = localDay(now);
  const todayEntry = therapy ? [...therapy.moods].reverse().find((entry) => localDay(new Date(entry.date)) === todayKey) : undefined;

  // Терапевты — тот же стор и та же склейка с записями, что в разделе «Терапия»:
  // открепили специалиста там — здесь сразу подбор, а не запись к нему.
  const [store, setStore] = useState<TherapistStore>({ list: [], removed: [], active: null, ids: {}, cards: {} });
  useEffect(() => {
    const sync = () => setStore(loadTherapists());
    sync();
    // Кэш рисует список сразу, база уточняет его через мгновение: на новом
    // устройстве в кэше пусто, а закреплённые специалисты есть.
    void syncTherapists().then(setStore);
    window.addEventListener("bereg:therapists", sync);
    return () => window.removeEventListener("bereg:therapists", sync);
  }, []);
  const bookingNames = useMemo(() => [...new Set(bookings.map((b) => b.psyName))], [bookings]);
  const attached = useMemo(() => mergeWithBookings(store, bookingNames), [store, bookingNames]);
  const therapist = attached.active;
  const next = useMemo(
    () => bookings
      .filter((b) => attached.list.includes(b.psyName) && new Date(b.startsAt) > new Date())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0],
    [bookings, attached.list],
  );

  return (
    <HomeFrame
      title={`${greeting()}${name && !guest ? `, ${name}` : ""}`}
      subtitle={guest ? "Начните с подходящего специалиста" : cap(dateF.format(now))}
      subIcon={guest ? undefined : "calendar"}
      icon="home"
      focus={guest ? undefined : <div data-tour="next-session"><NextSession booking={next} therapist={therapist} /></div>}
    >
      <TourBanner role={guest ? "guest" : "client"} />

      {guest ? <GuestStart /> : <MoodQuick today={todayEntry} moods={therapy?.moods ?? []} />}

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
    // Терапевт есть — ведём в «Терапию», к записи. Нет — в каталог за специалистом.
    if (!therapist) return <FindTherapistCard />;
    return (
      <Link href="/therapy?booking=1" onClick={tap} className="card-lav flex items-center gap-3.5 p-6 transition-transform active:scale-[0.99]">
        <FocusIcon icon="calendar" />
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
    <Link href="/therapy?booking=1" onClick={tap} className="card-lav group block p-4 text-left transition-transform duration-200 active:scale-[0.99]">
      <div className="flex items-center gap-3.5">
        <PsyAvatar name={booking.psyName} />
        <span className="min-w-0 flex-1">
          <span className="t-micro block">Ближайшая сессия</span>
          <span className="t-title mt-0.5 block truncate text-[var(--ink)]">{booking.psyName}</span>
          <SessionWhen startsAt={booking.startsAt} date={date} format={formatLabel(booking.format)} />
          <ManageRow />
        </span>
      </div>
    </Link>
  );
}

// Дата — белой плашкой, статус («завтра», «сегодня») — средней лавандой.
function SessionWhen({ startsAt, date, format }: { startsAt: string; date: Date; format: string }) {
  const badge = whenBadge(startsAt);
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="tnum flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[12.5px] font-black text-[var(--ink)]">
        <Icon name="calendar" width={12} weight="bold" color="var(--ink)" />
        {cap(dateTimeF.format(date))} · {format}
      </span>
      {badge && <span className="rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.04em]" style={{ background: "var(--purple)", color: "var(--purple-edge)" }}>{badge}</span>}
    </span>
  );
}

// Управление записью — вместо стрелки: шестерёнка и подпись в акценте.
function ManageRow() {
  return (
    <span className="mt-2 flex items-center gap-1.5" style={{ color: "var(--purple-edge)" }}>
      <Icon name="gear" width={15} weight="bold" color="currentColor" />
      <span className="text-[12.5px] font-black">Управление записью</span>
    </span>
  );
}

// Фото терапевта в блоке ближайшей сессии — крупное, из карточки каталога.
function PsyAvatar({ name }: { name: string }) {
  const psy = therapistCard(name);
  const portrait = psy?.portrait ? asset(psy.portrait) : null;
  if (!portrait) return <span className="ico ico-white h-[80px] w-[80px] shrink-0 text-[32px] font-black" style={{ color: "var(--edge)" }}>{name.charAt(0)}</span>;
  return (
    <span className="relative block h-[80px] w-[80px] shrink-0 overflow-hidden rounded-[22px] bg-white">
      <Image src={portrait} alt={`Портрет: ${name}`} fill sizes="80px" className="object-cover" unoptimized={/^(data:|blob:)/i.test(portrait)} />
    </span>
  );
}

// Компактный блок подбора терапевта.
function FindTherapistCard() {
  return (
    <Link href="/catalog" onClick={tap} className="card-lav flex items-center gap-3.5 p-6 transition-transform active:scale-[0.99]">
      <FocusIcon icon="compass" />
      <span className="min-w-0 flex-1">
        <span className="t-head block">Найти специалиста</span>
        <span className="t-sub block">В терапии пока никого не прикреплено</span>
      </span>
      <span className="btn shrink-0">В каталог</span>
    </Link>
  );
}

function HomeFrame({ title, subtitle, subIcon, icon, focus, children }: { title: string; subtitle: string; subIcon?: IconName; icon?: IconName; focus?: React.ReactNode; children: React.ReactNode }) {
  const focusRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  // Отступ листа считается от реального низа фокус-блока: при длинном имени,
  // переносе даты или бейдже «сегодня» карточка растёт вниз, и фиксированное
  // число снова наехало бы на настроение.
  const [pad, setPad] = useState(120);
  useEffect(() => {
    if (!focus) return;
    const measure = () => {
      const focusBox = focusRef.current?.getBoundingClientRect();
      const sheetBox = sheetRef.current?.getBoundingClientRect();
      if (!focusBox || !sheetBox) return;
      setPad(Math.max(20, Math.round(focusBox.bottom - sheetBox.top) + 20));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (focusRef.current) observer.observe(focusRef.current);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [focus]);
  return (
    <div>
      {/* Фокус-блок наезжает на белый лист: как на референсе, он пересекает
          границу цветной шапки и нижней области. */}
      <PageHead title={title} sub={subtitle} subIcon={subIcon} icon={icon}>{focus && <div ref={focusRef} className="relative z-10 -mb-[132px] mt-6">{focus}</div>}</PageHead>
      <div ref={sheetRef} className="sheet relative z-0" style={focus ? { paddingTop: pad } : undefined}>
        <Stagger className="space-y-6">
          {Array.isArray(children)
            ? children.map((child, index) => child ? <StaggerItem key={index} className="empty:hidden">{child}</StaggerItem> : null)
            : <StaggerItem>{children}</StaggerItem>}
        </Stagger>
      </div>
    </div>
  );
}

// Фокус-блок всегда лавандовый — во всех трёх состояниях (нет сессии,
// подобрать терапевта, ближайшая сессия) это один и тот же блок.
function FocusIcon({ icon, white = false }: { icon: IconName; white?: boolean }) {
  return (
    <span className="ico h-[64px] w-[64px] shrink-0" style={{ background: "var(--purple)", borderColor: "var(--purple-edge)" }}>
      <Icon name={icon} width={30} weight="bold" color={white ? "#fff" : "var(--purple-edge)"} />
    </span>
  );
}

function SessionFocus({ appointment }: { appointment?: Appointment }) {
  if (!appointment) {
    return (
      <Link href="/sessions" onClick={tap} className="card-lav flex items-center gap-3.5 p-6 text-left transition-transform duration-200 active:scale-[0.99]">
        <FocusIcon icon="calendar" white />
        <span className="min-w-0 flex-1">
          <span className="t-micro block">Расписание</span>
          <span className="t-head mt-0.5 block leading-tight">Предстоящих сессий пока нет</span>
        </span>
        <span className="btn shrink-0">График</span>
      </Link>
    );
  }
  const date = new Date(appointment.startsAt);
  return (
    <Link href={`/clients/?id=${appointment.client.id}&book=1`} onClick={tap} className="card-lav group relative block overflow-hidden p-4 text-left transition-transform duration-200 active:scale-[0.99]">
      <div className="flex items-center gap-3.5">
        <span className="ico ico-white relative h-[80px] w-[80px] shrink-0 text-[32px] font-black" style={{ color: "var(--purple-edge)" }}>
          {appointment.client.name.charAt(0)}
          {/* пульсирующая точка «скоро» — на своём слое, иначе от неё дрожит соседний текст */}
          <span className="pulse-dot absolute -right-1 -top-1 h-3 w-3 rounded-full" style={{ background: "var(--amber)" }} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="t-micro block">Ближайшая сессия</span>
          <span className="t-title mt-0.5 block truncate text-[var(--ink)]">{appointment.client.name}</span>
          <SessionWhen startsAt={appointment.startsAt} date={date} format={formatLabel(appointment.format)} />
          <ManageRow />
        </span>
      </div>
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
            <span className="tnum flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-[14px] font-black" style={{ background: "var(--head-soft)", color: "var(--edge)" }}>{number}</span>
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
  return (
    <button onClick={() => { tap(); startTour(); }} className="relative w-full overflow-hidden p-4 text-left transition-transform active:scale-[0.99]">
      <div className="relative flex items-center gap-3.5">
        <motion.span
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[24px] font-black leading-none text-white"
          style={{ background: "var(--purple-edge)" }}
        >!</motion.span>
        <span className="min-w-0 flex-1">
          <span className="t-head block">{title}</span>
          <span className="t-cap mt-1.5 block" style={{ color: "var(--purple-edge)" }}>Нажмите, чтобы пошагово ознакомиться с функционалом</span>
        </span>
      </div>
    </button>
  );
}

// Каждый раздел живёт в своём тоне — плитка на главной берёт его же.
const ROUTE_TONE: Record<string, string> = { "/sessions": "green", "/clients": "purple", "/tools": "peach", "/cabinet": "amber", "/therapy": "purple", "/catalog": "tiffany" };

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
  const diff = zoneDayDiff(new Date(), new Date(iso));
  // Только относительный день — точное время уже показано в основной строке.
  if (diff === 0) return "сегодня";
  if (diff === 1) return "завтра";
  if (diff === -1) return "вчера";
  return undefined;
}
