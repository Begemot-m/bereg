"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { MonthCalendar } from "@/components/calendar";
import { ArrowGlyph, PageHead } from "@/components/blocks";
import { ClientPicker, DaySlots } from "@/components/day-slots";
import { SCHEDULE_HELP, SESSIONS_HELP } from "@/components/help-deck";

// Справка открывается по кнопке «Как это работает?» — до этого не нужна.
const HelpDeck = dynamic(() => import("@/components/help-deck").then((m) => m.HelpDeck));
import { Icon } from "@/components/icons";
import { SlotPicker } from "@/components/slot-picker";
import { WeekStrip } from "@/components/week-strip";
import { DayAgenda, WeekWindows } from "@/components/week-windows";
import { SessionInviteButton } from "@/components/session-invite";
// Редактор графика — самый тяжёлый компонент раздела: перетаскивание,
// пружины, мини-неделя. В начальный бандл «Сессий» ему попадать незачем,
// его открывают редко и осознанно.
const WorkHoursEditor = dynamic(() => import("@/components/work-hours").then((m) => m.WorkHoursEditor), {
  loading: () => <div className="skeleton h-64" />,
});
import { useCancelLockDays } from "@/lib/cancel-policy";
import { Button, Card, Disclosure, SkeletonRow } from "@/components/ui";
import { createAppointment, listAppointments, type ApptFormat } from "@/lib/appointments";
import { select, success, tap } from "@/lib/haptics";
import { createClient, listClients } from "@/lib/clients";
import { ProPaywall } from "@/components/pro-sell";
import { getSubscription, isPro, FREE_CLIENT_LIMIT } from "@/lib/subscription";
import { useRole } from "@/lib/role";
import { getMonthAvailability, getOverrides, getWorkHours, setOverride, WEEKDAYS, ymdLocal, type WorkHours } from "@/lib/schedule";

const EASE = [0.16, 1, 0.3, 1] as const;
const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const dayShort = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const weekdayF = new Intl.DateTimeFormat("ru-RU", { weekday: "long" });
const SCHEDULE_SETUP_KEY = "bereg:schedule-setup-seen:v1";

export default function SessionsPage() {
  const [role, , roleReady] = useRole();
  const router = useRouter();
  // Раздел «Мои сессии» у клиента убран — запись живёт в Терапии. Ждём, пока
  // роль прочитается: до этого она числится клиентской у всех подряд, и
  // психолога вышвыривало из собственных сессий.
  useEffect(() => {
    if (roleReady && role !== "psychologist") router.replace("/therapy");
  }, [roleReady, role, router]);
  if (!roleReady || role !== "psychologist") return null;
  return <PsySessions />;
}

/* ============ Психолог ============ */

function relLabel(ymd: string): string | null {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const d = new Date(ymd + "T00:00:00");
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  if (diff === -1) return "Вчера";
  return null;
}
function dateHeader(ymd: string): string {
  const d = new Date(ymd + "T00:00:00");
  const rel = relLabel(ymd);
  return `${dayShort.format(d)} · ${rel ? rel + " · " : ""}${weekdayF.format(d)}`;
}
// Относительный день с цветом: сегодня — персик, завтра — олива, вчера — коралл.
function relTone(ymd: string): { label: string; tone: string } | null {
  const rel = relLabel(ymd);
  if (rel === "Сегодня") return { label: rel, tone: "peach" };
  if (rel === "Завтра") return { label: rel, tone: "green" };
  if (rel === "Вчера") return { label: rel, tone: "coral" };
  return null;
}

type View = "soon" | "week";

