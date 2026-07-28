"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { MonthCalendar } from "@/components/calendar";
import { PageHead } from "@/components/blocks";
import { ClientPicker, DaySlots } from "@/components/day-slots";
import { HelpDeck, SCHEDULE_HELP, SESSIONS_HELP } from "@/components/help-deck";
import { Icon } from "@/components/icons";
import { SlotPicker } from "@/components/slot-picker";
import { WeekStrip } from "@/components/week-strip";
import { DayAgenda, WeekWindows } from "@/components/week-windows";
import { RemindersModule } from "@/components/reminders";
import { WorkHoursEditor } from "@/components/work-hours";
import { useCancelLockDays } from "@/lib/cancel-policy";
import { Button, Card, Disclosure, SkeletonRow } from "@/components/ui";
import { createAppointment, listAppointments, type ApptFormat } from "@/lib/appointments";
import { select, success, tap } from "@/lib/haptics";
import { createClient, listClients } from "@/lib/clients";
import { useRole } from "@/lib/role";
import { getMonthAvailability, getOverrides, getWorkHours, setOverride, WEEKDAYS, ymdLocal, type WorkHours } from "@/lib/schedule";

const EASE = [0.16, 1, 0.3, 1] as const;
const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const dayShort = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const weekdayF = new Intl.DateTimeFormat("ru-RU", { weekday: "long" });
const SCHEDULE_SETUP_KEY = "bereg:schedule-setup-seen:v1";

export default function SessionsPage() {
  const [role] = useRole();
  const router = useRouter();
  // Раздел «Мои сессии» у клиента убран — запись живёт в Терапии.
  useEffect(() => { if (role !== "psychologist") router.replace("/therapy"); }, [role, router]);
  if (role !== "psychologist") return null;
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
  if (rel === "Завтра") return { label: rel, tone: "olive" };
  if (rel === "Вчера") return { label: rel, tone: "coral" };
  return null;
}

type View = "soon" | "week";

