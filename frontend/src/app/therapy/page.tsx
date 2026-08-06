"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import dynamic from "next/dynamic";
import Image from "next/image";

// Колесо баланса — тридцать вопросов с анимациями. В терапию заходят каждый
// день, колесо проходят раз в пару недель: в стартовый бандл ему не место.
const WheelFlow = dynamic(() => import("@/components/balance-flow").then((m) => m.WheelFlow));
import { Icon } from "@/components/icons";
import { MoodHomeCard, MoodSheet } from "@/components/mood-dial";
import { moodColor } from "@/components/mood-egg";
import { TherapistBoard, WorkWithSpecialist } from "@/components/therapy-work";
import { MoodStats } from "@/components/mood-stats";
import { WellbeingCard } from "@/components/wellbeing-card";
import { BookingRow } from "@/components/my-bookings";
import { SessionCheckin } from "@/components/session-checkin";
import { ClientSessionJourney } from "@/components/session-reflections";
import { SlotPicker } from "@/components/slot-picker";
import { Disclosure, SkeletonRow } from "@/components/ui";
import { bookSlot, cancelMyBooking } from "@/lib/mybookings";
import { getMonthAvailability, ymdLocal } from "@/lib/schedule";
import { listHomework, type MyBooking, type Mood, listMyBookings } from "@/lib/clients";
import { getMyTherapy, updateMyTherapy, type ReflectionPatch, type TherapyState, type WheelAnswers } from "@/lib/therapy";
import { asset } from "@/lib/asset";
import { PSYS } from "@/lib/catalog";
import { select, success, tap } from "@/lib/haptics";
import { detachTherapist, loadTherapists, mergeWithBookings, saveTherapists, type TherapistStore } from "@/lib/therapists";
import { TherapyGuide, therapyGuideSeen } from "@/components/therapy-guide";

const ME = 1; // в демо клиент «я» — карточка №1
const dateTime = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

// Прикреплённые терапевты: общий стор (каталог добавляет) + автодобавление из записей.
function useMyTherapists(bookingNames: string[], onDetach: (name: string) => void) {
  const [store, setStore] = useState<TherapistStore>({ list: [], removed: [], active: null });
  const sync = () => {
    const base = loadTherapists();
    const next = mergeWithBookings(base, bookingNames);
    setStore(next);
    if (next.list.length !== base.list.length || next.active !== base.active) saveTherapists(next);
  };
  useEffect(() => { sync(); const on = () => sync(); window.addEventListener("bereg:therapists", on); return () => window.removeEventListener("bereg:therapists", on); }, [bookingNames.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const persist = (nextStore: TherapistStore) => { setStore(nextStore); saveTherapists(nextStore); };
  return {
    list: store.list,
    active: store.active,
    setActive: (name: string) => { select(); persist({ ...store, active: name }); },
    // Открепили — записи к этому специалисту отменяются: и здесь, и на главной.
    remove: (name: string) => { tap(); setStore(detachTherapist(name)); onDetach(name); },
  };
}

export default function TherapyPage() {
  const qc = useQueryClient();
  const bookingsQuery = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings });
  const therapyQuery = useQuery({ queryKey: ["my-therapy"], queryFn: getMyTherapy });
  const bookings = bookingsQuery.data ?? [];
  const therapy = therapyQuery.data;
  const ordered = useMemo(() => [...bookings].sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [bookings]);
  const bookingNames = useMemo(() => [...new Set(ordered.map((b) => b.psyName))], [ordered]);
  // Открепление специалиста снимает все будущие записи к нему — иначе на главной
  // осталась бы висеть сессия с тем, кого в терапии уже нет.
  const dropBookings = useMutation({
    mutationFn: async (name: string) => {
      for (const item of ordered.filter((b) => b.psyName === name)) await cancelMyBooking(item.id);
    },
    onSettled: () => { for (const key of ["my-bookings", "slots", "month-avail"]) qc.invalidateQueries({ queryKey: [key] }); },
  });
  const therapists = useMyTherapists(bookingNames, (name) => dropBookings.mutate(name));
  const active = therapists.active;
  const next = ordered.find((item) => item.psyName === active && new Date(item.startsAt) > new Date())
    ?? ordered.find((item) => new Date(item.startsAt) > new Date()) ?? null;
  const save = useMutation({ mutationFn: updateMyTherapy, onSuccess: (state) => qc.setQueryData(["my-therapy"], state) });

  // Пошаговый гайд при первом заходе в раздел.
  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(() => { if (!therapyGuideSeen()) setGuideOpen(true); }, []);

  if (bookingsQuery.isError || therapyQuery.isError) return <div className="card-soft p-5 text-center"><p className="t-head">Не удалось загрузить терапию</p><p className="t-sub mt-1">Проверьте соединение и попробуйте ещё раз.</p><button onClick={() => void Promise.all([bookingsQuery.refetch(), therapyQuery.refetch()])} className="btn mt-4">Повторить</button></div>;
  if (bookingsQuery.isLoading || therapyQuery.isLoading || !therapy) return <div className="space-y-3 py-8"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>;
  // Интерфейс терапии показывается всегда — статистика копится независимо от терапевта.
  return <>
    <TherapyDashboard therapists={therapists} next={next} bookings={ordered} therapy={therapy} reflectionSaving={save.isPending} onReflection={(reflection) => save.mutate({ reflection })} onNotesModule={(notesModule) => save.mutate({ notesModule })} onMood={(mood, emotions) => save.mutate({ mood, emotions })} onBoard={(board) => save.mutate({ board })} onGuideSeen={() => save.mutate({ tutorialSeen: true })} onWheel={(answers) => save.mutate({ wheel: answers })} />
    {guideOpen && <TherapyGuide onClose={() => setGuideOpen(false)} />}
  </>;
}

