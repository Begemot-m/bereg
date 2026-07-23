"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import Image from "next/image";

import { WheelFlow } from "@/components/balance-flow";
import { Icon } from "@/components/icons";
import { MoodHomeCard, MoodSheet } from "@/components/mood-dial";
import { MoodStats } from "@/components/mood-stats";
import { WellbeingCard } from "@/components/wellbeing-card";
import { MyBookingsManager } from "@/components/my-bookings";
import { SlotPicker } from "@/components/slot-picker";
import { Disclosure, SkeletonRow } from "@/components/ui";
import { bookSlot } from "@/lib/mybookings";
import { HW_LABEL, listHomework, updateHomework, type Homework, type HwStatus, type MyBooking, type Mood, listMyBookings } from "@/lib/clients";
import { getMyTherapy, updateMyTherapy, type TherapyState, type WheelAnswers } from "@/lib/therapy";
import { asset } from "@/lib/asset";
import { PSYS } from "@/lib/catalog";
import { getSubscription, startSubscription } from "@/lib/subscription";
import { select, success, tap } from "@/lib/haptics";
import { loadTherapists, saveTherapists, type TherapistStore } from "@/lib/therapists";
import { TherapyGuide, therapyGuideSeen } from "@/components/therapy-guide";

const ME = 1; // в демо клиент «я» — карточка №1
const dateTime = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

// Прикреплённые терапевты: общий стор (каталог добавляет) + автодобавление из записей.
function useMyTherapists(bookingNames: string[]) {
  const [store, setStore] = useState<TherapistStore>({ list: [], removed: [], active: null });
  const sync = () => {
    const base = loadTherapists();
    const merged = [...new Set([...base.list, ...bookingNames.filter((n) => !base.removed.includes(n))])];
    const active = base.active && merged.includes(base.active) ? base.active : merged[0] ?? null;
    const next = { ...base, list: merged, active };
    setStore(next);
    if (merged.length !== base.list.length || active !== base.active) saveTherapists(next);
  };
  useEffect(() => { sync(); const on = () => sync(); window.addEventListener("bereg:therapists", on); return () => window.removeEventListener("bereg:therapists", on); }, [bookingNames.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const persist = (nextStore: TherapistStore) => { setStore(nextStore); saveTherapists(nextStore); };
  return {
    list: store.list,
    active: store.active,
    setActive: (name: string) => { select(); persist({ ...store, active: name }); },
    remove: (name: string) => { tap(); const list = store.list.filter((n) => n !== name); persist({ list, removed: [...new Set([...store.removed, name])], active: store.active === name ? list[0] ?? null : store.active }); },
  };
}

export default function TherapyPage() {
  const qc = useQueryClient();
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings });
  const { data: therapy, isLoading: therapyLoading } = useQuery({ queryKey: ["my-therapy"], queryFn: getMyTherapy });
  const ordered = useMemo(() => [...bookings].sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [bookings]);
  const bookingNames = useMemo(() => [...new Set(ordered.map((b) => b.psyName))], [ordered]);
  const therapists = useMyTherapists(bookingNames);
  const active = therapists.active;
  const next = ordered.find((item) => item.psyName === active && new Date(item.startsAt) > new Date())
    ?? ordered.find((item) => new Date(item.startsAt) > new Date()) ?? null;
  const save = useMutation({ mutationFn: updateMyTherapy, onSuccess: (state) => qc.setQueryData(["my-therapy"], state) });

  // Пошаговый гайд при первом заходе в раздел.
  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(() => { if (!therapyGuideSeen()) setGuideOpen(true); }, []);

  if (bookingsLoading || therapyLoading || !therapy) return <div className="space-y-3 py-8"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>;
  // Интерфейс терапии показывается всегда — статистика копится независимо от терапевта.
  return <>
    <TherapyDashboard therapists={therapists} next={next} bookings={ordered} therapy={therapy} onMood={(mood, emotions) => save.mutate({ mood, emotions })} onGuideSeen={() => save.mutate({ tutorialSeen: true })} onWheel={(answers) => save.mutate({ wheel: answers })} />
    {guideOpen && <TherapyGuide onClose={() => setGuideOpen(false)} />}
  </>;
}

