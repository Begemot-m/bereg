"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { MonthCalendar } from "@/components/calendar";
import { PageHead } from "@/components/blocks";
import { DaySlots } from "@/components/day-slots";
import { HelpDeck, SESSIONS_HELP } from "@/components/help-deck";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { SlotPicker } from "@/components/slot-picker";
import { WeekStrip } from "@/components/week-strip";
import { WeekWindows } from "@/components/week-windows";
import { Button, Card, Disclosure, SkeletonRow } from "@/components/ui";
import { listAppointments, type ApptFormat } from "@/lib/appointments";
import { listMyBookings, type MyBooking } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";
import { useRole } from "@/lib/role";
import { getMonthAvailability, getOverrides, getWorkHours, setOverride, ymdLocal } from "@/lib/schedule";
import { cancelMyBooking, rescheduleMyBooking } from "@/lib/mybookings";

const EASE = [0.16, 1, 0.3, 1] as const;
const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const dayShort = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const weekdayF = new Intl.DateTimeFormat("ru-RU", { weekday: "long" });

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

  const { data: appts = [], isLoading } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });
  const { data: avail } = useQuery({ queryKey: ["month-avail", false], queryFn: () => getMonthAvailability(false) });
  const { data: work } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const { data: overrides = {} } = useQuery({ queryKey: ["overrides"], queryFn: getOverrides });
  const inv = () => { for (const k of ["appointments", "slots", "month-avail", "overrides"]) qc.invalidateQueries({ queryKey: [k] }); };

  const [multiMode, setMultiMode] = useState(false);
  const [multiDays, setMultiDays] = useState<Set<string>>(new Set());
  const [bulkMenu, setBulkMenu] = useState(false);
  const bulk = useMutation({ mutationFn: async (ops: { iso: string; patch: { removed?: boolean; fmt?: ApptFormat } }[]) => { for (const o of ops) await setOverride(o.iso, o.patch); }, onSuccess: () => { success(); setBulkMenu(false); inv(); } });
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
    setMultiDays(new Set());
    if (ops.length) bulk.mutate(ops); else setBulkMenu(false);
  };

  const todayY = ymdLocal(new Date());
  // Ближайшие дни (сегодня, завтра …) с окнами или записями
  const soonDays = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }).filter((d) => {
    const y = ymdLocal(d);
    if (selDay) return y === selDay;
    const wd = (d.getDay() + 6) % 7;
    const hasWin = (work?.hours?.[wd] ?? []).length > 0;
    const hasAppt = appts.some((a) => a.status !== "cancelled" && ymdLocal(new Date(a.startsAt)) === y);
    return hasWin || hasAppt;
  });

  return (
    <div>
      <Reveal>
        <PageHead title="Сессии" sub={view === "soon" ? (selDay ? dateHeader(selDay) : "Что впереди") : view === "week" ? "Неделя целиком" : "Запись в свободные окна"}>
          <WeekStrip selected={selDay ?? todayY} onSelect={(y) => { setView("soon"); setSelDay(y === selDay ? null : y); }} />
        </PageHead>
      </Reveal>

      <div className="-mx-4 min-h-[64vh] rounded-t-[30px] px-4 pb-6 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)", borderTop: "var(--bw) solid var(--edge-neutral)" }}>
        <div className="mb-3 flex justify-end">
          <button onClick={() => { tap(); setHelp(true); }} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold stroke" style={{ background: "var(--head-soft)" }}>
            <Icon name="spark" width={13} /> Как это работает?
          </button>
        </div>
        <Segmented value={view} onChange={(v) => { tap(); setView(v); }} />
        {help && <HelpDeck title="Как работают сессии" pages={SESSIONS_HELP} onClose={() => setHelp(false)} />}

        {view === "soon" && (
          isLoading ? (
            <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>
          ) : soonDays.length === 0 ? (
            <EmptyState onAdd={() => setView("cal")} selDay={selDay} />
          ) : (
            <div className="space-y-6">
              {soonDays.map((d) => {
                const y = ymdLocal(d);
                return (
                  <div key={y}>
                    <div className="mb-2 border-b pb-2" style={{ borderColor: "var(--edge-neutral)" }}>
                      <span className="text-[14px] font-extrabold capitalize">{dateHeader(y)}</span>
                    </div>
                    <DaySlots date={d} />
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
                {multiMode ? "✓ Выбор дней" : "Выбрать несколько"}
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
                <DaySlots date={new Date(calDay + "T00:00:00")} />
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

/* ============ Клиент/гость ============ */

function PersonSessions() {
  const qc = useQueryClient();
  const { data: bookings = [], isLoading } = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings });
  const inv = () => qc.invalidateQueries({ queryKey: ["my-bookings"] });

  return (
    <div>
      <Reveal><PageHead title="Мои сессии" sub="Ваши встречи со специалистами" /></Reveal>
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
  const d = new Date(b.startsAt);
  const past = d < new Date();

  const move = useMutation({ mutationFn: (iso: string) => rescheduleMyBooking(b.id, iso), onSuccess: () => { setReschedule(false); setOpen(false); onChange(); } });
  const cancel = useMutation({ mutationFn: () => cancelMyBooking(b.id), onSuccess: () => { setOpen(false); onChange(); } });

  return (
    <Card className="!p-0">
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl stroke" style={{ background: "var(--head-soft)" }}>
          <span className="text-[15px] font-extrabold leading-none">{d.getDate()}</span>
          <span className="text-[9px] font-bold uppercase">{d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "")}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold">{b.psyName}</span>
          <span className="block text-[12px] text-[var(--muted)]">{timeF.format(d)} · {b.format === "online" ? "онлайн" : "очно"} {past && "· прошла"}</span>
        </span>
        {!past && <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2, ease: EASE }} className="text-[var(--muted-2)]">›</motion.span>}
      </button>
      {!past && (
        <Disclosure open={open}>
          <div className="px-4 pb-4">
            {reschedule ? (
              <div className="rounded-2xl p-3 stroke" style={{ background: "#fff" }}>
                <p className="mb-2 text-[13px] font-bold">Новое окно</p>
                <SlotPicker forClient variant="calendar" showAvail onPick={(iso) => move.mutate(iso)} />
                <button onClick={() => setReschedule(false)} className="mt-2 text-[12px] font-semibold text-[var(--muted)]">Отмена</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="soft" onClick={() => setReschedule(true)}>Перенести</Button>
                <button onClick={() => cancel.mutate()} className="ml-auto text-[12px] font-semibold text-[var(--muted-2)] hover:text-[var(--warn)]">Отменить запись</button>
              </div>
            )}
          </div>
        </Disclosure>
      )}
    </Card>
  );
}