function TherapyDashboard({ therapists, next, bookings, therapy, reflectionSaving, onReflection, onNotesModule, onMood, onBoard, onGuideSeen, onWheel }: { therapists: ReturnType<typeof useMyTherapists>; next: MyBooking | null; bookings: MyBooking[]; therapy: TherapyState; reflectionSaving: boolean; onReflection: (reflection: ReflectionPatch) => void; onNotesModule: (notesModule: { enabled?: boolean; shared?: boolean }) => void; onMood: (mood: number, emotions: string[]) => void; onBoard: (text: string) => void; onGuideSeen: () => void; onWheel: (answers: WheelAnswers) => void }) {
  const therapist = therapists.active;
  const [flowOpen, setFlowOpen] = useState(false);
  const [moodSheet, setMoodSheet] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  // «Ближайшая сессия» с главной ведёт сюда — сразу к записи.
  const [openBooking, setOpenBooking] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const appointmentId = Number(params.get("appointment"));
    const target = appointmentId ? bookings.find((item) => item.id === appointmentId) : null;
    if (target && target.psyName !== therapists.active) therapists.setActive(target.psyName);
    setOpenBooking(params.get("booking") === "1" || Boolean(target));
  }, [bookings, therapists.active]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: homework = [] } = useQuery({ queryKey: ["my-homework"], queryFn: () => listHomework(ME) });
  // День берём по локальной зоне, как на главной: по UTC отметка «сегодня»
  // не находилась и заливка блока не подхватывала цвет настроения.
  const todayKey = ymdLocal(new Date());
  const todayEntry = [...therapy.moods].reverse().find((e) => ymdLocal(new Date(e.date)) === todayKey);
  const startFlow = () => { tap(); setShowGuide(!therapy.tutorialSeen); setFlowOpen(true); };

  return (
    <div className="-mx-4 -mt-2 @md:-mx-9">
      {/* Шапка раздела — тон совпадает с верхней полоской (var(--page)) */}
      <header className="px-4 pb-16 pt-3 @md:px-9" style={{ background: "var(--page)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[var(--purple)]"><Icon name="therapy" width={20} weight="fill" /></span>
            <div className="leading-none"><h1 className="font-tight text-[20px] font-black">Терапия</h1><p className="font-tight mt-1 text-[12px] font-bold text-[var(--muted)]">Ваш путь между сессиями</p></div>
          </div>
        </div>

        {/* Терапевты: подбор (если нет) или переключатель + карточка активного */}
        {therapists.list.length === 0 ? (
          <FindTherapistBlock />
        ) : (
          <>
            {/* Компактный переключатель + добавить — незаметно, без лишнего места */}
            {(therapists.list.length > 1 || true) && (
              <div className="no-scrollbar mt-4 flex items-center gap-1.5 overflow-x-auto">
                {therapists.list.map((name) => {
                  const on = name === therapist;
                  const psy = PSYS.find((p) => p.name === name);
                  return (
                    <button key={name} onClick={() => therapists.setActive(name)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[11px] font-black transition-colors" style={{ background: on ? "var(--purple)" : "#fff", border: `var(--bw) solid var(--${on ? "purple-edge" : "edge-neutral"})` }}>
                      <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-[var(--purple-soft)] text-[9px] font-black">{psy ? <Image src={asset(psy.portrait)} alt="" width={20} height={20} className="h-5 w-5 object-cover" unoptimized={/^(data:|blob:)/i.test(asset(psy.portrait))} /> : name.charAt(0)}</span>
                      {name.split(" ")[0]}
                    </button>
                  );
                })}
                <Link href="/catalog" onClick={tap} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[var(--purple-edge)]" style={{ border: "var(--bw) solid var(--purple-edge)" }} aria-label="Добавить терапевта"><Icon name="plus" width={14} weight="bold" color="currentColor" /></Link>
              </div>
            )}
            {therapist && <div data-tour="therapist"><TherapistCard name={therapist} next={next} bookings={bookings} defaultOpen={openBooking} onRemove={() => therapists.remove(therapist)} /></div>}
          </>
        )}
      </header>

      <main className="relative -mt-9 rounded-t-[27px] px-4 pb-8 pt-5 @md:px-9" style={{ background: "var(--surface)" }}>
        <SessionCheckin bookings={bookings} />
        <div className="space-y-3">
          {/* Настроение дня → задания → заметки → доска → колесо. */}
          <section className="overflow-hidden rounded-[20px]" style={{ background: todayEntry?.mood ? `${moodColor(todayEntry.mood)}2e` : "var(--head-soft)" }} data-tour="mood-stats">
            <MoodHomeCard embedded mood={todayEntry?.mood} moods={therapy.moods} onOpen={() => setMoodSheet(true)} />
            <MoodStatsBlock moods={therapy.moods} />
          </section>

          <WorkWithSpecialist homework={homework} />

          <ClientSessionJourney meetings={bookings} reflections={therapy.reflections} module={therapy.notesModule} saving={reflectionSaving} onSave={onReflection} onModuleChange={onNotesModule} />

          <TherapistBoard value={therapy.board} onSave={onBoard} />

          <WellbeingCard wheel={therapy.wheel} onStart={startFlow} subtitle="видно вашему терапевту" />
        </div>
      </main>
      <MoodSheet open={moodSheet} mood={todayEntry?.mood} emotions={todayEntry?.emotions} onClose={() => setMoodSheet(false)} onSave={onMood} />
      {flowOpen && <WheelFlow guide={showGuide} onClose={() => setFlowOpen(false)} onGuideSeen={onGuideSeen} onSave={onWheel} locked={false} />}
    </div>
  );
}

// Динамика настроения — разворачивается кнопкой, чтобы не спорить с блоком «сегодня».
function MoodStatsBlock({ moods }: { moods: Mood[] }) {
  const [stats, setStats] = useState(false);
  return (
    <div className="border-t border-black/10 px-3 pb-3 pt-2.5">
      <button onClick={() => { tap(); setStats(!stats); }} className="flex w-full items-center justify-between rounded-full bg-white/70 px-3 py-2 text-[11px] font-black" aria-expanded={stats}>
        <span className="inline-flex items-center gap-1.5"><Icon name="chart" width={14} weight="bold" /> {stats ? "Свернуть динамику" : "Посмотреть динамику настроения"}</span>
        <span>{stats ? "↑" : "→"}</span>
      </button>
      <Disclosure open={stats}>
        <div className="mt-2.5 space-y-2.5">
          <MoodStats moods={moods} title="Динамика настроения" />
          <p className="px-1 text-[10px] font-semibold text-[var(--muted-2)]">Отметки видит ваш терапевт — они помогают заметить, что меняется между встречами.</p>
        </div>
      </Disclosure>
    </div>
  );
}

// Блок подбора терапевта в шапке терапии (когда никого ещё не прикреплено).
function FindTherapistBlock() {
  return (
    <Link href="/catalog" onClick={tap} className="mt-4 flex items-center gap-3 rounded-[18px] bg-white p-3.5 transition-transform active:scale-[0.99]" style={{ border: "var(--bw-lg) solid var(--purple-edge)" }}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--purple-soft)]"><Icon name="compass" width={24} weight="bold" color="var(--purple-edge)" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-black">Найти терапевта</span>
        <span className="block text-[11px] font-semibold text-[var(--muted)]">Прикрепите специалиста — здесь появятся встречи и задания. Ваша статистика уже собирается ниже.</span>
      </span>
      <span className="btn shrink-0">В каталог</span>
    </Link>
  );
}