function TherapyDashboard({ therapists, next, bookings, therapy, onMood, onGuideSeen, onWheel }: { therapists: ReturnType<typeof useMyTherapists>; next: MyBooking | null; bookings: MyBooking[]; therapy: TherapyState; onMood: (mood: number, emotions: string[]) => void; onGuideSeen: () => void; onWheel: (answers: WheelAnswers) => void }) {
  const therapist = therapists.active;
  const [tab, setTab] = useState<"общее" | "терапевт">("общее");
  const [flowOpen, setFlowOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  const buySub = useMutation({ mutationFn: () => startSubscription("client"), onSuccess: (r) => { if (r.confirmation_url) window.location.href = r.confirmation_url; } });

  const qc = useQueryClient();
  const { data: homework = [] } = useQuery({ queryKey: ["my-homework"], queryFn: () => listHomework(ME) });
  const invHomework = () => qc.invalidateQueries({ queryKey: ["my-homework"] });
  const done = homework.filter((h) => h.status === "done").length;
  const taskProgress = homework.length ? Math.round(done / homework.length * 100) : 0;
  const completedSessions = bookings.filter((b) => new Date(b.startsAt) < new Date()).length;
  const todayEntry = [...therapy.moods].reverse().find((e) => e.date.slice(0, 10) === new Date().toISOString().slice(0, 10));
  const startFlow = () => { tap(); setShowGuide(!therapy.tutorialSeen); setFlowOpen(true); };

  return (
    <div className="-mx-4 -mt-2 @md:-mx-9">
      {/* Шапка раздела — тон совпадает с верхней полоской (var(--page)) */}
      <header className="px-4 pb-16 pt-3 @md:px-9" style={{ background: "var(--page)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[var(--purple)]" style={{ border: "var(--bw) solid var(--purple-edge)" }}><Icon name="therapy" width={20} weight="fill" /></span>
            <div className="leading-none"><h1 className="font-tight text-[20px] font-black">Терапия</h1><p className="mt-0.5 text-[11px] font-bold text-[var(--muted)]">Ваш путь между сессиями</p></div>
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
            {therapist && <TherapistCard name={therapist} next={next} onRemove={() => therapists.remove(therapist)} />}
          </>
        )}
      </header>

      <main className="relative -mt-9 rounded-t-[30px] bg-[#fffaf0] px-4 pb-8 pt-5 @md:px-9" style={{ borderTop: "var(--bw-lg) solid var(--edge-neutral)" }}>
        <Segmented tab={tab} onChange={setTab} />

        {tab === "общее" ? (
          <div className="mt-4 space-y-3">
            <MoodModule today={todayEntry} moods={therapy.moods} onSave={onMood} />
            <WellbeingCard wheel={therapy.wheel} onStart={startFlow} subtitle="видно вашему терапевту" />
          </div>
        ) : !therapist ? (
          <div className="mt-4"><FindTherapistBlock /></div>
        ) : (
          <div className="mt-4 space-y-3">
            {/* Прогресс с терапевтом — крупная цифра встреч */}
            <section className="rounded-[22px] bg-[var(--green-soft)] p-4" style={{ border: "var(--bw-lg) solid var(--green-edge)" }}>
              <p className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Прогресс с терапевтом</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-[74px] w-[74px] shrink-0 flex-col items-center justify-center rounded-[20px] bg-white" style={{ border: "var(--bw-lg) solid var(--green-edge)" }}>
                  <span className="font-tight tnum text-[30px] font-black leading-none">{completedSessions}</span>
                  <span className="mt-1 text-[9px] font-black uppercase tracking-[.08em] text-[var(--muted)]">{plural(completedSessions, "встреча", "встречи", "встреч")}</span>
                </div>
                <div className="grid flex-1 grid-cols-2 gap-2">
                  <Metric value={`${taskProgress}%`} label="заданий" edge="var(--coral-edge)" bg="var(--coral-soft)" />
                  <Metric value={next ? "1" : "0"} label="впереди" edge="var(--amber-edge)" bg="var(--amber-soft)" />
                </div>
              </div>
              <p className="mt-3 text-[10px] font-semibold text-[var(--muted)]">{next ? `Ближайшая: ${dateTime.format(new Date(next.startsAt))}` : "Новая встреча пока не назначена"}</p>
            </section>

            {/* Домашние задания — тот же блок, что видит психолог */}
            <section>
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-[13px] font-black uppercase tracking-[.06em]">Домашние задания</h2>
                <span className="text-[11px] font-black text-[var(--muted)]">{done}/{homework.length}</span>
              </div>
              <div className="rounded-[20px] p-3" style={{ background: "var(--surface-2)", border: "var(--bw-lg) solid var(--edge-neutral)" }}>
                <ClientHomework items={homework} onChanged={invHomework} />
              </div>
            </section>

            {/* Управление записью: перенести, отменить, записаться */}
            <section>
              <h2 className="mb-2 px-1 text-[13px] font-black uppercase tracking-[.06em]">Ваши записи</h2>
              <MyBookingsManager />
            </section>
          </div>
        )}
      </main>
      {flowOpen && <WheelFlow guide={showGuide} onClose={() => setFlowOpen(false)} onGuideSeen={onGuideSeen} onSave={onWheel} locked={!sub?.clientPro} onUnlock={() => buySub.mutate()} />}
    </div>
  );
}

// Настроение: миниатюра → окно с диском; статистика разворачивается кнопкой.
function MoodModule({ today, moods, onSave }: { today?: Mood; moods: Mood[]; onSave: (mood: number, emotions: string[]) => void }) {
  const [sheet, setSheet] = useState(false);
  const [stats, setStats] = useState(false);
  return (
    <div className="space-y-2.5">
      <MoodHomeCard mood={today?.mood} moods={moods} onOpen={() => setSheet(true)} />
      <button onClick={() => { tap(); setStats(!stats); }} className="flex w-full items-center justify-center gap-1.5 rounded-full bg-white py-2.5 text-[12.5px] font-black text-[var(--muted)]" style={{ border: "var(--bw) solid var(--edge-neutral)" }} aria-expanded={stats}>
        <Icon name="chart" width={15} weight="bold" /> {stats ? "Свернуть статистику" : "Статистика настроения"}
      </button>
      <Disclosure open={stats}>
        <div className="space-y-2.5">
          <MoodStats moods={moods} title="Динамика настроения" />
          <p className="px-1 text-[10px] font-semibold text-[var(--muted-2)]">Отметки видит ваш терапевт — они помогают заметить, что меняется между встречами.</p>
        </div>
      </Disclosure>
      <MoodSheet open={sheet} mood={today?.mood} emotions={today?.emotions} onClose={() => setSheet(false)} onSave={onSave} />
    </div>
  );
}

function Segmented({ tab, onChange }: { tab: "общее" | "терапевт"; onChange: (t: "общее" | "терапевт") => void }) {
  const items: { key: "общее" | "терапевт"; label: string }[] = [{ key: "общее", label: "Общее" }, { key: "терапевт", label: "С терапевтом" }];
  return (
    <div className="flex gap-1 rounded-full bg-white p-1" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
      {items.map((it) => (
        <button key={it.key} onClick={() => { tap(); onChange(it.key); }} className="flex-1 rounded-full py-2 text-[13px] font-black transition-colors" style={tab === it.key ? { background: "var(--ink)", color: "#fff" } : { color: "var(--muted)" }}>{it.label}</button>
      ))}
    </div>
  );
}

function Metric({ value, label, edge, bg = "var(--green-soft)" }: { value: string; label: string; edge: string; bg?: string }) {
  return <div className="rounded-[15px] p-2.5 text-center" style={{ background: bg, border: `var(--bw) solid ${edge}` }}><p className="font-tight tnum text-[20px] font-black leading-none">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[.05em]">{label}</p></div>;
}

// Блок подбора терапевта в шапке терапии (когда никого ещё не прикреплено).
function FindTherapistBlock() {
  return (
    <Link href="/catalog" onClick={tap} className="mt-4 flex items-center gap-3 rounded-[20px] bg-[#fffdf7] p-3.5 transition-transform active:scale-[0.99]" style={{ border: "2.5px dashed var(--purple-edge)" }}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--purple-soft)]" style={{ border: "var(--bw-lg) solid var(--purple-edge)" }}><Icon name="compass" width={24} weight="bold" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-black">Найти терапевта</span>
        <span className="block text-[11px] font-semibold text-[var(--muted)]">Прикрепите специалиста — здесь появятся встречи и задания. Ваша статистика уже собирается ниже.</span>
      </span>
      <span className="shrink-0 rounded-full bg-[var(--purple)] px-3 py-2 text-[11px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>Подобрать</span>
    </Link>
  );
}

