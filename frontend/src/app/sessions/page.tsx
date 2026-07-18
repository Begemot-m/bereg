"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { MonthCalendar } from "@/components/calendar";
import { PageHead } from "@/components/blocks";
import { ClientSelect } from "@/components/client-select";
import { DaySlots } from "@/components/day-slots";
import { FmtSwitch } from "@/components/fmt-switch";
import { HelpDeck, SESSIONS_HELP } from "@/components/help-deck";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { SlotPicker } from "@/components/slot-picker";
import { WeekStrip } from "@/components/week-strip";
import { WeekWindows } from "@/components/week-windows";
import { Button, Card, Disclosure, SkeletonRow } from "@/components/ui";
import { createAppointment, deleteAppointment, listAppointments, updateAppointment, type Appointment, type ApptFormat } from "@/lib/appointments";
import { listMyBookings, type MyBooking } from "@/lib/clients";
import { tap } from "@/lib/haptics";
import { useRole } from "@/lib/role";
import { getMonthAvailability, getSlots, ymdLocal } from "@/lib/schedule";
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
  const inv = () => { qc.invalidateQueries({ queryKey: ["appointments"] }); qc.invalidateQueries({ queryKey: ["slots"] }); qc.invalidateQueries({ queryKey: ["month-avail"] }); };

  const todayY = ymdLocal(new Date());
  const shown = selDay ? appts.filter((a) => ymdLocal(new Date(a.startsAt)) === selDay) : appts.filter((a) => ymdLocal(new Date(a.startsAt)) >= todayY);
  const byDate = new Map<string, Appointment[]>();
  for (const a of [...shown].sort((x, y) => x.startsAt.localeCompare(y.startsAt))) {
    const k = ymdLocal(new Date(a.startsAt));
    byDate.set(k, [...(byDate.get(k) ?? []), a]);
  }
  const dates = [...byDate.keys()];

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
          ) : dates.length === 0 ? (
            <EmptyState onAdd={() => setView("cal")} selDay={selDay} />
          ) : (
            <div className="space-y-7">
              {dates.map((ymd) => (
                <div key={ymd}>
                  <div className="mb-1 flex items-baseline gap-2 border-b pb-2" style={{ borderColor: "var(--edge-neutral)" }}>
                    <span className="text-[14px] font-extrabold capitalize">{dateHeader(ymd)}</span>
                  </div>
                  {(byDate.get(ymd) ?? []).map((a) => <SessionRow key={a.id} a={a} onChange={inv} />)}
                  <AgendaAdd ymd={ymd} onDone={inv} />
                </div>
              ))}
            </div>
          )
        )}

        {view === "week" && <WeekWindows />}

        {view === "cal" && (
          <div>
            <MonthCalendar appts={appts} selected={calDay} onSelectDay={setCalDay} avail={avail} tone="blend" />
            {calDay ? (
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
function DayBooking({ ymd, onDone }: { ymd: string; onDone: () => void }) {
  const [clientId, setClientId] = useState<number | null>(null);
  const { data: slots = [] } = useQuery({ queryKey: ["slots", ymd, false], queryFn: () => getSlots(ymd) });
  const book = useMutation({ mutationFn: ({ iso, fmt }: { iso: string; fmt: ApptFormat }) => createAppointment({ clientId: clientId!, startsAt: iso, format: fmt }), onSuccess: () => { setClientId(null); onDone(); } });
  const free = slots.filter((s) => !s.taken);

  return (
    <div className="space-y-2.5">
      <ClientSelect value={clientId} onChange={setClientId} />
      {free.length === 0 ? (
        <p className="py-2 text-center text-[12px] font-semibold text-[var(--muted-2)]">Свободных окон на эту дату нет.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {free.map((s) => (
            <button key={s.start} disabled={!clientId} onClick={() => { tap(); book.mutate({ iso: s.start, fmt: s.fmt }); }} className="flex items-center justify-center gap-1 rounded-[10px] py-2 text-[12px] font-extrabold stroke disabled:opacity-40" style={{ background: clientId ? "var(--green-soft)" : "#fff", borderColor: clientId ? "var(--green-edge)" : undefined }}>
              <Icon name={s.fmt === "online" ? "video" : "pin"} width={11} />{timeF.format(new Date(s.start))}
            </button>
          ))}
        </div>
      )}
      {!clientId && <p className="text-[11px] font-semibold text-[var(--muted-2)]">Выберите клиента, затем окно.</p>}
    </div>
  );
}

function AgendaAdd({ ymd, onDone }: { ymd: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-1.5">
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-2 py-1 text-left text-[13px] font-bold text-[var(--muted-2)] transition-colors hover:text-[var(--ink)]">
        <Icon name="plus" width={16} /> Записать
      </button>
      <Disclosure open={open} zoom>
        <div className="mt-2 rounded-[14px] p-3 stroke" style={{ background: "#fff" }}>
          <DayBooking ymd={ymd} onDone={() => { setOpen(false); onDone(); }} />
        </div>
      </Disclosure>
    </div>
  );
}

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

// Плоская строка: чекбокс + имя + формат + время, тап раскрывает действия.
function SessionRow({ a, onChange }: { a: Appointment; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [reschedule, setReschedule] = useState(false);
  const d = new Date(a.startsAt);
  const done = a.status === "done";
  const cancelled = a.status === "cancelled";
  const past = d < new Date();

  const toggleDone = useMutation({ mutationFn: () => updateAppointment(a.id, { status: done ? "scheduled" : "done" }), onSuccess: onChange });
  const move = useMutation({ mutationFn: (iso: string) => updateAppointment(a.id, { startsAt: iso }), onSuccess: () => { setReschedule(false); setOpen(false); onChange(); } });
  const cancel = useMutation({ mutationFn: () => updateAppointment(a.id, { status: "cancelled" }), onSuccess: () => { setOpen(false); onChange(); } });
  const remove = useMutation({ mutationFn: () => deleteAppointment(a.id), onSuccess: () => { setOpen(false); onChange(); } });
  const setFmt = useMutation({ mutationFn: (format: ApptFormat) => updateAppointment(a.id, { format }), onSuccess: onChange });

  return (
    <div className="border-b" style={{ borderColor: "var(--edge-neutral)" }}>
      <div className="flex items-center gap-3 py-2.5">
        <button onClick={() => toggleDone.mutate()} className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition-colors duration-200" style={{ border: `1.5px solid ${done ? "var(--good)" : "rgba(44,46,49,0.28)"}`, background: done ? "var(--good)" : "transparent" }}>
          {done && <Icon name="check" width={12} weight="fill" color="#fff" />}
        </button>
        <button onClick={() => { tap(); setOpen(!open); }} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className={`min-w-0 flex-1 truncate text-[14px] font-semibold ${done || cancelled ? "text-[var(--muted-2)] line-through" : ""}`}>{a.client.name}</span>
          <FmtSwitch fmt={a.format} onToggle={() => setFmt.mutate(a.format === "online" ? "offline" : "online")} />
          <span className="shrink-0 rounded-md px-2 py-0.5 text-[12px] font-bold stroke" style={{ background: "#fff", color: cancelled ? "var(--muted-2)" : "var(--ink)" }}>{timeF.format(d)}</span>
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2, ease: EASE }} className="shrink-0 text-[var(--muted-2)]">›</motion.span>
        </button>
      </div>

      <Disclosure open={open}>
        <div className="pb-3">
          {reschedule ? (
            <div className="rounded-2xl p-3 stroke" style={{ background: "#fff" }}>
              <p className="mb-2 text-[13px] font-bold">Новое время</p>
              <SlotPicker variant="calendar" showAvail onPick={(iso) => move.mutate(iso)} />
              <button onClick={() => setReschedule(false)} className="mt-2 text-[12px] font-semibold text-[var(--muted)]">Отмена</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="soft" onClick={() => setReschedule(true)}>Перенести</Button>
              <Link href={`/clients/${a.client.id}`} className="text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]">Профиль клиента</Link>
              <span className="ml-auto flex gap-3">
                {!past && a.status === "scheduled" && <button onClick={() => cancel.mutate()} className="text-[12px] font-semibold text-[var(--muted-2)] hover:text-[var(--warn)]">Отменить</button>}
                <button onClick={() => remove.mutate()} className="text-[12px] font-semibold text-[var(--muted-2)] hover:text-[#9f2f2d]">Удалить</button>
              </span>
            </div>
          )}
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
