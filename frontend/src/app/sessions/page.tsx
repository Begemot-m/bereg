"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { MonthCalendar } from "@/components/calendar";
import { PageHead } from "@/components/blocks";
import { DaySlots } from "@/components/day-slots";
import { HelpDeck, SCHEDULE_HELP, SESSIONS_HELP } from "@/components/help-deck";
import { Icon } from "@/components/icons";
import { SlotPicker } from "@/components/slot-picker";
import { WeekStrip } from "@/components/week-strip";
import { WeekWindows } from "@/components/week-windows";
import { WorkHoursEditor } from "@/components/work-hours";
import { Button, Card, Disclosure, SkeletonRow } from "@/components/ui";
import { listAppointments, type ApptFormat } from "@/lib/appointments";
import { listMyBookings, type MyBooking } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";
import { useRole } from "@/lib/role";
import { getMonthAvailability, getOverrides, getWorkHours, setOverride, WEEKDAYS, ymdLocal, type WorkHours } from "@/lib/schedule";
import { cancelMyBooking, rescheduleMyBooking } from "@/lib/mybookings";
import { canCancel, useCancelLockDays } from "@/lib/cancel-policy";

const EASE = [0.16, 1, 0.3, 1] as const;
const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const dayShort = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const weekdayF = new Intl.DateTimeFormat("ru-RU", { weekday: "long" });
const SCHEDULE_SETUP_KEY = "bereg:schedule-setup-seen:v1";

