"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageHead, SectionTitle } from "@/components/blocks";
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

      <WorkStats items={appts.map((a) => ({ startsAt: a.startsAt, durationMin: a.durationMin, clientKey: String(a.client.id), cancelled: a.status === "cancelled" }))} title="Статистика работы" tone="olive" />

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
  if (pending > 0) clientToday.push({ icon: "note", tone: "coral", title: `${pending} ${plural(pending, "задание", "задания", "заданий")} ждут`, sub: "От вашего терапевта", href: "/therapy" });
  if (therapy && !therapy.wheel) clientToday.push({ icon: "balance", tone: "purple", title: "Собрать колесо баланса", sub: "5 минут на себя", href: "/therapy" });
  if (clientToday.length === 0) clientToday.push({ icon: "therapy", tone: "peach", title: "Практика на сегодня", sub: "Короткая поддержка себе", href: "/tools" });
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
      <Link href={psy ? `/catalog?psy=${psy.id}` : "/catalog"} onClick={tap} className="flex items-center gap-3 rounded-[22px] p-4 transition-transform active:scale-[0.99]" style={{ background: "var(--amber-soft)", border: "var(--bw-lg) solid var(--amber-edge)" }}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-white"><Icon name="calendar" width={22} weight="bold" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">{therapist}</span>
          <span className="block text-[14px] font-black leading-tight">Нет ближайших записей к специалисту</span>
        </span>
        <span className="shrink-0 rounded-full bg-white px-3.5 py-2 text-[11px] font-black">Записаться</span>
      </Link>
    );
  }
  const date = new Date(booking.startsAt);
  return (
    <Link href="/therapy" onClick={tap} className="group flex items-center gap-3 rounded-[22px] bg-white p-4 text-left transition-transform duration-200 active:scale-[0.99]" style={{ border: "var(--bw-lg) solid var(--amber-edge)" }}>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[17px] bg-[var(--amber-soft)] text-[21px] font-black">{booking.psyName.charAt(0)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Ближайшая сессия</span>
          {(() => { const b = whenBadge(booking.startsAt); return b && <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase" style={{ background: `var(--${b.tone}-soft)`, color: `var(--${b.tone}-edge)` }}>{b.label}</span>; })()}
        </span>
        <span className="mt-1 block truncate text-[18px] font-black leading-tight">{booking.psyName}</span>
        <span className="block truncate text-[12px] font-bold text-[var(--muted)]">{cap(dateTimeF.format(date))} · {formatLabel(booking.format)}</span>
      </span>
      <Arrow />
    </Link>
  );
}

// Компактный блок подбора терапевта.
function FindTherapistCard() {
  return (
    <Link href="/catalog" onClick={tap} className="flex items-center gap-3 rounded-[20px] p-3.5 transition-transform active:scale-[0.99]" style={{ background: "var(--olive-soft)", border: "2px dashed var(--olive-edge)" }}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white">
        <Icon name="compass" width={22} weight="bold" color="var(--olive-edge)" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-black leading-tight">Подобрать терапевта</span>
        <span className="block text-[11px] font-semibold text-[var(--muted)]">У вас пока нет специалиста</span>
      </span>
      <span className="shrink-0 rounded-full bg-[var(--olive)] px-3 py-2 text-[11px] font-black">Перейти в каталог</span>
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
  return <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[17px] bg-[var(--amber-soft)]"><Icon name={icon} width={24} weight="bold" /></span>;
}

function SessionFocus({ appointment }: { appointment?: Appointment }) {
  if (!appointment) {
    return (
      <Link href="/sessions" onClick={tap} className="group flex items-center gap-3 rounded-[22px] bg-white p-4 text-left transition-transform duration-200 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]" style={{ border: "var(--bw-lg) solid var(--amber-edge)" }}>
        <FocusIcon icon="calendar" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Ближайший шаг</span>
          <span className="mt-0.5 block text-[16px] font-black">Открыть окна для записи</span>
          <span className="block text-[12px] font-semibold text-[var(--muted)]">Предстоящих сессий пока нет</span>
        </span>
        <Arrow />
      </Link>
    );
  }
  const date = new Date(appointment.startsAt);
  const badge = whenBadge(appointment.startsAt);
  return (
    <Link href="/sessions" onClick={tap} className="group relative flex items-center gap-3 overflow-hidden rounded-[22px] bg-white p-4 text-left transition-transform duration-200 active:scale-[0.99]" style={{ border: "var(--bw-lg) solid var(--amber-edge)" }}>
      {/* живое пятно-подсветка */}
      <motion.span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[var(--amber)]" animate={{ scale: [1, 1.2, 1], opacity: [0.14, 0.26, 0.14] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />
      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[17px] bg-[var(--amber-soft)] text-[21px] font-black">
        {appointment.client.name.charAt(0)}
        {/* пульсирующая точка «скоро» */}
        <motion.span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-[var(--coral)]" style={{ border: "2px solid #fff" }} animate={{ scale: [1, 1.35, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Ближайшая сессия</span>
          {badge && <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase" style={{ background: `var(--${badge.tone}-soft)`, color: `var(--${badge.tone}-edge)` }}>{badge.label}</span>}
        </span>
        <span className="mt-1 block truncate text-[18px] font-black leading-tight">{appointment.client.name}</span>
        <span className="block truncate text-[12px] font-bold text-[var(--muted)]">{cap(dateTimeF.format(date))} · {formatLabel(appointment.format)}</span>
      </span>
      <Arrow />
    </Link>
  );
}

function Arrow() {
  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--amber-soft)] text-[19px] font-black text-[var(--amber-edge)] transition-transform duration-200 group-hover:translate-x-0.5">›</span>;
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
          <div key={number} className="flex gap-3 px-4 py-3.5" style={index ? { borderTop: "var(--bw) solid var(--edge-neutral)" } : undefined}>
            <span className="tnum flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-[14px] font-black" style={{ background: "var(--head-soft)", color: "var(--edge)" }}>{number}</span>
            <span><span className="t-head block">{title}</span><span className="t-sub block">{text}</span></span>
          </div>
        ))}
        <div className="px-4 pb-4 pt-2"><Link href="/catalog" onClick={tap} className="flex w-full items-center justify-center rounded-full bg-[var(--ink)] px-5 py-3 text-[14px] font-black text-white transition-transform active:scale-[0.98]">Начать подбор →</Link></div>
      </div>
    </section>
  );
}