function PsySessions() {
  const qc = useQueryClient();
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

  const { data: appts = [], isLoading } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });
  const { data: avail } = useQuery({ queryKey: ["month-avail", false], queryFn: () => getMonthAvailability(false) });
  const { data: work } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const { data: overrides = {} } = useQuery({ queryKey: ["overrides"], queryFn: getOverrides });
  const inv = () => { for (const k of ["appointments", "slots", "month-avail", "overrides"]) qc.invalidateQueries({ queryKey: [k] }); };

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

  return (
    <div>
      <PageHead
        title="Сессии"
        icon="calendar"
        sub={calOpen ? (selDay ? dateHeader(selDay) : "Выберите день") : view === "soon" ? (selDay ? dateHeader(selDay) : "Что впереди") : "Неделя целиком"}
        right={
          <button onClick={() => { tap(); setHelp(true); }} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-[11.5px] font-black" style={{ color: "var(--edge)" }}>
            <Icon name="question" width={14} weight="bold" color="var(--edge)" /> Как это работает?
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
            <div className="relative mt-2 flex items-center justify-center gap-2">
              <button
                onClick={() => { tap(); setMultiMode(!multiMode); setMultiDays(new Set()); setBulkMenu(false); }}
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11.5px] font-black stroke"
                style={multiMode ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff", color: "var(--olive-edge)" }}
              >
                <Icon name="check" width={13} weight="bold" color={multiMode ? "#fff" : "var(--olive-edge)"} />
                {multiMode ? "Готово" : "Выбор"}
              </button>
              {multiMode && (
                <>
                  <button disabled={multiDays.size === 0} onClick={() => { tap(); setBulkMenu(!bulkMenu); }} className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11.5px] font-black stroke disabled:opacity-40" style={{ background: "var(--olive-soft)", color: "var(--olive-edge)", borderColor: "var(--olive-edge)" }}>
                    <Icon name="gear" width={13} weight="bold" color="var(--olive-edge)" /> Действия{multiDays.size ? ` · ${multiDays.size}` : ""}
                  </button>
                  {bulkMenu && multiDays.size > 0 && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setBulkMenu(false)} />
                      <div className="absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-[14px] p-1 stroke" style={{ background: "#fff", boxShadow: "0 12px 30px -12px rgba(32,28,24,.35)" }}>
                        <BulkItem onClick={() => bulkAct("off")}>🌙 Сделать выходными</BulkItem>
                        <BulkItem onClick={() => bulkAct("open")}>↺ Открыть все окна</BulkItem>
                        <BulkItem onClick={() => bulkAct("online")}>📹 Все окна — онлайн</BulkItem>
                        <BulkItem onClick={() => bulkAct("offline")}>📍 Все окна — очно</BulkItem>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </Disclosure>
      </PageHead>

      <div className="sheet">
        <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {/* Слева — настройка графика */}
          <button data-tour="schedule" onClick={() => { tap(); setScheduleOpen((v) => !v); setQuickAdd(false); }} className="flex w-fit items-center gap-1.5 rounded-full bg-[var(--olive-soft)] px-3 py-1.5 text-[11px] font-black text-[var(--muted)] transition-colors hover:text-[var(--ink)]" aria-expanded={scheduleOpen}>
            <Icon name="gear" width={13} color="currentColor" /> График
          </button>

          {/* Центр — весёлый зелёный крестик быстрой записи */}
          <motion.button
            onClick={() => { tap(); setQuickAdd((v) => !v); setScheduleOpen(false); }}
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.06 }}
            animate={quickAdd ? { rotate: 45 } : { rotate: 0, y: [0, -3, 0] }}
            transition={quickAdd ? { type: "spring", stiffness: 400, damping: 14 } : { rotate: { type: "spring", stiffness: 400, damping: 14 }, y: { duration: 2.2, repeat: Infinity, ease: "easeInOut" } }}
            className="flex h-11 w-11 items-center justify-center rounded-[16px]"
            style={{ background: quickAdd ? "var(--olive)" : "var(--olive-soft)", border: "var(--bw-lg) solid var(--olive-edge)", boxShadow: quickAdd ? "0 6px 16px -6px var(--olive-edge)" : "0 8px 18px -8px var(--olive-edge)" }}
            data-tour="quick-add"
            aria-label="Быстрая запись"
            aria-expanded={quickAdd}
          >
            <Icon name="plus" width={22} weight="bold" color="var(--olive-edge)" />
          </motion.button>

          {/* Справа — помощь */}
          <button
            onClick={() => { tap(); setCalOpen((v) => !v); closeMultiMode(); }}
            aria-expanded={calOpen}
            className="flex w-fit items-center gap-1.5 justify-self-end rounded-full px-3.5 py-2 text-[11.5px] font-black transition-colors"
            style={calOpen ? { background: "var(--ink)", color: "#fff" } : { background: "var(--olive-edge)", color: "#fff" }}
          >
            <Icon name="calendar" width={14} weight="bold" color="#fff" />
            {calOpen ? "Свернуть" : "Календарь"}
          </button>
        </div>

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
                    <div className="mb-2 flex items-center gap-2 border-b pb-2" style={{ borderColor: "var(--edge-neutral)" }}>
                      {(() => { const r = relTone(y); return r && <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase" style={{ background: `var(--${r.tone}-soft)`, color: `var(--${r.tone}-edge)` }}>{r.label}</span>; })()}
                      <span className="text-[14px] font-extrabold capitalize">{dayShort.format(new Date(y + "T00:00:00"))} · {weekdayF.format(new Date(y + "T00:00:00"))}</span>
                    </div>
                    <DaySlots date={d} bookedOnly />
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
              <span className="flex h-12 w-12 items-center justify-center rounded-[15px] bg-white"><Icon name="clock" width={23} weight="bold" /></span>
              <p className="mt-3 text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Первый шаг</p>
              <h2 className="font-tight mt-1 text-[20px] font-black leading-tight">Настройте рабочие часы</h2>
              <p className="mt-1 text-[12px] font-semibold text-[var(--muted)]">Клиенты увидят только свободные окна, а занятые сессии появятся в календаре автоматически.</p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-1.5">
                {["Выберите дни", "Добавьте окна", "Сохраните"].map((label, index) => (
                  <div key={label} className="rounded-[13px] px-2 py-2.5 text-center" style={{ background: "var(--olive-soft)" }}>
                    <span className="tnum block text-[11px] font-black text-[var(--olive-edge)]">0{index + 1}</span>
                    <span className="mt-0.5 block text-[10px] font-extrabold leading-tight">{label}</span>
                  </div>
                ))}
              </div>
              <button onClick={onOpen} className="mt-4 w-full rounded-[15px] bg-[var(--ink)] py-3 text-[14px] font-black text-white transition-transform active:scale-[0.98]">Настроить сейчас</button>
              <div className="mt-2 flex items-center justify-between">
                <button onClick={onHelp} className="px-1 py-1.5 text-[12px] font-extrabold text-[var(--muted)] hover:text-[var(--ink)]">Как настроить?</button>
                <button onClick={onLater} className="px-1 py-1.5 text-[12px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Позже</button>
              </div>
            </div>
          </section>
        </div>
      )}

      <Disclosure open={open} autoScroll={false}>
        <div className="mt-3 rounded-[22px] bg-[#fbfaf6] p-4" style={{ border: "var(--bw-lg) solid var(--edge-neutral)" }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><p className="text-[14px] font-black">Рабочие часы</p><p className="text-[11px] font-semibold text-[var(--muted)]">{summary} · нажмите на шкалу дня, чтобы добавить окно</p></div>
            {!firstVisit && <button onClick={onHelp} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-white stroke" aria-label="Как настроить расписание"><Icon name="question" width={17} weight="bold" color="var(--edge)" /></button>}
          </div>
          <WorkHoursEditor onSaved={onSaved} />
          {/* Правила приёма живут рядом с графиком, а не в кабинете. */}
          <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "var(--edge-neutral)" }}>
            <RemindersModule />
            <CancelLockRow />
          </div>
          <button onClick={onToggle} className="mt-3 w-full py-1.5 text-[12px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Свернуть настройку</button>
        </div>
      </Disclosure>
    </div>
  );
}