// Карточка терапевта в стиле каталога — с переходом на его страницу и записью.
function TherapistCard({ name, next, bookings, defaultOpen, onRemove }: { name: string; next: MyBooking | null; bookings: MyBooking[]; defaultOpen?: boolean; onRemove?: () => void }) {
  const psy = PSYS.find((item) => item.name === name);
  const href = psy ? `/catalog?psy=${psy.id}&from=therapy` : "/catalog?from=therapy";
  const portrait = psy ? asset(psy.portrait) : null;
  const [bookOpen, setBookOpen] = useState(defaultOpen ?? false);
  // С главной приходят сразу к записи — параметр читается после монтирования.
  useEffect(() => { if (defaultOpen) setBookOpen(true); }, [defaultOpen]);
  // Есть запись — по умолчанию показываем управление ею, а не выбор окна.
  const [pickSlot, setPickSlot] = useState(false);
  const [booked, setBooked] = useState<{ at: string; format: string } | null>(null);
  const qc = useQueryClient();
  const invBookings = () => { for (const k of ["my-bookings", "slots", "month-avail"]) qc.invalidateQueries({ queryKey: [k] }); };
  const book = useMutation({
    mutationFn: ({ iso, format }: { iso: string; format: "online" | "offline" }) => bookSlot(name, iso, format),
    onSuccess: (b) => { success(); setBooked({ at: b.startsAt, format: b.format }); invBookings(); },
  });

  // Мои записи к этому терапевту — ближайшая первой.
  const mine = useMemo(
    () => bookings.filter((b) => b.psyName === name && new Date(b.startsAt) > new Date()).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [bookings, name],
  );
  // Нет записей — календарь открываем на ближайшем дне со свободным окном.
  const { data: avail } = useQuery({ queryKey: ["month-avail", true], queryFn: () => getMonthAvailability(true) });
  const firstFree = useMemo(() => {
    if (!avail) return undefined;
    const today = ymdLocal(new Date());
    return Object.keys(avail).filter((day) => day >= today && avail[day] === "free").sort()[0];
  }, [avail]);
  const manage = mine.length > 0 && !pickSlot && !booked;
  return (
    <div className="relative mt-3 rounded-[18px] bg-[#ffffff] p-3" style={{ border: "var(--bw-lg) solid var(--purple-edge)" }}>
      {/* Открепить — незаметная иконка в углу */}
      {onRemove && <button onClick={() => { if (confirm(`Открепить ${name}? Ваши записи к этому специалисту будут отменены.`)) onRemove(); }} className="absolute right-2 top-2 z-[1] flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-black" style={{ background: "var(--salmon-soft)", border: "var(--bw) solid var(--salmon-edge)", color: "var(--salmon-edge)" }} aria-label="Открепить терапевта">×</button>}
      {/* Тап по карточке — на страницу терапевта */}
      <Link href={href} onClick={tap} className="flex gap-3">
        {portrait ? (
          <div className="relative h-[104px] w-[88px] shrink-0 overflow-hidden rounded-[14px]" style={{ background: "var(--purple-soft)" }}>
            <Image src={portrait} alt={`Портрет: ${name}`} fill sizes="88px" className="object-cover" unoptimized={/^(data:|blob:)/i.test(portrait)} />
          </div>
        ) : (
          <div className="flex h-[104px] w-[88px] shrink-0 items-center justify-center rounded-[14px] bg-[var(--green)] text-[24px] font-black" style={{ border: "var(--bw-lg) solid var(--green-edge)" }}>{name.charAt(0)}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Ваш терапевт</p>
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[16px] font-black">{name}</p>
            {psy?.verified && <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--green)] text-[9px] font-black" title="Профиль подтверждён">✓</span>}
          </div>
          {psy && <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[var(--purple-soft)] px-2 py-0.5 text-[10px] font-black" style={{ color: "var(--purple-edge)" }}>{psy.method}</span>
            <span className="text-[11.5px] font-black">{psy.minutes} мин · {psy.price.toLocaleString("ru-RU")} ₽</span>
          </div>}
          <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-black" style={{ color: next ? "var(--olive-edge)" : "var(--muted-2)" }}>
            <Icon name="calendar" width={12} weight="bold" color={next ? "var(--olive-edge)" : "var(--muted-2)"} /> {next ? `${dateTime.format(new Date(next.startsAt))} · ${next.format === "online" ? "онлайн" : "очно"}` : "встреча пока не назначена"}
          </p>
        </div>
      </Link>
      <div className="mt-2.5 flex gap-2">
        <button onClick={() => { tap(); setBookOpen((v) => !v); }} className="btn btn-accent flex-1 py-2.5" aria-expanded={bookOpen}>
          <Icon name="calendar" width={14} weight="bold" color="#fff" /> {bookOpen ? "Свернуть" : mine.length ? "Моя запись" : "Записаться"}
        </button>
        {psy?.tg && (
          <a href={`https://t.me/${psy.tg}?text=${encodeURIComponent("Здравствуйте! Пишу из «Хроники» — хочу обсудить нашу работу.")}`} target="_blank" rel="noopener noreferrer" onClick={tap} className="btn px-4 py-2.5">
            <Icon name="telegram" width={15} weight="fill" color="#fff" /> Написать
          </a>
        )}
      </div>
      <Disclosure open={bookOpen}>
        <div className="mt-2.5 rounded-[16px] p-3" style={{ background: "var(--page)" }}>
          {booked ? (
            <div className="text-center">
              <p className="text-[13px] font-black">Вы записаны к {name.split(" ")[0]}</p>
              <p className="t-cap mt-1 inline-flex items-center gap-1.5"><Icon name="calendar" width={12} weight="bold" color="currentColor" />{new Date(booked.at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} в {new Date(booked.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} · {booked.format === "online" ? "онлайн" : "очно"}</p>
              <button onClick={() => { setBooked(null); setPickSlot(false); }} className="btn mt-2.5 px-4 py-1.5 text-[11px]">Готово</button>
            </div>
          ) : manage ? (
            <>
              {/* Запись уже есть — вместо выбора окна показываем управление ею */}
              <p className="t-micro mb-2 px-1">Ваши записи</p>
              <div className="space-y-1.5">
                {/* Ближайшая запись открыта сразу: «Моя запись» — это и есть вход в перенос/отмену */}
                {mine.map((item, index) => <BookingRow key={item.id} b={item} onChange={invBookings} defaultOpen={index === 0} />)}
              </div>
              <button onClick={() => { tap(); setPickSlot(true); }} className="btn btn-white mt-2.5 w-full py-2.5">
                <Icon name="plus" width={14} weight="bold" color="var(--ink)" /> Записаться ещё
              </button>
            </>
          ) : (
            <>
              <p className="t-micro mb-1 px-1">Свободные окна</p>
              <p className="t-cap mb-2 flex items-center gap-1.5 px-1"><Icon name="calendar" width={12} weight="bold" color="currentColor" />{next ? `Ближайшая запись — ${dateTime.format(new Date(next.startsAt))}` : "Записи пока нет — выберите день и время"}</p>
              <SlotPicker forClient variant="calendar" calendarTone="blend" showAvail startDay={firstFree} onPick={(iso, format) => book.mutate({ iso, format })} />
              {mine.length > 0 && <button onClick={() => { tap(); setPickSlot(false); }} className="back-link mt-2 w-full justify-center">Назад к моим записям</button>}
            </>
          )}
        </div>
      </Disclosure>
    </div>
  );
}