export default function SessionsPage() {
  const [role] = useRole();
  return role === "psychologist" ? <PsySessions /> : <PersonSessions />;
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

type View = "soon" | "week" | "cal";

function PsySessions() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>("soon");
  const [selDay, setSelDay] = useState<string | null>(null);
  const [calDay, setCalDay] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [scheduleHelp, setScheduleHelp] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
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
      <PageHead title="Сессии" sub={view === "soon" ? (selDay ? dateHeader(selDay) : "Что впереди") : view === "week" ? "Неделя целиком" : "Запись в свободные окна"}>
          <WeekStrip selected={selDay ?? todayY} marked={markedDays} onSelect={(y) => { setView("soon"); setSelDay(y === selDay ? null : y); }} />
      </PageHead>

      <div className="-mx-4 min-h-[64vh] rounded-t-[30px] px-4 pb-6 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)", borderTop: "var(--bw-lg) solid var(--edge-neutral)" }}>
        <div className="mb-3 flex justify-end">
          <button onClick={() => { tap(); setHelp(true); }} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold stroke" style={{ background: "var(--head-soft)" }}>
            <Icon name="spark" width={13} /> Как это работает?
          </button>
        </div>
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
        <Segmented value={view} onChange={(v) => { tap(); setView(v); }} />
        {help && <HelpDeck title="Как работают сессии" pages={SESSIONS_HELP} onClose={() => setHelp(false)} />}
        {scheduleHelp && <HelpDeck title="Как настроить расписание" pages={SCHEDULE_HELP} onClose={() => setScheduleHelp(false)} />}

        {view === "soon" && (
          isLoading ? (
            <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>
          ) : soonDays.length === 0 ? (
            selDay ? (
              <EmptyDayFree key={selDay} day={selDay} />
            ) : (
              <EmptyState onAdd={() => setView("cal")} selDay={null} />
            )
          ) : (
            <div className="space-y-6">
              {soonDays.map((d) => {
                const y = ymdLocal(d);
                return (
                  <div key={y}>
                    <div className="mb-2 border-b pb-2" style={{ borderColor: "var(--edge-neutral)" }}>
                      <span className="text-[14px] font-extrabold capitalize">{dateHeader(y)}</span>
                    </div>
                    <DaySlots date={d} bookedOnly />
                  </div>
                );
              })}
            </div>
          )
        )}

        {view === "week" && <WeekWindows />}

        {view === "cal" && (
          <div>
            <div className="relative mb-2 flex items-center justify-between">
              <button onClick={() => { tap(); setMultiMode(!multiMode); setMultiDays(new Set()); setCalDay(null); setBulkMenu(false); }} className="flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-extrabold stroke" style={multiMode ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff" }}>
                {multiMode ? "Отменить выбор" : "Выбрать несколько"}
              </button>
              {multiMode && (
                <>
                  <button disabled={multiDays.size === 0} onClick={() => { tap(); setBulkMenu(!bulkMenu); }} className="flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-extrabold stroke disabled:opacity-40" style={{ background: "#fff" }}><Icon name="gear" width={14} /> Действия{multiDays.size ? ` · ${multiDays.size}` : ""}</button>
                  {bulkMenu && multiDays.size > 0 && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setBulkMenu(false)} />
                      <div className="absolute right-0 top-8 z-20 w-56 overflow-hidden rounded-[14px] p-1 stroke" style={{ background: "#fff", boxShadow: "0 12px 30px -12px rgba(32,28,24,.35)" }}>
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

            <MonthCalendar appts={appts} selected={calDay} onSelectDay={setCalDay} avail={avail} tone="blend" multi={multiMode ? multiDays : undefined} onToggle={toggleDay} />

            {multiMode ? (
              <p className="mt-3 text-center text-[13px] font-semibold text-[var(--muted-2)]">{multiDays.size ? `Выбрано дней: ${multiDays.size}. Действия применятся ко всем.` : "Тапайте по дням, чтобы выбрать несколько."}</p>
            ) : calDay ? (
              <div className="mt-3">
                <p className="mb-2.5 text-[13px] font-extrabold capitalize">{dateHeader(calDay)}</p>
                <DaySlots key={calDay} date={new Date(calDay + "T00:00:00")} />
              </div>
            ) : (
              <p className="mt-3 text-center text-[13px] font-semibold text-[var(--muted-2)]">Выберите день в календаре — покажу свободные окна и записи.</p>
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
    <div className="mb-4">
      {firstVisit ? (
        <section className="overflow-hidden rounded-[22px] p-4" style={{ background: "var(--green)", border: "var(--bw-lg) solid var(--green-edge)" }}>
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-white" style={{ border: "var(--bw) solid var(--green-edge)" }}><Icon name="clock" width={23} weight="bold" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Первый шаг</p>
              <h2 className="font-tight mt-1 text-[18px] font-black leading-tight">Настройте рабочие часы</h2>
              <p className="mt-1 max-w-[420px] text-[12px] font-semibold text-[var(--muted)]">Клиенты увидят только свободные окна, а занятые сессии появятся в календаре автоматически.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-1.5">
            {["Выберите дни", "Добавьте окна", "Сохраните"].map((label, index) => (
              <div key={label} className="rounded-[13px] bg-white px-2 py-2.5 text-center" style={{ border: "var(--bw) solid var(--green-edge)" }}>
                <span className="tnum block text-[11px] font-black text-[var(--green-edge)]">0{index + 1}</span>
                <span className="mt-0.5 block text-[10px] font-extrabold leading-tight">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={onOpen} className="rounded-full bg-[var(--ink)] px-4 py-2.5 text-[13px] font-black text-white transition-transform active:scale-[0.97]">Настроить сейчас</button>
            <button onClick={onHelp} className="rounded-full bg-white px-3.5 py-2 text-[12px] font-extrabold" style={{ border: "var(--bw) solid var(--green-edge)" }}>Как настроить?</button>
            <button onClick={onLater} className="ml-auto px-2 py-2 text-[12px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Позже</button>
          </div>
        </section>
      ) : (
        <button onClick={onToggle} className="group flex w-full items-center gap-3 rounded-[18px] p-3 text-left transition-transform active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]" style={{ background: "var(--green-soft)", border: "var(--bw-lg) solid var(--green-edge)" }} aria-expanded={open}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-white" style={{ border: "var(--bw) solid var(--green-edge)" }}><Icon name="clock" width={19} weight="bold" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[13px] font-black">Рабочие часы</span><span className="block truncate text-[11px] font-semibold text-[var(--muted)]">{summary}</span></span>
          <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-white transition-transform group-active:rotate-12" style={{ border: "var(--bw) solid var(--green-edge)" }} aria-label="Настроить рабочие часы"><Icon name="gear" width={18} weight="bold" /></span>
        </button>
      )}

      <Disclosure open={open}>
        <div className="mt-3 rounded-[22px] bg-[#fbfaf6] p-4" style={{ border: "var(--bw-lg) solid var(--edge-neutral)" }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><p className="text-[14px] font-black">Ваш обычный график</p><p className="text-[11px] font-semibold text-[var(--muted)]">Нажмите на шкалу дня, чтобы добавить окно.</p></div>
            {!firstVisit && <button onClick={onHelp} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-white stroke" aria-label="Как настроить расписание"><Icon name="spark" width={16} /></button>}
          </div>
          <WorkHoursEditor onSaved={onSaved} />
          <button onClick={onToggle} className="mt-3 w-full py-1.5 text-[12px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Свернуть настройку</button>
        </div>
      </Disclosure>
    </div>
  );
}

function BulkItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-bold transition-colors hover:bg-[var(--head-soft)] active:scale-[0.99]">{children}</button>;
}

function Segmented({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const opts: { v: View; label: string }[] = [{ v: "soon", label: "Ближайшие" }, { v: "week", label: "Неделя" }, { v: "cal", label: "Календарь" }];
  return (
    <div className="mb-4 flex gap-1 rounded-full p-1 stroke" style={{ background: "#fff" }}>
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
      <p className="text-[14px] font-bold">{selDay ? "На этот день записей нет" : "Пока нет предстоящих сессий"}</p>
      <p className="mx-auto mt-1 max-w-[240px] text-[13px] text-[var(--muted-2)]">Откройте «Календарь» и запишите клиента в свободное окно.</p>
      <div className="mt-4"><Button size="sm" onClick={onAdd} arrow>К календарю</Button></div>
    </div>
  );
}

// Выбранный день без записей: сообщение + кнопка, которая разворачивает свободные окна дня.
function EmptyDayFree({ day }: { day: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="py-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl stroke" style={{ background: "var(--head-soft)" }}><Icon name="calendar" width={24} /></div>
        <p className="text-[14px] font-bold">На этот день записей нет</p>
        <p className="mx-auto mt-1 max-w-[240px] text-[13px] text-[var(--muted-2)]">Можно записать клиента в свободное окно.</p>
        <button onClick={() => { tap(); setOpen(!open); }} className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-extrabold stroke" style={{ background: "#fff" }} aria-expanded={open}>
          {open ? "Скрыть свободные окна" : "Показать свободные окна"}
          <span className="transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }}>⌄</span>
        </button>
      </div>
      <Disclosure open={open}>
        <div className="border-t pt-3" style={{ borderColor: "var(--edge-neutral)" }}>
          <div className="mb-2"><span className="text-[14px] font-extrabold capitalize">{dateHeader(day)}</span></div>
          <DaySlots date={new Date(day + "T00:00:00")} />
        </div>
      </Disclosure>
    </div>
  );
}

/* ============ Клиент/гость ============ */

function PersonSessions() {
  const qc = useQueryClient();
  const { data: bookings = [], isLoading } = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings });
  const inv = () => qc.invalidateQueries({ queryKey: ["my-bookings"] });

  return (
    <div>
      <PageHead title="Мои сессии" sub="Ваши встречи со специалистами" />
      {isLoading ? (
        <SkeletonRow />
      ) : bookings.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">Записей пока нет.</p>
          <Link href="/catalog" className="mt-3 inline-block"><Button size="sm" arrow>Найти специалиста</Button></Link>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {bookings.map((b) => <MyRow key={b.id} b={b} onChange={inv} />)}
        </div>
      )}
    </div>
  );
}

function MyRow({ b, onChange }: { b: MyBooking; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [reschedule, setReschedule] = useState(false);
  const [lockDays] = useCancelLockDays();
  const d = new Date(b.startsAt);
  const past = d < new Date();
  const locked = !past && !canCancel(b.startsAt, lockDays);

  const move = useMutation({ mutationFn: (iso: string) => rescheduleMyBooking(b.id, iso), onSuccess: () => { setReschedule(false); setOpen(false); onChange(); } });
  const cancel = useMutation({ mutationFn: () => cancelMyBooking(b.id), onSuccess: () => { setOpen(false); onChange(); } });

  return (
    <Card className="!p-0" style={past ? { opacity: 0.68 } : undefined}>
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl stroke" style={{ background: "var(--head-soft)" }}>
          <span className="text-[15px] font-extrabold leading-none">{d.getDate()}</span>
          <span className="text-[9px] font-bold uppercase">{d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "")}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[14px] font-bold ${past ? "line-through" : ""}`}>{b.psyName}</span>
          <span className={`block text-[12px] text-[var(--muted)] ${past ? "line-through" : ""}`}>{timeF.format(d)} · {b.format === "online" ? "онлайн" : "очно"}</span>
          {past && <span className="mt-0.5 block text-[10px] font-extrabold uppercase tracking-wide text-[var(--muted)]">выполнено</span>}
        </span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2, ease: EASE }} className="text-[var(--muted-2)]">›</motion.span>
      </button>
      <Disclosure open={open}>
        <div className="px-4 pb-4">
          {reschedule ? (
            <div className="rounded-2xl p-3 stroke" style={{ background: "#fff" }}>
              <p className="mb-2 text-[13px] font-bold">Новое окно</p>
              <SlotPicker forClient variant="calendar" showAvail onPick={(iso) => move.mutate(iso)} />
              <button onClick={() => setReschedule(false)} className="mt-2 text-[12px] font-semibold text-[var(--muted)]">Отмена</button>
            </div>
          ) : locked ? (
            <div className="rounded-[14px] p-3" style={{ background: "var(--salmon-soft)", border: "var(--bw) solid var(--salmon-edge)" }}>
              <p className="text-[13px] font-black" style={{ color: "var(--salmon-edge)" }}>Отменить нельзя</p>
              <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">До сессии меньше {lockDays} дн. Чтобы отменить или перенести — свяжитесь с психологом.</p>
              <div className="mt-2"><Button size="sm" variant="soft" onClick={() => setReschedule(true)}>Перенести</Button></div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="soft" onClick={() => setReschedule(true)}>Перенести</Button>
              <button onClick={() => cancel.mutate()} className="ml-auto text-[12px] font-semibold text-[var(--muted-2)] hover:text-[var(--warn)]">Отменить запись</button>
            </div>
          )}
        </div>
      </Disclosure>
    </Card>
  );
}