// Запрет отмены сессий — правило приёма, переехало из кабинета.
function CancelLockRow() {
  const [days, setDays] = useCancelLockDays();
  return (
    <div className="rounded-[16px] bg-[var(--surface-2)] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white"><Icon name="clock" width={17} weight="bold" color="var(--edge)" /></span>
          <span className="text-[13px] font-black">Запрет отмены сессий</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => { select(); setDays(Math.max(0, days - 1)); }} className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-[18px] font-black" aria-label="Меньше">−</button>
          <span className="flex h-8 min-w-[64px] items-center justify-center rounded-[10px] px-2 text-[12px] font-black" style={{ background: days ? "var(--head-soft)" : "#fff", color: days ? "var(--edge)" : "var(--muted-2)" }}>{days === 0 ? "выкл" : `${days} дн.`}</span>
          <button onClick={() => { select(); setDays(Math.min(7, days + 1)); }} className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-[18px] font-black" aria-label="Больше">+</button>
        </div>
      </div>
      <p className="mt-2 text-[11px] font-medium text-[var(--muted-2)]">{days === 0 ? "Клиент может отменить сессию в любое время." : `Клиент не сможет отменить менее чем за ${days} дн. до сессии — только через вас.`}</p>
    </div>
  );
}

function BulkItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-bold transition-colors hover:bg-[var(--head-soft)] active:scale-[0.99]">{children}</button>;
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
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl stroke" style={{ background: "var(--head-soft)" }}>
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
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [client, setClient] = useState<{ id: number; name: string } | null>(null);
  const book = useMutation({
    mutationFn: ({ iso, format }: { iso: string; format: ApptFormat }) => createAppointment({ clientId: client!.id, startsAt: iso, format }),
    onSuccess: () => { success(); setClient(null); onClose(); for (const k of ["appointments", "slots", "month-avail"]) qc.invalidateQueries({ queryKey: [k] }); },
  });
  // Быстро завести нового клиента прямо из записи и сразу выбрать его.
  const create = useMutation({
    mutationFn: (name: string) => createClient(name, ""),
    onSuccess: (c) => { success(); qc.invalidateQueries({ queryKey: ["clients"] }); setClient({ id: c.id, name: c.name }); },
  });
  const sorted = [...clients].sort((a, b) => (a.status === "therapy" ? 0 : 1) - (b.status === "therapy" ? 0 : 1));

  useEffect(() => {
    if (!open) { setClient(null); return; }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[calc(env(safe-area-inset-top)+52px)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 bg-[rgba(32,28,24,.42)]" onClick={onClose} aria-label="Закрыть" />
          <motion.section role="dialog" aria-modal="true" initial={{ y: -18, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} className="relative flex max-h-[74dvh] w-full max-w-md flex-col overflow-hidden rounded-[22px] bg-white stroke-lg" style={{ borderColor: "var(--olive-edge)" }}>
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--edge-neutral)" }}>
              <p className="text-[13px] font-black uppercase tracking-wide text-[var(--muted)]">Быстрая запись</p>
              <div className="flex items-center gap-3">
                {client && <button onClick={() => setClient(null)} className="text-[11px] font-black text-[var(--muted)]">← другой</button>}
                <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full stroke" aria-label="Закрыть">×</button>
              </div>
            </div>
            <div className="overflow-y-auto p-4">
              {!client ? (
                <ClientPicker clients={sorted} compact={false} onCreateClient={(name) => create.mutate(name)} onPick={(id) => { const c = sorted.find((x) => x.id === id); if (c) setClient({ id: c.id, name: c.name }); }} />
              ) : (
                <div>
                  <div className="mb-2 flex items-center gap-2 rounded-[12px] bg-[var(--green-soft)] px-3 py-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-white stroke text-[12px] font-black">{client.name.charAt(0)}</span>
                    <span className="text-[13px] font-black">{client.name}</span>
                  </div>
                  <p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">Свободное окно</p>
                  <SlotPicker variant="calendar" showAvail onPick={(iso, format) => book.mutate({ iso, format })} />
                </div>
              )}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============ Клиент/гость ============ */