// Что в практике требует движения: кого позвать, где пусто, кого привести.
// Не сводка, а список действий — на главной полезнее статистики.
const ROUTE_TONE: Record<string, string> = { "/sessions": "olive", "/clients": "purple", "/tools": "peach", "/cabinet": "salmon", "/therapy": "purple", "/catalog": "olive" };

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
    <button onClick={() => { tap(); startTour(); }} className="relative w-full overflow-hidden rounded-[22px] p-4 text-left transition-transform active:scale-[0.99]" style={{ background: "var(--purple)", border: "var(--bw-lg) solid var(--purple-edge)", boxShadow: "0 16px 30px -18px var(--purple-edge)" }}>
      <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-30" style={{ background: "#fff" }} />
      <span aria-hidden className="pointer-events-none absolute -bottom-10 right-12 h-20 w-20 rounded-full opacity-20" style={{ background: "var(--purple-edge)" }} />
      <div className="relative flex items-center gap-3.5">
        <motion.span
          animate={{ scale: [1, 1.14, 1], rotate: [0, -7, 7, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[26px] font-black leading-none"
          style={{ background: "var(--amber)", border: "var(--bw-lg) solid var(--amber-edge)", boxShadow: "0 0 0 4px rgba(255,255,255,.55)" }}
        >!</motion.span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-black uppercase tracking-[.12em] text-[var(--purple-edge)]">Обучение</span>
          <span className="block text-[15.5px] font-black leading-tight">{title}</span>
          <span className="mt-0.5 block text-[11.5px] font-semibold" style={{ color: "rgba(32,28,24,.66)" }}>{sub}</span>
        </span>
        <span className="shrink-0 rounded-full bg-[var(--ink)] px-3.5 py-2 text-[11px] font-black text-white">Пройти →</span>
      </div>
    </button>
  );
}

// Разделы — листающаяся вбок карусель.
function HomeRoutesCarousel({ items }: { items: { title: string; detail: string; icon: IconName; href: string }[] }) {
  return (
    <section>
      <SectionTitle>Разделы</SectionTitle>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 @md:mx-0 @md:px-0">
        {items.map((item) => {
          const t = ROUTE_TONE[item.href] ?? "amber";
          return (
            <Link key={item.href} href={item.href} onClick={tap} className="w-[164px] shrink-0 snap-start rounded-[22px] p-4 transition-transform duration-200 active:scale-[0.97]" style={{ background: `var(--${t}-soft)` }}>
              <span className="flex h-12 w-12 items-center justify-center rounded-[15px] bg-white"><Icon name={item.icon} width={23} weight="bold" color={`var(--${t}-edge)`} /></span>
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

// Относительный день с цветом: сегодня — персик, завтра — олива, вчера — коралл.
function whenBadge(iso: string): { label: string; tone: string } | undefined {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const target = new Date(date); target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  // Только относительный день — точное время уже показано в основной строке.
  if (diff === 0) return { label: "сегодня", tone: "peach" };
  if (diff === 1) return { label: "завтра", tone: "olive" };
  if (diff === -1) return { label: "вчера", tone: "coral" };
  return undefined;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
