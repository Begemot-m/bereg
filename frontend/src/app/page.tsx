"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageHead, SectionTitle } from "@/components/blocks";
import { Icon, type IconName } from "@/components/icons";
import { InviteBanner } from "@/components/invite";
import { MoodCard, MoodSheet } from "@/components/mood-dial";
import { MoodStats } from "@/components/mood-stats";
import { Stagger, StaggerItem } from "@/components/motion";
import { listAppointments, type Appointment } from "@/lib/appointments";
import { listClients, listMyBookings, type Client, type Mood } from "@/lib/clients";
import { tap } from "@/lib/haptics";
import { displayName } from "@/lib/profile";
import { useRole } from "@/lib/role";
import { getWorkHours } from "@/lib/schedule";
import { Disclosure } from "@/components/ui";
import { getMyTherapy, updateMyTherapy } from "@/lib/therapy";

const dateF = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });
const dateTimeF = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

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
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: work } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const now = new Date();
  const todayKey = localDay(now);
  const upcoming = useMemo(
    () => appts.filter((a) => a.status === "scheduled" && new Date(a.startsAt) > now).sort(byStart),
    [appts, todayKey],
  );
  const today = useMemo(
    () => appts.filter((a) => a.status !== "cancelled" && localDay(new Date(a.startsAt)) === todayKey).sort(byStart),
    [appts, todayKey],
  );
  const next = upcoming[0];
  const activeClients = clients.filter((c) => c.status === "therapy").length;
  const weekday = (now.getDay() + 6) % 7;
  const freeToday = Math.max(0, (work?.hours?.[weekday]?.length ?? 0) - today.length);

  return (
    <HomeFrame
      title={`${greeting()}${name ? `, ${name}` : ""}`}
      subtitle={cap(dateF.format(now))}
      focus={<SessionFocus appointment={next} />}
    >
      <PulseStrip
        items={[
          { icon: "calendar", value: String(today.length), label: "сессии" },
          { icon: "clock", value: String(freeToday), label: "свободно" },
          { icon: "users", value: String(activeClients), label: "в терапии" },
        ]}
      />

      <section>
        <SectionTitle action={<Link href="/sessions" onClick={tap} className="text-[12px] font-extrabold text-[var(--muted)] hover:text-[var(--ink)]">Все сессии →</Link>}>Ваш день</SectionTitle>
        {today.length ? (
          <div className="chunk overflow-hidden">
            {today.slice(0, 3).map((appointment, index) => (
              <SessionRow key={appointment.id} appointment={appointment} divided={index > 0} />
            ))}
          </div>
        ) : (
          <QuietState icon="sun" title="Сегодня без встреч" text="Можно оставить день свободным или проверить открытые окна." href="/sessions" action="Открыть расписание" />
        )}
      </section>

      <HomeRoutes items={[
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
  const next = [...bookings].filter((b) => new Date(b.startsAt) > now).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0];
  const todayEntry = therapy ? [...therapy.moods].reverse().find((entry) => localDay(new Date(entry.date)) === todayKey) : undefined;
  const therapist = [...bookings].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).at(-1)?.psyName ?? null;

  return (
    <HomeFrame
      title={`${greeting()}${name && !guest ? `, ${name}` : ""}`}
      subtitle={guest ? "Начните с подходящего специалиста" : cap(dateF.format(now))}
      focus={<BookingFocus booking={next} guest={guest} />}
    >
      {guest ? <GuestStart /> : <MoodQuick today={todayEntry} moods={therapy?.moods ?? []} />}

      {!guest && !next && <TherapistCta therapist={therapist} />}

      <HomeRoutes items={guest ? [
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

function HomeFrame({ title, subtitle, focus, children }: { title: string; subtitle: string; focus: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <PageHead title={title} sub={subtitle}>{focus}</PageHead>
      <div className="-mx-4 min-h-[64vh] rounded-t-[30px] px-4 pb-7 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)", borderTop: "var(--bw-lg) solid var(--edge-neutral)" }}>
        <Stagger className="space-y-6">
          {Array.isArray(children)
            ? children.map((child, index) => child ? <StaggerItem key={index}>{child}</StaggerItem> : null)
            : <StaggerItem>{children}</StaggerItem>}
        </Stagger>
      </div>
    </div>
  );
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
  return (
    <Link href="/sessions" onClick={tap} className="group flex items-center gap-3 rounded-[22px] bg-white p-4 text-left transition-transform duration-200 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]" style={{ border: "var(--bw-lg) solid var(--amber-edge)" }}>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[17px] bg-[var(--amber-soft)] text-[21px] font-black" style={{ border: "var(--bw) solid var(--amber-edge)" }}>{appointment.client.name.charAt(0)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Ближайшая сессия</span>
          {whenBadge(appointment.startsAt) && <span className="rounded-full bg-[var(--amber-soft)] px-2 py-0.5 text-[9px] font-black uppercase" style={{ border: "var(--bw) solid var(--amber-edge)" }}>{whenBadge(appointment.startsAt)}</span>}
        </span>
        <span className="mt-1 block truncate text-[18px] font-black leading-tight">{appointment.client.name}</span>
        <span className="block truncate text-[12px] font-bold text-[var(--muted)]">{cap(dateTimeF.format(date))} · {formatLabel(appointment.format)}</span>
      </span>
      <Arrow />
    </Link>
  );
}

function BookingFocus({ booking, guest }: { booking?: { psyName: string; startsAt: string; format: "online" | "offline" }; guest: boolean }) {
  if (!booking) {
    if (!guest) return null;
    return (
      <Link href="/catalog" onClick={tap} className="group flex items-center gap-3 rounded-[22px] bg-white p-4 text-left transition-transform duration-200 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]" style={{ border: "var(--bw-lg) solid var(--amber-edge)" }}>
        <FocusIcon icon="compass" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">{guest ? "Начало пути" : "Следующий шаг"}</span>
          <span className="mt-0.5 block text-[16px] font-black">Подобрать психолога</span>
          <span className="block text-[12px] font-semibold text-[var(--muted)]">Короткий опрос поможет сузить выбор</span>
        </span>
        <Arrow />
      </Link>
    );
  }
  const date = new Date(booking.startsAt);
  return (
    <Link href="/therapy" onClick={tap} className="group flex items-center gap-3 rounded-[22px] bg-white p-4 text-left transition-transform duration-200 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]" style={{ border: "var(--bw-lg) solid var(--amber-edge)" }}>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[17px] bg-[var(--amber-soft)] text-[21px] font-black" style={{ border: "var(--bw) solid var(--amber-edge)" }}>{booking.psyName.charAt(0)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Ближайшая встреча</span>
          {whenBadge(booking.startsAt) && <span className="rounded-full bg-[var(--amber-soft)] px-2 py-0.5 text-[9px] font-black uppercase" style={{ border: "var(--bw) solid var(--amber-edge)" }}>{whenBadge(booking.startsAt)}</span>}
        </span>
        <span className="mt-1 block truncate text-[18px] font-black leading-tight">{booking.psyName}</span>
        <span className="block truncate text-[12px] font-bold text-[var(--muted)]">{cap(dateTimeF.format(date))} · {formatLabel(booking.format)}</span>
      </span>
      <Arrow />
    </Link>
  );
}

function FocusIcon({ icon }: { icon: IconName }) {
  return <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[17px] bg-[var(--amber-soft)]" style={{ border: "var(--bw) solid var(--amber-edge)" }}><Icon name={icon} width={24} weight="bold" /></span>;
}

function Arrow() {
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[20px] font-black text-white transition-transform duration-200 group-hover:translate-x-0.5">›</span>;
}

function PulseStrip({ items }: { items: { icon: IconName; value: string; label: string }[] }) {
  return (
    <section>
      <SectionTitle>В двух словах</SectionTitle>
      <div className="grid grid-cols-3 overflow-hidden rounded-[20px]" style={{ background: "var(--amber-soft)", border: "var(--bw-lg) solid var(--amber-edge)" }}>
        {items.map((item, index) => (
          <div key={item.label} className="min-w-0 px-2.5 py-3.5 text-center" style={index ? { borderLeft: "var(--bw) solid var(--amber-edge)" } : undefined}>
            <Icon name={item.icon} width={16} weight="bold" className="mx-auto" />
            <p className="font-tight tnum mt-1 text-[22px] font-black leading-none">{item.value}</p>
            <p className="mx-auto mt-1 max-w-[92px] text-[9px] font-black uppercase leading-tight tracking-[.045em] text-[var(--muted)]">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SessionRow({ appointment, divided }: { appointment: Appointment; divided: boolean }) {
  const date = new Date(appointment.startsAt);
  const past = date < new Date() || appointment.status === "done";
  return (
    <Link href="/sessions" onClick={tap} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--head-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--ink)]" style={divided ? { borderTop: "var(--bw) solid var(--edge-neutral)" } : undefined}>
      <span className="tnum w-12 shrink-0 text-[17px] font-black">{timeF.format(date)}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[14px] font-extrabold ${past ? "line-through opacity-60" : ""}`}>{appointment.client.name}</span>
        <span className="block text-[11px] font-semibold text-[var(--muted)]">{formatLabel(appointment.format)} · {appointment.durationMin} мин</span>
      </span>
      <span className="text-[11px] font-extrabold text-[var(--muted)]">{past ? "проведена" : "впереди"}</span>
    </Link>
  );
}

function QuietState({ icon, title, text, href, action }: { icon: IconName; title: string; text: string; href?: string; action?: string }) {
  const content = (
    <div className="flex items-center gap-3 rounded-[18px] bg-[#fbfaf6] p-3.5" style={{ border: "var(--bw-lg) solid var(--edge-neutral)" }}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-white stroke"><Icon name={icon} width={19} weight="bold" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[14px] font-black">{title}</span><span className="block text-[11px] font-semibold text-[var(--muted)]">{text}</span></span>
      {action && <span className="max-w-[82px] text-right text-[11px] font-black">{action} →</span>}
    </div>
  );
  return href ? <Link href={href} onClick={tap} className="block transition-transform active:scale-[0.99]">{content}</Link> : content;
}

function MoodQuick({ today, moods }: { today?: Mood; moods: Mood[] }) {
  const qc = useQueryClient();
  const save = useMutation({ mutationFn: updateMyTherapy, onSuccess: (state) => qc.setQueryData(["my-therapy"], state) });
  const [sheet, setSheet] = useState(false);
  const [stats, setStats] = useState(false);

  return (
    <section className="space-y-2.5">
      <MoodCard mood={today?.mood} emotions={today?.emotions} onOpen={() => setSheet(true)} />
      <button onClick={() => { tap(); setStats(!stats); }} className="flex w-full items-center justify-center gap-1.5 rounded-full bg-white py-2 text-[12px] font-black text-[var(--muted)]" style={{ border: "var(--bw) solid var(--edge-neutral)" }} aria-expanded={stats}>
        <Icon name="chart" width={15} weight="bold" /> {stats ? "Скрыть статистику" : "Статистика настроения"}
      </button>
      <Disclosure open={stats} autoScroll={false}>
        <MoodStats moods={moods} title="Ваша динамика" />
      </Disclosure>
      <MoodSheet open={sheet} mood={today?.mood} emotions={today?.emotions} onClose={() => setSheet(false)} onSave={(mood, emotions) => save.mutate({ mood, emotions })} />
    </section>
  );
}

// Нет терапевта — пунктирное окно с плюсом. Есть, но без записи — предложение записаться.
function TherapistCta({ therapist }: { therapist: string | null }) {
  if (!therapist) {
    return (
      <Link href="/catalog" onClick={tap} className="flex flex-col items-center justify-center gap-2 rounded-[22px] px-4 py-7 text-center transition-transform active:scale-[0.99]" style={{ background: "var(--green-soft)", border: "2.5px dashed var(--green-edge)" }}>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[26px] font-black leading-none" style={{ border: "var(--bw-lg) solid var(--green-edge)" }}>+</span>
        <span className="block text-[15px] font-black">Найти терапевта</span>
        <span className="block max-w-[240px] text-[11px] font-semibold text-[var(--muted)]">Короткий подбор — и увидите специалистов под ваш запрос</span>
      </Link>
    );
  }
  return (
    <Link href="/catalog" onClick={tap} className="flex items-center gap-3 rounded-[22px] p-4 transition-transform active:scale-[0.99]" style={{ background: "var(--green-soft)", border: "var(--bw-lg) solid var(--green-edge)" }}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-white text-[18px] font-black" style={{ border: "var(--bw) solid var(--green-edge)" }}>{therapist.charAt(0)}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Ваш терапевт</span>
        <span className="block truncate text-[15px] font-black">{therapist}</span>
        <span className="block text-[11px] font-semibold text-[var(--muted)]">Следующая встреча не назначена — выберите окно</span>
      </span>
      <span className="shrink-0 rounded-full bg-[var(--ink)] px-3.5 py-2 text-[11px] font-black text-white">Записаться</span>
    </Link>
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
            <span className="tnum flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[var(--amber)] text-[14px] font-black" style={{ border: "var(--bw) solid var(--amber-edge)" }}>{number}</span>
            <span><span className="block text-[14px] font-black">{title}</span><span className="block text-[11px] font-semibold text-[var(--muted)]">{text}</span></span>
          </div>
        ))}
        <div className="px-4 pb-4 pt-2"><Link href="/catalog" onClick={tap} className="flex w-full items-center justify-center rounded-full bg-[var(--ink)] px-5 py-3 text-[14px] font-black text-white transition-transform active:scale-[0.98]">Начать подбор →</Link></div>
      </div>
    </section>
  );
}

const ROUTE_TONE: Record<string, string> = { "/sessions": "green", "/clients": "purple", "/tools": "amber", "/cabinet": "salmon", "/therapy": "purple", "/catalog": "salmon" };

// Разделы — плиткой (бенто 2 в ряд), рамки в тон заливки.
function HomeRoutes({ items }: { items: { title: string; detail: string; icon: IconName; href: string }[] }) {
  return (
    <section>
      <SectionTitle>Разделы</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((item) => {
          const t = ROUTE_TONE[item.href] ?? "amber";
          return (
            <Link key={item.href} href={item.href} onClick={tap} className="rounded-[18px] p-3.5 transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]" style={{ background: `var(--${t})`, border: `var(--bw-lg) solid var(--${t}-edge)` }}>
              <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-white" style={{ border: `var(--bw) solid var(--${t}-edge)` }}><Icon name={item.icon} width={19} weight="bold" /></span>
              <span className="mt-4 block text-[14px] font-black leading-tight">{item.title}</span>
              <span className="mt-0.5 block text-[11px] font-semibold text-[var(--muted)]">{item.detail}</span>
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

function whenBadge(iso: string): string | undefined {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const target = new Date(date); target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return `сегодня · ${timeF.format(date)}`;
  if (diff === 1) return `завтра · ${timeF.format(date)}`;
  return undefined;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
