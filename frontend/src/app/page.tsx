"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { DailyDot, PageHead, SectionTitle } from "@/components/blocks";
import { ClientAvatar } from "@/components/client-avatar";
import { ClientInviteBanner } from "@/components/client-invite";
import { ConfirmActions } from "@/components/confirm-actions";
import { useConfirmAsk } from "@/components/confirm-ask";
import { ClientConfirmWatch, ConfirmDone } from "@/components/confirm-done";
import { ConfirmProPaywall, isNeedsPro } from "@/components/confirm-pro";
import { Icon, type IconName } from "@/components/icons";
import { InviteBanner } from "@/components/invite";
import { MoodHomeCard, MoodSheet } from "@/components/mood-dial";
import { PsyGuide } from "@/components/psy-guide";
import { WorkStats } from "@/components/work-stats";

import { Stagger, StaggerItem } from "@/components/motion";
import { awaitsConfirm, confirmAppointment, hasEnded, isAhead, isRunning, listAppointments, updateAppointment, type Appointment } from "@/lib/appointments";
import { listMyBookings, type Mood, type MyBooking } from "@/lib/clients";
import { tap } from "@/lib/haptics";
import { displayName } from "@/lib/profile";
import { useRole } from "@/lib/role";
import { FREE_CLIENT_LIMIT, getSubscription } from "@/lib/subscription";
import { getMyTherapy, updateMyTherapy } from "@/lib/therapy";
import { asset } from "@/lib/asset";
import { loadTherapists, mergeWithBookings, syncTherapists, therapistCard, type TherapistStore } from "@/lib/therapists";
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
  // Идущая сейчас сессия остаётся ближайшей: считаем по концу встречи, а не по
  // началу. Иначе ровно в её час запись пропадала с главной — и у специалиста,
  // и у клиента, — будто встречи и не было.
  const upcoming = useMemo(
    () => appts.filter((a) => isAhead(a)).sort(byStart),
    [appts, todayKey],
  );
  const next = upcoming[0];
  // Клиенты записались сами и ждут ответа. Пока встреча не подтверждена, для
  // человека она под вопросом, поэтому очередь стоит выше всего остального.
  const waiting = useMemo(() => upcoming.filter(awaitsConfirm), [upcoming]);
  // Статистика — только о том, что уже произошло. Предстоящие записи в зачёт
  // не идут: неделя с тремя записями впереди рисовала «три сессии» ещё до
  // первой встречи, а состоявшиеся при этом оседали в той же куче.
  const held = useMemo(
    () => appts.filter((a) => a.status === "done" || (a.status !== "cancelled" && new Date(a.startsAt).getTime() + a.durationMin * 60_000 < Date.now())),
    [appts],
  );

  return (
    <HomeFrame
      title={`${greeting()}${name ? `, ${name}` : ""}`}
      subtitle={cap(dateF.format(now))}
      subIcon="calendar"
      icon="home"
      focus={<SessionFocus appointment={next} />}
    >
      <ConfirmQueue items={waiting} />

      <PsyGuide />

      {/* Статистика в нулях новичку ничего не говорит — до первой записи её место занимает знакомство с платформой. */}
      {appts.length > 0 && (
        <WorkStats items={held.map((a) => ({ startsAt: a.startsAt, durationMin: a.durationMin, clientKey: String(a.client.id) }))} title="Статистика работы" />
      )}

      <HomeRoutesCarousel items={[
        { title: "Сессии", detail: "окна и записи", icon: "calendar", href: "/sessions" },
        { title: "Клиенты", detail: "карточки и прогресс", icon: "users", href: "/clients" },
        { title: "Каталог", detail: "специалисты площадки", icon: "compass", href: "/catalog" },
        { title: "Инструменты", detail: "материалы для практики", icon: "tools", href: "/tools" },
        { title: "Кабинет", detail: "профиль и подписка", icon: "user", href: "/cabinet" },
      ]} />

      <ClientInviteBanner />
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
      .filter((b) => attached.list.includes(b.psyName) && !hasEnded(b))
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
      {/* Специалист ответил на самозапись — клиент узнаёт об этом окном. */}
      {!guest && <ClientConfirmWatch bookings={bookings} />}

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

// Очередь подтверждений на главной специалиста: клиент записался сам, встреча
// висит в расписании, но обеим сторонам нужен ответ «да».
function ConfirmQueue({ items }: { items: Appointment[] }) {
  const qc = useQueryClient();
  const [needsPro, setNeedsPro] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const { ask, askNode } = useConfirmAsk();
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  const confirm = useMutation({
    mutationFn: (id: number) => confirmAppointment(id),
    onSuccess: (_r, id) => {
      tap();
      const a = items.find((x) => x.id === id);
      setDone(a ? cap(dateTimeF.format(new Date(a.startsAt))) : "");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    // Бесплатные места заняты — вместо голой ошибки показываем, чем это
    // лечится. Клиент в это время ждёт ответа, поэтому предложение открывается
    // сразу, а не прячется в кабинете.
    onError: (e) => { if (isNeedsPro(e)) setNeedsPro(true); },
  });
  const decline = useMutation({
    mutationFn: (id: number) => updateAppointment(id, { status: "cancelled" }),
    onSuccess: () => { tap(); qc.invalidateQueries({ queryKey: ["appointments"] }); },
  });
  // Окно «подтверждено» живёт отдельно от очереди: после ответа она пустеет, а
  // сообщение должно остаться на экране.
  const doneWindow = <ConfirmDone open={done !== null} when={done || undefined} onClose={() => setDone(null)} />;
  if (items.length === 0) return doneWindow;

  return (
    <section className="card-soft space-y-2.5 p-4" style={{ background: "var(--green-soft)", borderColor: "var(--green-edge)" }}>
      <div className="flex items-center gap-2">
        <Icon name="calendar" width={15} weight="bold" color="var(--green-edge)" />
        <p className="t-head">К вам записался клиент</p>
        {/* Тот же красный ярлык, что у задания дня: «сюда надо ткнуть». */}
        <DailyDot size={18} tone="green" label="Ждёт вашего ответа" />
      </div>
      {items.map((a) => (
        <div key={a.id} className="rounded-[13px] bg-white px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            {/* Лицо клиента крупнее кнопок ответа: сначала «кто записался»,
                потом уже «да» или «нет». */}
            <ClientAvatar name={a.client.name} photo={a.client.photo} className="h-[58px] w-[58px] rounded-[17px] text-[20px] font-black" style={{ background: "var(--paper)" }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-black leading-tight">{a.client.name}</span>
              {/* Время встречи — главное в этой карточке: по нему решают, отвечать
                  «да» или «нет». Мелкой подписью оно терялось. */}
              <span className="mt-1 flex items-center gap-1.5">
                <Icon name="clock" width={13} weight="bold" color="var(--green-edge)" />
                <span className="text-[13.5px] font-black leading-tight" style={{ color: "var(--green-edge)" }}>{cap(dateTimeF.format(new Date(a.startsAt)))}</span>
              </span>
            </span>
          </div>
          <div className="mt-2.5">
            <ConfirmActions
              onConfirm={() => ask({
                title: "Подтвердить встречу?",
                when: cap(dateTimeF.format(new Date(a.startsAt))),
                note: `${a.client.name} получит уведомление, что встреча в силе.`,
                confirm: "Подтвердить",
                tone: "green",
                icon: "check",
                run: () => confirm.mutate(a.id),
              })}
              onDecline={() => ask({
                title: "Отклонить запись?",
                when: cap(dateTimeF.format(new Date(a.startsAt))),
                note: `Окно снова станет свободным, а ${a.client.name} узнает, что встреча не состоится.`,
                confirm: "Отклонить",
                tone: "danger",
                icon: "close",
                run: () => decline.mutate(a.id),
              })}
              confirming={confirm.isPending && confirm.variables === a.id}
              declining={decline.isPending && decline.variables === a.id}
            />
          </div>
        </div>
      ))}
      {/* К человеку записались, а подписки нет — самый честный момент
          рассказать, где заканчивается бесплатное. */}
      {sub && sub.status !== "active" && !sub.pro && (
        <button onClick={() => { tap(); setNeedsPro(true); }} className="flex w-full items-center gap-2 rounded-[13px] bg-white px-3 py-2.5 text-left">
          <Icon name="spark" width={14} weight="fill" color="var(--purple-edge)" className="shrink-0" />
          <span className="flex-1 text-[11px] font-semibold leading-snug text-[var(--muted)]">
            Бесплатно подтверждаются встречи с {FREE_CLIENT_LIMIT} клиентами. Дальше — PRO.
          </span>
          <span className="text-[11px] font-black" style={{ color: "var(--purple-edge)" }}>Подробнее</span>
        </button>
      )}
      <ConfirmProPaywall open={needsPro} onClose={() => setNeedsPro(false)} />
      {doneWindow}
      {askNode}
    </section>
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
          <span className="t-micro block">{isRunning(booking) ? "Сессия идёт" : "Ближайшая сессия"}</span>
          <span className="t-title mt-0.5 block truncate text-[var(--ink)]">{booking.psyName}</span>
          <SessionWhen startsAt={booking.startsAt} durationMin={booking.durationMin} date={date} format={formatLabel(booking.format)} />
          <ManageRow />
        </span>
      </div>
    </Link>
  );
}

// Дата — белой плашкой, статус («завтра», «сегодня») — средней лавандой.
function SessionWhen({ startsAt, durationMin, date, format }: { startsAt: string; durationMin: number; date: Date; format: string }) {
  // Пока встреча идёт, относительный день не нужен — важнее, что она вот
  // прямо сейчас. Дальше — обычное «сегодня» / «завтра».
  const live = isRunning({ startsAt, durationMin });
  const badge = live ? "идёт сейчас" : whenBadge(startsAt);
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="tnum flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[12.5px] font-black text-[var(--ink)]">
        <Icon name="calendar" width={12} weight="bold" color="var(--ink)" />
        {cap(dateTimeF.format(date))} · {format}
      </span>
      {badge && (
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.04em]"
          style={live ? { background: "var(--green-edge)", color: "#fff" } : { background: "var(--purple)", color: "var(--purple-edge)" }}
        >
          {badge}
        </span>
      )}
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
        <span className="relative h-[80px] w-[80px] shrink-0">
          <ClientAvatar name={appointment.client.name} photo={appointment.client.photo} className="ico ico-white h-full w-full text-[32px] font-black" style={{ color: "var(--purple-edge)" }} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="t-micro block">{isRunning(appointment) ? "Сессия идёт" : "Ближайшая сессия"}</span>
          <span className="t-title mt-0.5 block truncate text-[var(--ink)]">{appointment.client.name}</span>
          <SessionWhen startsAt={appointment.startsAt} durationMin={appointment.durationMin} date={date} format={formatLabel(appointment.format)} />
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
