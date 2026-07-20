"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageHead, SectionTitle } from "@/components/blocks";
import { Icon, type IconName } from "@/components/icons";
import { InviteBanner } from "@/components/invite";
import { MoodFaces } from "@/components/mood-tracker";
import { Stagger, StaggerItem } from "@/components/motion";
import { Disclosure } from "@/components/ui";
import { listAppointments, type Appointment } from "@/lib/appointments";
import { listClients, listMyBookings, type Client } from "@/lib/clients";
import { tap } from "@/lib/haptics";
import { mascotSrc, MOOD_LABEL, useAnimal } from "@/lib/mascots";
import { displayName } from "@/lib/profile";
import { useRole } from "@/lib/role";
import { getWorkHours } from "@/lib/schedule";
import { domainScore, getMyTherapy, updateMyTherapy, wheelLowest, wheelPercent } from "@/lib/therapy";

const dateF = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });
const dateTimeF = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

const CENTERS = [
  { name: "Детский телефон доверия", note: "бесплатно · круглосуточно · анонимно", phone: "8 800 2000 122", tel: "88002000122" },
  { name: "Экстренная психологическая помощь МЧС", note: "круглосуточно", phone: "8 495 989 50 50", tel: "84959895050" },
  { name: "Московская служба психологической помощи", note: "для жителей Москвы", phone: "051", tel: "051" },
  { name: "Горячая линия центра «АННА»", note: "насилие · кризис · бесплатно", phone: "8 800 7000 600", tel: "88007000600" },
];

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
  const attention = clients.filter(needsAttention).slice(0, 2);
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

      <section>
        <SectionTitle action={<Link href="/clients" onClick={tap} className="text-[12px] font-extrabold text-[var(--muted)] hover:text-[var(--ink)]">К клиентам →</Link>}>Требует внимания</SectionTitle>
        {attention.length ? (
          <div className="space-y-2">
            {attention.map((client) => <AttentionRow key={client.id} client={client} />)}
          </div>
        ) : (
          <QuietState icon="check" title="Всё важное отмечено" text="Новых действий по клиентам сейчас нет." />
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
  const todayMood = therapy ? [...therapy.moods].reverse().find((entry) => localDay(new Date(entry.date)) === todayKey)?.mood : undefined;
  const recentMoodMarks = therapy?.moods.filter((entry) => Date.now() - new Date(entry.date).getTime() < 7 * 86400000).length ?? 0;
  const doneSessions = bookings.filter((booking) => new Date(booking.startsAt) < now).length;
  const balance = wheelPercent(therapy?.wheel ?? null);

  return (
    <HomeFrame
      title={`${greeting()}${name && !guest ? `, ${name}` : ""}`}
      subtitle={guest ? "Начните с подходящего специалиста" : cap(dateF.format(now))}
      focus={<BookingFocus booking={next} guest={guest} />}
    >
      {guest ? (
        <GuestStart />
      ) : (
        <>
          <MoodQuick todayMood={todayMood} />
          <PulseStrip items={[
            { icon: "balance", value: therapy?.wheel ? `${balance}%` : "—", label: "баланс" },
            { icon: "mood", value: String(recentMoodMarks), label: "отметок за 7 дней" },
            { icon: "check", value: String(doneSessions), label: "встреч" },
          ]} />
          <TherapyStep therapy={therapy} />
        </>
      )}

      <HomeRoutes items={guest ? [
        { title: "Каталог", detail: "подобрать психолога", icon: "compass", href: "/catalog" },
        { title: "Инструменты", detail: "практики для себя", icon: "tools", href: "/tools" },
        { title: "Кабинет", detail: "профиль и настройки", icon: "user", href: "/cabinet" },
      ] : [
        { title: "Терапия", detail: "прогресс и задания", icon: "therapy", href: "/therapy" },
        { title: "Сессии", detail: "встречи со специалистом", icon: "calendar", href: "/sessions" },
        { title: "Инструменты", detail: "практики для себя", icon: "tools", href: "/tools" },
        { title: "Каталог", detail: "подобрать специалиста", icon: "compass", href: "/catalog" },
      ]} />

      {!guest && <InviteBanner variant="client" />}
      <HelpCenters />
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
    <Link href="/sessions" onClick={tap} className="group flex items-center gap-3 rounded-[22px] bg-white p-4 text-left transition-transform duration-200 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]" style={{ border: "var(--bw-lg) solid var(--amber-edge)" }}>
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

function AttentionRow({ client }: { client: Client }) {
  const homework = Math.max(0, client.hwTotal - client.hwDone);
  const detail = homework ? `${homework} ${plural(homework, "задание", "задания", "заданий")} в работе` : client.status === "new" ? "Ещё не было первой встречи" : "Давно не было встреч";
  return (
    <Link href={`/clients/${client.id}`} onClick={tap} className="group flex items-center gap-3 rounded-[18px] p-3.5 transition-transform active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]" style={{ background: "var(--purple-soft)", border: "var(--bw-lg) solid var(--purple-edge)" }}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[16px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>{client.name.charAt(0)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-black">{client.name}</span>
        <span className="block truncate text-[11px] font-semibold text-[var(--muted)]">{detail}</span>
      </span>
      <span className="text-[18px] font-black transition-transform group-hover:translate-x-0.5">›</span>
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

function MoodQuick({ todayMood }: { todayMood?: number }) {
  const qc = useQueryClient();
  const save = useMutation({ mutationFn: (mood: number) => updateMyTherapy({ mood }), onSuccess: (state) => qc.setQueryData(["my-therapy"], state) });
  const [open, setOpen] = useState(false);
  const [animal] = useAnimal();
  const expanded = open || !todayMood;
  return (
    <section className="overflow-hidden rounded-[20px] p-4" style={{ background: "var(--amber-soft)", border: "var(--bw-lg) solid var(--amber-edge)" }}>
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]" aria-expanded={expanded}>
        <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-white" style={{ border: "var(--bw) solid var(--amber-edge)" }}><Icon name="mood" width={19} weight="bold" /></span>
        <span className="flex-1"><span className="block text-[14px] font-black">Как вы сегодня?</span><span className="block text-[11px] font-semibold text-[var(--muted)]">{todayMood ? `Отмечено: ${MOOD_LABEL[todayMood]}` : "Одна короткая отметка помогает видеть динамику"}</span></span>
        {todayMood ? <img src={mascotSrc(animal, todayMood)} alt="" className="h-10 w-10 object-contain" /> : null}
        <span className="text-[15px] font-black text-[var(--muted-2)] transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }}>⌄</span>
      </button>
      <Disclosure open={expanded} autoScroll={false}>
        <div className="mt-3"><MoodFaces todayMood={todayMood} onMood={(value) => { save.mutate(value); setOpen(false); }} /></div>
      </Disclosure>
    </section>
  );
}

function TherapyStep({ therapy }: { therapy?: Awaited<ReturnType<typeof getMyTherapy>> }) {
  if (!therapy?.wheel) {
    return (
      <section>
        <SectionTitle>Следующий шаг</SectionTitle>
        <Link href="/therapy" onClick={tap} className="group block rounded-[22px] p-4 transition-transform active:scale-[0.99]" style={{ background: "var(--purple)", border: "var(--bw-lg) solid var(--purple-edge)" }}>
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-white" style={{ border: "var(--bw) solid var(--purple-edge)" }}><Icon name="balance" width={23} weight="bold" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">3–5 минут</span><span className="mt-1 block text-[17px] font-black">Собрать колесо баланса</span><span className="mt-0.5 block max-w-[300px] text-[12px] font-semibold text-[var(--muted)]">Короткий тест покажет, на что сейчас стоит опереться.</span></span>
            <Arrow />
          </div>
        </Link>
      </section>
    );
  }
  const domain = wheelLowest(therapy.wheel, 1)[0];
  const score = domain ? Math.round(domainScore(therapy.wheel, domain.key) * 10) : wheelPercent(therapy.wheel);
  return (
    <section>
      <SectionTitle action={<Link href="/therapy" onClick={tap} className="text-[12px] font-extrabold text-[var(--muted)] hover:text-[var(--ink)]">В терапию →</Link>}>Фокус сейчас</SectionTitle>
      <Link href="/therapy" onClick={tap} className="group block rounded-[22px] p-4 transition-transform active:scale-[0.99]" style={{ background: "var(--purple-soft)", border: "var(--bw-lg) solid var(--purple-edge)" }}>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-white" style={{ border: "var(--bw) solid var(--purple-edge)" }}><Icon name={domain?.icon ?? "therapy"} width={22} weight="bold" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Колесо баланса</span><span className="mt-0.5 block truncate text-[16px] font-black">{domain?.label ?? "Продолжить работу"}</span><span className="mt-2 block h-2.5 overflow-hidden rounded-full bg-white stroke"><span className="block h-full rounded-full bg-[var(--purple)]" style={{ width: `${score}%` }} /></span></span>
          <span className="tnum text-[19px] font-black">{score}%</span>
        </div>
      </Link>
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
            <span className="tnum flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[var(--amber)] text-[14px] font-black" style={{ border: "var(--bw) solid var(--amber-edge)" }}>{number}</span>
            <span><span className="block text-[14px] font-black">{title}</span><span className="block text-[11px] font-semibold text-[var(--muted)]">{text}</span></span>
          </div>
        ))}
        <div className="px-4 pb-4 pt-2"><Link href="/catalog" onClick={tap} className="flex w-full items-center justify-center rounded-full bg-[var(--ink)] px-5 py-3 text-[14px] font-black text-white transition-transform active:scale-[0.98]">Начать подбор →</Link></div>
      </div>
    </section>
  );
}

function HomeRoutes({ items }: { items: { title: string; detail: string; icon: IconName; href: string }[] }) {
  return (
    <section>
      <SectionTitle>Ещё в Береге</SectionTitle>
      <div className="chunk overflow-hidden">
        {items.map((item, index) => (
          <Link key={item.href} href={item.href} onClick={tap} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--head-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--ink)]" style={index ? { borderTop: "var(--bw) solid var(--edge-neutral)" } : undefined}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[var(--head-soft)] stroke"><Icon name={item.icon} width={17} weight="bold" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[14px] font-black">{item.title}</span><span className="block text-[11px] font-semibold text-[var(--muted)]">{item.detail}</span></span>
            <span className="text-[18px] font-black text-[var(--muted)] transition-transform group-hover:translate-x-0.5">›</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HelpCenters() {
  const [open, setOpen] = useState(false);
  return (
    <section className="chunk overflow-hidden">
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-3 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--ink)]" aria-expanded={open}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--coral-soft)]" style={{ border: "var(--bw) solid var(--coral-edge)" }}><Icon name="heart" width={19} weight="bold" /></span>
        <span className="min-w-0 flex-1"><span className="block text-[14px] font-black">Нужна помощь прямо сейчас?</span><span className="block text-[11px] font-semibold text-[var(--muted)]">Бесплатные и анонимные линии поддержки</span></span>
        <span className="text-[16px] font-black text-[var(--muted)] transition-transform" style={{ transform: open ? "rotate(90deg)" : "none" }}>›</span>
      </button>
      <Disclosure open={open}>
        <div className="border-t px-3 pb-3" style={{ borderColor: "var(--edge-neutral)" }}>
          {CENTERS.map((center, index) => (
            <a key={center.tel} href={`tel:${center.tel}`} onClick={tap} className="flex items-center gap-3 px-1 py-3" style={index ? { borderTop: "var(--bw) solid var(--edge-neutral)" } : undefined}>
              <span className="min-w-0 flex-1"><span className="block text-[12px] font-black leading-tight">{center.name}</span><span className="block text-[10px] font-semibold text-[var(--muted)]">{center.note}</span></span>
              <span className="tnum shrink-0 text-[11px] font-black">{center.phone}</span>
            </a>
          ))}
        </div>
      </Disclosure>
    </section>
  );
}

function needsAttention(client: Client): boolean {
  return client.hwTotal > client.hwDone || client.status === "new" || client.status === "paused";
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