// Карточка терапевта в стиле каталога — с переходом на его страницу и записью.
function TherapistCard({ name, next, onRemove }: { name: string; next: MyBooking | null; onRemove?: () => void }) {
  const psy = PSYS.find((item) => item.name === name);
  const href = psy ? `/catalog?psy=${psy.id}` : "/catalog";
  const portrait = psy ? asset(psy.portrait) : null;
  const [bookOpen, setBookOpen] = useState(false);
  const [booked, setBooked] = useState<{ at: string; format: string } | null>(null);
  const qc = useQueryClient();
  const book = useMutation({
    mutationFn: ({ iso, format }: { iso: string; format: "online" | "offline" }) => bookSlot(name, iso, format),
    onSuccess: (b) => { success(); setBooked({ at: b.startsAt, format: b.format }); qc.invalidateQueries({ queryKey: ["my-bookings"] }); qc.invalidateQueries({ queryKey: ["slots"] }); qc.invalidateQueries({ queryKey: ["month-avail"] }); },
  });
  return (
    <div className="relative mt-3 rounded-[20px] bg-[#fffdf7] p-3" style={{ border: "var(--bw-lg) solid var(--purple-edge)" }}>
      {/* Открепить — незаметная иконка в углу */}
      {onRemove && <button onClick={() => { if (confirm(`Открепить ${name}?`)) onRemove(); }} className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-black text-[var(--muted-2)] hover:text-[var(--ink)]" aria-label="Открепить терапевта">×</button>}
      {/* Тап по карточке — на страницу терапевта */}
      <Link href={href} onClick={tap} className="flex gap-3">
        {portrait ? (
          <div className="relative h-[104px] w-[88px] shrink-0 overflow-hidden rounded-[16px]" style={{ border: "var(--bw-lg) solid var(--purple-edge)", background: "var(--purple-soft)" }}>
            <Image src={portrait} alt={`Портрет: ${name}`} fill sizes="88px" className="object-cover" unoptimized={/^(data:|blob:)/i.test(portrait)} />
          </div>
        ) : (
          <div className="flex h-[104px] w-[88px] shrink-0 items-center justify-center rounded-[16px] bg-[var(--green)] text-[24px] font-black" style={{ border: "var(--bw-lg) solid var(--green-edge)" }}>{name.charAt(0)}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Ваш терапевт · открыть профиль ›</p>
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[16px] font-black">{name}</p>
            {psy?.verified && <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--green)] text-[9px] font-black" style={{ border: "var(--bw) solid var(--green-edge)" }} title="Профиль подтверждён">✓</span>}
          </div>
          {psy && <p className="mt-0.5 text-[11px] font-bold text-[var(--muted)]">{psy.method} · {psy.minutes} мин · {psy.price.toLocaleString("ru-RU")} ₽</p>}
          <p className="mt-1 text-[11px] font-bold text-[var(--muted)]">{next ? `${dateTime.format(new Date(next.startsAt))} · ${next.format === "online" ? "онлайн" : "очно"}` : "встреча пока не назначена"}</p>
        </div>
      </Link>
      <div className="mt-2.5 flex gap-2">
        <button onClick={() => { tap(); setBookOpen((v) => !v); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--ink)] py-2.5 text-[12px] font-black text-white transition-transform active:scale-[0.98]" aria-expanded={bookOpen}>
          <Icon name="calendar" width={14} weight="bold" color="#fff" /> Записаться
        </button>
        {psy?.tg && (
          <a href={`https://t.me/${psy.tg}?text=${encodeURIComponent("Здравствуйте! Пишу из «Клубок» — хочу обсудить нашу работу.")}`} target="_blank" rel="noopener noreferrer" onClick={tap} className="flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[12px] font-black text-[var(--ink)] transition-transform active:scale-[0.98]" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
            <Icon name="spark" width={14} weight="fill" /> Написать
          </a>
        )}
      </div>
      <Disclosure open={bookOpen}>
        <div className="mt-2.5 rounded-[16px] bg-white p-3" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
          {booked ? (
            <div className="text-center">
              <p className="text-[13px] font-black">Вы записаны к {name.split(" ")[0]}</p>
              <p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">{new Date(booked.at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} в {new Date(booked.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} · {booked.format === "online" ? "онлайн" : "очно"}</p>
              <button onClick={() => { setBooked(null); setBookOpen(false); }} className="mt-2.5 rounded-full bg-[var(--purple-soft)] px-4 py-1.5 text-[11px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>Готово</button>
            </div>
          ) : (
            <>
              <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Свободные окна</p>
              <SlotPicker forClient variant="strip" daysAhead={14} onPick={(iso, format) => book.mutate({ iso, format })} />
            </>
          )}
        </div>
      </Disclosure>
    </div>
  );
}

const HW_FLOW: HwStatus[] = ["assigned", "doing", "done"];
const HW_TONE: Record<HwStatus, string> = { assigned: "amber", doing: "purple", done: "green" };

// Задания от терапевта — тот же блок с историей и процессом, что у психолога.
function ClientHomework({ items, onChanged }: { items: Homework[]; onChanged: () => void }) {
  if (!items.length) return <p className="px-1 py-2 text-[12px] font-semibold text-[var(--muted-2)]">Заданий пока нет — терапевт пришлёт их после встречи.</p>;
  return (
    <div className="space-y-2">
      {items.map((hw) => (
        <HomeworkRow key={hw.id} hw={hw} onChanged={onChanged} />
      ))}
    </div>
  );
}

function HomeworkRow({ hw, onChanged }: { hw: Homework; onChanged: () => void }) {
  const save = useMutation({ mutationFn: (status: HwStatus) => updateHomework(hw.id, { status }), onSuccess: onChanged });
  const tone = HW_TONE[hw.status];
  return (
    <div className="rounded-[16px] bg-white p-3" style={{ border: `var(--bw) solid var(--${tone}-edge)` }}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 h-8 w-1.5 shrink-0 rounded-full" style={{ background: `var(--${tone})` }} />
        <p className={`flex-1 text-[12.5px] font-bold leading-snug ${hw.status === "done" ? "opacity-55 line-through" : ""}`}>{hw.text}</p>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {HW_FLOW.map((status) => {
          const on = hw.status === status;
          return (
            <button key={status} onClick={() => { select(); save.mutate(status); }} className="flex-1 rounded-full py-1.5 text-[10.5px] font-black transition-colors" style={{ background: on ? `var(--${HW_TONE[status]})` : "#fff", border: `var(--bw) solid var(--${on ? `${HW_TONE[status]}-edge` : "edge-neutral"})`, color: on ? "var(--ink)" : "var(--muted-2)" }}>
              {HW_LABEL[status]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