function PsySessions() {
  const qc = useQueryClient();
  const search = useSearchParams();
  const [view, setView] = useState<View>("soon");
  const [selDay, setSelDay] = useState<string | null>(null);
  // Календарь — не вкладка, а разворот верхней плашки вместо ленты дат.
  const [calOpen, setCalOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [scheduleHelp, setScheduleHelp] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [scheduleFirstVisit, setScheduleFirstVisit] = useState(false);
  const [scheduleReady, setScheduleReady] = useState(false);

  const appointmentsQuery = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });
  const availabilityQuery = useQuery({ queryKey: ["month-avail", false], queryFn: () => getMonthAvailability(false) });
  const workQuery = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const overridesQuery = useQuery({ queryKey: ["overrides"], queryFn: getOverrides });
  const appts = appointmentsQuery.data ?? [];
  const avail = availabilityQuery.data;
  const work = workQuery.data;
  const overrides = overridesQuery.data ?? {};
  const isLoading = appointmentsQuery.isLoading;
  const loadError = [appointmentsQuery, availabilityQuery, workQuery, overridesQuery].some((query) => query.isError);
  const inv = () => { for (const k of ["appointments", "slots", "month-avail", "overrides"]) qc.invalidateQueries({ queryKey: [k] }); };

  useEffect(() => {
    const appointmentId = Number(search.get("appointment"));
    const requestedDate = search.get("date");
    const target = appointmentId ? appts.find((item) => item.id === appointmentId) : null;
    const date = target ? ymdLocal(new Date(target.startsAt)) : requestedDate;
    if (!date) return;
    setView("soon");
    setCalOpen(false);
    setSelDay(date);
  }, [appts, search]);

  useEffect(() => {
    const seen = window.localStorage.getItem(SCHEDULE_SETUP_KEY) === "1";
    setScheduleFirstVisit(!seen);
    setScheduleReady(true);
  }, []);

  const finishScheduleIntro = (keepOpen = false) => {
    window.localStorage.setItem(SCHEDULE_SETUP_KEY, "1");
    setScheduleFirstVisit(false);
    setScheduleOpen(keepOpen);
  };

  const [multiMode, setMultiMode] = useState(false);
  const [multiDays, setMultiDays] = useState<Set<string>>(new Set());
  const [bulkMenu, setBulkMenu] = useState(false);
  const closeMultiMode = () => { setMultiMode(false); setMultiDays(new Set()); setBulkMenu(false); };
  const openCalendar = () => { tap(); setCalOpen(true); setMultiMode(false); };
  const bulk = useMutation({ mutationFn: async (ops: { iso: string; patch: { removed?: boolean; fmt?: ApptFormat } }[]) => { for (const o of ops) await setOverride(o.iso, o.patch); }, onSuccess: () => { success(); closeMultiMode(); inv(); } });
  const toggleDay = (y: string) => setMultiDays((prev) => { const n = new Set(prev); n.has(y) ? n.delete(y) : n.add(y); return n; });
  const daySlots = (ymd: string) => {
    const d = new Date(ymd + "T00:00:00"); const wd = (d.getDay() + 6) % 7; const now = Date.now();
    return (work?.hours?.[wd] ?? []).map((s) => { const [hh, mm] = s.t.split(":").map(Number); const dt = new Date(d); dt.setHours(hh, mm, 0, 0); const iso = dt.toISOString(); return { iso, past: dt.getTime() < now, appt: appts.find((a) => a.status !== "cancelled" && new Date(a.startsAt).getTime() === dt.getTime()), removed: !!overrides[iso]?.removed }; });
  };
  const bulkAct = (kind: "off" | "open" | "online" | "offline") => {
    const ops: { iso: string; patch: { removed?: boolean; fmt?: ApptFormat } }[] = [];
    for (const ymd of multiDays) for (const s of daySlots(ymd)) {
      if (s.past) continue;
      if (kind === "off" && !s.appt && !s.removed) ops.push({ iso: s.iso, patch: { removed: true } });
      if (kind === "open" && s.removed) ops.push({ iso: s.iso, patch: { removed: false } });
      if (kind === "online" && !s.appt) ops.push({ iso: s.iso, patch: { fmt: "online" } });
      if (kind === "offline" && !s.appt) ops.push({ iso: s.iso, patch: { fmt: "offline" } });
    }
    if (ops.length) bulk.mutate(ops); else closeMultiMode();
  };

  const todayY = ymdLocal(new Date());
  const markedDays = new Set(appts.filter((a) => a.status !== "cancelled").map((a) => ymdLocal(new Date(a.startsAt))));
  // Ближайшие дни (сегодня, завтра …) с окнами или записями
  const soonDays = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }).filter((d) => {
    const y = ymdLocal(d);
    const hasAppt = appts.some((a) => a.status !== "cancelled" && ymdLocal(new Date(a.startsAt)) === y);
    return selDay ? y === selDay && hasAppt : hasAppt;
  });

  if (loadError) return <div className="card-soft p-5 text-center"><p className="t-head">Не удалось загрузить сессии</p><p className="t-sub mt-1">Проверьте соединение и попробуйте ещё раз.</p><button onClick={() => void Promise.all([appointmentsQuery.refetch(), availabilityQuery.refetch(), workQuery.refetch(), overridesQuery.refetch()])} className="btn mt-4">Повторить</button></div>;

  return (
    <div>
      <PageHead
        title="Сессии"
        icon="calendar"
        sub={calOpen ? (selDay ? dateHeader(selDay) : "Выберите день") : view === "soon" ? (selDay ? dateHeader(selDay) : "Управление расписанием и встречами") : "Неделя целиком"}
        right={
          <button onClick={() => { tap(); setHelp(true); }} className="btn h-9 shrink-0 px-3.5 text-[11.5px]">
            <Icon name="question" width={14} weight="bold" color="#fff" /> Как это работает?
          </button>
        }
      >
        {/* Календарь занимает шапку целиком, лента дат сворачивается. */}
        <Disclosure open={!calOpen} autoScroll={false}>
          <WeekStrip selected={selDay ?? todayY} marked={markedDays} onSelect={(y) => { setView("soon"); setSelDay(y === selDay ? null : y); }} />
        </Disclosure>
        <Disclosure open={calOpen} autoScroll={false}>
          <div>
            <MonthCalendar appts={appts} selected={selDay} onSelectDay={(y) => { select(); setSelDay(y); }} avail={avail} tone="blend" multi={multiMode ? multiDays : undefined} onToggle={toggleDay} />
            {/* Выбор нескольких дней и действия над ними — рядом, под календарём */}
            <div className="mt-2 flex items-center justify-center gap-2">
              <button
                onClick={() => { tap(); setMultiMode(!multiMode); setMultiDays(new Set()); setBulkMenu(false); }}
                className={`btn px-4 py-1.5 text-[11.5px] ${multiMode ? "" : "btn-accent"}`}
              >
                <Icon name="check" width={13} weight="bold" color="#fff" />
                {multiMode ? "Готово" : "Выбор"}
              </button>
              {multiMode && (
                <button disabled={multiDays.size === 0} onClick={() => { tap(); setBulkMenu(!bulkMenu); }} className="btn btn-accent px-4 py-1.5 text-[11.5px]" aria-expanded={bulkMenu}>
                  <Icon name="gear" width={13} weight="bold" color="#fff" /> Действия{multiDays.size ? ` · ${multiDays.size}` : ""}
                </button>
              )}
            </div>
            {/* Список раскрывается в потоке: всплывашка тут обрезалась разворотом
                календаря (у него overflow: hidden) — кнопка нажималась впустую. */}
            <Disclosure open={multiMode && bulkMenu && multiDays.size > 0} autoScroll={false}>
              <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-[12px] p-1.5 stroke" style={{ background: "#fff" }}>
                <BulkItem onClick={() => bulkAct("off")}>🌙 Выходные</BulkItem>
                <BulkItem onClick={() => bulkAct("open")}>↺ Открыть окна</BulkItem>
                <BulkItem onClick={() => bulkAct("online")}>📹 Все онлайн</BulkItem>
                <BulkItem onClick={() => bulkAct("offline")}>📍 Все очно</BulkItem>
              </div>
            </Disclosure>
          </div>
        </Disclosure>
      </PageHead>

      <div className="sheet">
        <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {/* Слева — настройка графика */}
          <button data-tour="schedule" onClick={() => { tap(); setScheduleOpen((v) => !v); setQuickAdd(false); }} className="inline-flex min-h-9 w-fit items-center gap-1.5 text-[12px] font-black text-[var(--edge)]" aria-expanded={scheduleOpen}>
            {scheduleOpen ? <ArrowGlyph size={13} style={{ transform: "rotate(-90deg)" }} /> : <Icon name="gear" width={14} weight="bold" color="var(--edge)" />} {scheduleOpen ? "Свернуть" : "График"}
          </button>

          {/* Центр — весёлый зелёный крестик быстрой записи */}
          <motion.button
            onClick={() => { tap(); setQuickAdd((v) => !v); setScheduleOpen(false); }}
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.06 }}
            animate={quickAdd ? { rotate: 45 } : { rotate: 0, y: [0, -3, 0] }}
            transition={quickAdd ? { type: "spring", stiffness: 400, damping: 14 } : { rotate: { type: "spring", stiffness: 400, damping: 14 }, y: { duration: 2.2, repeat: Infinity, ease: "easeInOut" } }}
            className="flex h-11 w-11 items-center justify-center rounded-[15px]"
            style={{ background: quickAdd ? "var(--ink)" : "var(--edge)" }}
            data-tour="quick-add"
            aria-label="Быстрая запись"
            aria-expanded={quickAdd}
          >
            <Icon name="plus" width={22} weight="bold" color="#fff" />
          </motion.button>

          {/* Справа — помощь */}
          <button
            data-tour="calendar"
            onClick={() => { tap(); setCalOpen((v) => !v); closeMultiMode(); }}
            aria-expanded={calOpen}
            className="inline-flex min-h-9 w-fit items-center gap-1.5 justify-self-end text-[12px] font-black text-[var(--edge)]"
          >
            {calOpen ? <ArrowGlyph size={13} style={{ transform: "rotate(-90deg)" }} /> : <Icon name="calendar" width={14} weight="bold" color="var(--edge)" />}
            {calOpen ? "Свернуть" : "Календарь"}
          </button>
        </div>

        {/* Позвать клиента на свободное окно — рядом с расписанием, а не в кабинете */}
        <SessionInviteButton />

        <QuickAddBooking open={quickAdd} onClose={() => setQuickAdd(false)} />
        {scheduleReady && (
          <ScheduleSetup
            work={work}
            firstVisit={scheduleFirstVisit}
            open={scheduleOpen}
            onOpen={() => { tap(); setScheduleOpen(true); }}
            onToggle={() => { tap(); setScheduleOpen((value) => !value); }}
            onLater={() => finishScheduleIntro(false)}
            onHelp={() => { tap(); setScheduleHelp(true); }}
            onSaved={() => finishScheduleIntro(false)}
          />
        )}
        {!calOpen && <Segmented value={view} onChange={(v) => { tap(); setView(v); }} />}
        {help && <HelpDeck title="Как работают сессии" pages={SESSIONS_HELP} onClose={() => setHelp(false)} />}
        {scheduleHelp && <HelpDeck title="Как настроить расписание" pages={SCHEDULE_HELP} onClose={() => setScheduleHelp(false)} />}

        {!calOpen && view === "soon" && (
          isLoading ? (
            <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>
          ) : selDay ? (
            // День выбран сверху — весь день окнами: свободные и занятые, как в календаре.
            <DayAgenda key={selDay} date={new Date(selDay + "T00:00:00")} today={selDay === todayY} />
          ) : soonDays.length === 0 ? (
            <EmptyState onAdd={openCalendar} selDay={null} />
          ) : (
            <div className="space-y-6">
              {soonDays.map((d) => {
                const y = ymdLocal(d);
                return (
                  <div key={y}>
                    {/* Тот же заголовок дня, что в «Неделе»: линия-разделитель
                        и своя типографика выбивались из остальных блоков. */}
                    <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[13.5px] font-black capitalize">{weekdayF.format(new Date(y + "T00:00:00"))}, {d.getDate()}</h3>
                        {(() => { const r = relTone(y); return r && <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide" style={{ background: `var(--${r.tone}-soft)`, color: `var(--${r.tone}-edge)` }}>{r.label}</span>; })()}
                      </div>
                      <p className="text-[10.5px] font-black text-[var(--muted-2)]">{dayShort.format(new Date(y + "T00:00:00"))}</p>
                    </div>
                    <DaySlots date={d} />
                  </div>
                );
              })}
            </div>
          )
        )}

        {!calOpen && view === "week" && <WeekWindows />}

        {calOpen && (
          <div>
            {multiMode ? (
              <p className="text-center text-[13px] font-semibold text-[var(--muted-2)]">{multiDays.size ? `Выбрано дней: ${multiDays.size}. Действия применятся ко всем.` : "Тапайте по дням в календаре, чтобы выбрать несколько."}</p>
            ) : selDay ? (
              <DayAgenda key={selDay} date={new Date(selDay + "T00:00:00")} today={selDay === todayY} />
            ) : (
              <p className="text-center text-[13px] font-semibold text-[var(--muted-2)]">Выберите день в календаре — покажу свободные окна и записи.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScheduleSetup({ work, firstVisit, open, onOpen, onToggle, onLater, onHelp, onSaved }: { work?: WorkHours; firstVisit: boolean; open: boolean; onOpen: () => void; onToggle: () => void; onLater: () => void; onHelp: () => void; onSaved: () => void }) {
  const activeDays = WEEKDAYS.filter((_, day) => (work?.hours?.[day]?.length ?? 0) > 0);
  const summary = activeDays.length
    ? `${activeDays.join(", ")} · ${work?.sessionMinutes ?? 50} мин`
    : "Рабочие дни пока не указаны";

  return (
    <div className={open ? "mb-4" : ""}>
      {/* Первый визит — всплывающее окно с приглашением настроить окна */}
      {firstVisit && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-[rgba(32,28,24,.44)] p-3 @md:items-center" onClick={onLater}>
          <section onClick={(e) => e.stopPropagation()} className="chunk w-full max-w-md overflow-hidden p-0" style={{ background: "var(--surface)" }}>
            <div className="p-5" style={{ background: "var(--olive)", borderBottom: "var(--bw-lg) solid var(--olive-edge)" }}>
              <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-white"><Icon name="clock" width={23} weight="bold" /></span>
              <p className="mt-3 text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Первый шаг</p>
              <h2 className="font-tight mt-1 text-[20px] font-black leading-tight">Настройте рабочие часы</h2>
              <p className="mt-1 text-[12px] font-semibold text-[var(--muted)]">Клиенты увидят только свободные окна, а занятые сессии появятся в календаре автоматически.</p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-1.5">
                {["Выберите дни", "Добавьте окна", "Сохраните"].map((label, index) => (
                  <div key={label} className="rounded-[12px] px-2 py-2.5 text-center" style={{ background: "var(--olive-soft)" }}>
                    <span className="tnum block text-[11px] font-black text-[var(--olive-edge)]">0{index + 1}</span>
                    <span className="mt-0.5 block text-[10px] font-extrabold leading-tight">{label}</span>
                  </div>
                ))}
              </div>
              <button onClick={onOpen} className="mt-4 w-full rounded-[14px] bg-[var(--ink)] py-3 text-[14px] font-black text-white transition-transform active:scale-[0.98]">Настроить сейчас</button>
              <div className="mt-2 flex items-center justify-between">
                <button onClick={onHelp} className="px-1 py-1.5 text-[12px] font-extrabold text-[var(--muted)] hover:text-[var(--ink)]">Как настроить?</button>
                <button onClick={onLater} className="px-1 py-1.5 text-[12px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Позже</button>
              </div>
            </div>
          </section>
        </div>
      )}

      <Disclosure open={open} autoScroll={false}>
        {/* Не .chunk: внутри графика рамки осмысленны, а правило «блок внутри
            блока — без рамки» сняло бы их у шкалы, рейки и мини-недели. */}
        <div className="mt-3 p-4" style={{ background: "var(--surface)", border: "var(--bw-lg) solid var(--edge)", borderRadius: "var(--r-block)" }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><p className="text-[14px] font-black">Рабочие часы</p><p className="text-[11px] font-semibold text-[var(--muted)]">{summary} · нажмите на шкалу дня, чтобы добавить окно</p></div>
            {!firstVisit && <button onClick={onHelp} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white stroke" aria-label="Как настроить расписание"><Icon name="question" width={17} weight="bold" color="var(--edge)" /></button>}
          </div>
          {/* Правила приёма живут рядом с графиком, а не в кабинете, и одним
              блоком — уходят в хвост редактора, прямо над кнопкой сохранения.
              Редактор монтируется только когда настройку раскрыли: он тянет
              записи и рабочие часы и считает раскладку недели. */}
          {open && (
            <WorkHoursEditor
              onSaved={onSaved}
              tail={
                <div className="space-y-3 pt-1" style={{ borderTop: "1px solid var(--edge-neutral)", paddingTop: 14 }}>
                  <CancelLockRow />
                </div>
              }
            />
          )}
          <button onClick={onToggle} className="mt-3 w-full py-1.5 text-[12px] font-black" style={{ color: "var(--edge)" }}>Свернуть настройку</button>
        </div>
      </Disclosure>
    </div>
  );
}

// Запрет отмены сессий — правило приёма, переехало из кабинета.
function CancelLockRow() {
  const [days, setDays] = useCancelLockDays();
  return (
    <div style={{ borderTop: "1px solid var(--edge-neutral)", paddingTop: 12 }}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-black">Запрет отмены сессий</p>
          <p className="t-cap mt-0.5">За сколько до встречи клиент уже не отменит</p>
        </div>
        {/* Вид не прыгает: меняется только цвет шрифта — выключено серым, включено акцентом */}
        <div className="keep-style flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5" style={{ background: "#fff", border: "var(--bw) solid var(--edge)" }}>
          <button onClick={() => { select(); setDays(Math.max(0, days - 1)); }} className="px-1 text-[16px] font-black leading-none" style={{ color: "var(--edge)" }} aria-label="Меньше">−</button>
          <span className="tnum w-12 text-center text-[12px] font-black" style={{ color: days ? "var(--edge)" : "var(--muted-2)" }}>{days === 0 ? "выкл" : `${days} дн.`}</span>
          <button onClick={() => { select(); setDays(Math.min(7, days + 1)); }} className="px-1 text-[16px] font-black leading-none" style={{ color: "var(--edge)" }} aria-label="Больше">+</button>
        </div>
      </div>
    </div>
  );
}

function BulkItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-[13px] font-bold transition-colors hover:bg-[var(--head-soft)] active:scale-[0.99]">{children}</button>;
}

function Segmented({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const opts: { v: View; label: string }[] = [{ v: "soon", label: "Ближайшие" }, { v: "week", label: "Неделя" }];
  return (
    <div data-tour="views" className="mb-4 flex gap-1 rounded-full p-1 stroke" style={{ background: "#fff" }}>
      {opts.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className="flex-1 rounded-full py-1.5 text-[12.5px] font-extrabold transition-colors" style={value === o.v ? { background: "var(--ink)", color: "#fff" } : { color: "var(--muted)" }}>{o.label}</button>
      ))}
    </div>
  );
}

// Быстрая запись на конкретную дату: выбор клиента + свободные окна (формат — из окна).
function EmptyState({ onAdd, selDay }: { onAdd: () => void; selDay: string | null }) {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[15px] stroke" style={{ background: "var(--head-soft)" }}>
        <Icon name="calendar" width={24} />
      </div>
      <p className="t-head">{selDay ? "На этот день записей нет" : "Пока нет предстоящих сессий"}</p>
      <p className="t-sub mx-auto mt-1 max-w-[240px]">Откройте «Календарь» и запишите клиента в свободное окно.</p>
      <div className="mt-4"><Button size="sm" onClick={onAdd} arrow>К календарю</Button></div>
    </div>
  );
}

// Выбранный день без записей: сообщение + кнопка, которая разворачивает свободные окна дня.
// Быстрая запись: сначала клиент (с поиском), затем свободное окно.
function QuickAddBooking({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  // Быстрая запись закрыта — её данные не нужны. Раньше эти два запроса
  // уходили при каждом открытии «Сессий», хотя окно никто не открывал.
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients, enabled: open });
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription, enabled: open });
  const atCap = !isPro(sub) && clients.length >= FREE_CLIENT_LIMIT;
  const [client, setClient] = useState<{ id: number; name: string } | null>(null);
  // «+ новый клиент» из шапки открывает ту же форму, что и пункт внутри списка.
  const [addingClient, setAddingClient] = useState(false);
  // Лимит бесплатного тарифа не прячет кнопку, а объясняет себя через пейволл.
  const [paywall, setPaywall] = useState(false);
  const book = useMutation({
    mutationFn: ({ iso, format }: { iso: string; format: ApptFormat }) => createAppointment({ clientId: client!.id, startsAt: iso, format }),
    onSuccess: () => { success(); setClient(null); onClose(); for (const k of ["appointments", "slots", "month-avail"]) qc.invalidateQueries({ queryKey: [k] }); },
  });
  // Быстро завести нового клиента прямо из записи и сразу выбрать его.
  const create = useMutation({
    mutationFn: ({ name, contact }: { name: string; contact: string }) => createClient(name, contact),
    onSuccess: (c) => { success(); qc.invalidateQueries({ queryKey: ["clients"] }); setClient({ id: c.id, name: c.name }); },
  });
  const sorted = [...clients].sort((a, b) => (a.status === "therapy" ? 0 : 1) - (b.status === "therapy" ? 0 : 1));

  useEffect(() => {
    if (!open) { setClient(null); setAddingClient(false); return; }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[var(--top-pad)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 bg-[rgba(32,28,24,.42)]" onClick={onClose} aria-label="Закрыть" />
          <motion.section role="dialog" aria-modal="true" initial={{ y: -18, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} className="relative flex max-h-[min(74dvh,calc(100dvh-var(--top-pad)-12px))] w-full max-w-md flex-col overflow-hidden rounded-[19px] bg-white stroke-lg" style={{ borderColor: "var(--olive-edge)" }}>
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--edge-neutral)" }}>
              <p className="text-[13px] font-black uppercase tracking-wide text-[var(--muted)]">Быстрая запись</p>
              <div className="flex items-center gap-3">
                {client && <button onClick={() => setClient(null)} className="text-[11px] font-black text-[var(--muted)]">← другой</button>}
                {!client && <button onClick={() => { tap(); if (atCap) { setPaywall(true); return; } setAddingClient(true); }} className="inline-flex items-center gap-1 text-[11px] font-black text-[var(--olive-edge)]"><Icon name="plus" width={12} weight="bold" color="var(--olive-edge)" /> новый клиент</button>}
                <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full stroke" aria-label="Закрыть">×</button>
              </div>
            </div>
            <div className="overflow-y-auto p-4">
              {!client ? (
                <ClientPicker key={addingClient ? "add" : "pick"} startAdding={addingClient} clients={sorted} compact={false} onCreateClient={(name, contact) => { if (atCap) { setPaywall(true); return; } create.mutate({ name, contact }); }} onPick={(id) => { const c = sorted.find((x) => x.id === id); if (c) setClient({ id: c.id, name: c.name }); }} />
              ) : (
                <div>
                  <div className="mb-2 flex items-center gap-2 rounded-[10px] bg-[var(--green-soft)] px-3 py-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-white stroke text-[12px] font-black">{client.name.charAt(0)}</span>
                    <span className="min-w-0 break-words text-[13px] font-black leading-tight">{client.name}</span>
                  </div>
                  <p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">Свободное окно</p>
                  <SlotPicker variant="calendar" showAvail onPick={(iso, format) => book.mutate({ iso, format })} />
                </div>
              )}
            </div>
          </motion.section>
          <ProPaywall open={paywall} onClose={() => setPaywall(false)} reason={`Заняты все ${FREE_CLIENT_LIMIT} бесплатные карточки. PRO открывает клиентов без лимита.`} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============ Клиент/гость ============ */
