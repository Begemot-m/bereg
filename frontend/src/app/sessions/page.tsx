"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { MonthCalendar } from "@/components/calendar";
import { PageHead, SectionTitle } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { SlotPicker } from "@/components/slot-picker";
import { Button, Card, Disclosure, SkeletonRow } from "@/components/ui";
import { WorkHoursEditor } from "@/components/work-hours";
import { createAppointment, deleteAppointment, listAppointments, updateAppointment, type Appointment } from "@/lib/appointments";
import { listClients, listMyBookings, type MyBooking } from "@/lib/clients";
import { tap } from "@/lib/haptics";
import { useRole } from "@/lib/role";
import { ymdLocal } from "@/lib/schedule";
import { rescheduleMyBooking, cancelMyBooking } from "@/lib/mybookings";

const EASE = [0.16, 1, 0.3, 1] as const;
const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const dayF = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });

export default function SessionsPage() {
  const [role] = useRole();
  return role === "psychologist" ? <PsySessions /> : <PersonSessions />;
}

/* ============ Психолог ============ */

function groupLabel(d: Date): string {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const diff = Math.round((x.getTime() - t.getTime()) / 86400000);
  if (diff < 0) return "Прошедшие";
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  return "Позже";
}

function PsySessions() {
  const qc = useQueryClient();
  const [panel, setPanel] = useState<null | "hours" | "add">(null);
  const [showCal, setShowCal] = useState(false);
  const [selDay, setSelDay] = useState<string | null>(null);

  const { data: appts = [], isLoading } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });
  const inv = () => qc.invalidateQueries({ queryKey: ["appointments"] });

  const shown = selDay ? appts.filter((a) => ymdLocal(new Date(a.startsAt)) === selDay) : appts;
  const groups = new Map<string, Appointment[]>();
  for (const a of shown) { const g = selDay ? "День" : groupLabel(new Date(a.startsAt)); groups.set(g, [...(groups.get(g) ?? []), a]); }
  const order = selDay ? ["День"] : ["Сегодня", "Завтра", "Позже", "Прошедшие"];

  return (
    <div>
      <Reveal><PageHead title="Сессии" /></Reveal>

      {/* Действия */}
      <Reveal delay={0.03}>
        <div className="mb-3 flex gap-2">
          <button onClick={() => { tap(); setPanel(panel === "add" ? null : "add"); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-bold text-white" style={{ background: "var(--a1)" }}>
            <Icon name="plus" width={16} weight="bold" /> Записать
          </button>
          <button onClick={() => { tap(); setPanel(panel === "hours" ? null : "hours"); }} className="flex items-center justify-center gap-1.5 rounded-full bg-[var(--surface-2)] px-4 py-2.5 text-[13px] font-bold text-[var(--ink)]">
            <Icon name="clock" width={16} /> Окна
          </button>
          <button onClick={() => { tap(); setShowCal(!showCal); setSelDay(null); }} className="flex items-center justify-center rounded-full bg-[var(--surface-2)] px-3.5 py-2.5 text-[var(--ink)]">
            <Icon name="calendar" width={17} weight={showCal ? "fill" : "regular"} />
          </button>
        </div>
      </Reveal>

      <Disclosure open={panel === "add"}>
        <div className="mb-4"><QuickAdd onDone={() => { setPanel(null); inv(); }} /></div>
      </Disclosure>
      <Disclosure open={panel === "hours"}>
        <Card className="mb-4"><WorkHoursEditor onSaved={() => setPanel(null)} /></Card>
      </Disclosure>
      <Disclosure open={showCal}>
        <div className="mb-4"><MonthCalendar appts={appts} selected={selDay} onSelectDay={setSelDay} /></div>
      </Disclosure>

      {isLoading ? (
        <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>
      ) : shown.length === 0 ? (
        <p className="px-1 text-sm text-[var(--muted-2)]">{selDay ? "На этот день записей нет." : "Записей пока нет."}</p>
      ) : (
        <div className="space-y-6">
          {order.filter((g) => groups.has(g)).map((g) => (
            <div key={g}>
              <SectionTitle>{g === "День" && selDay ? dayF.format(new Date(selDay + "T00:00:00")) : g}</SectionTitle>
              <div className="space-y-2">
                {(groups.get(g) ?? []).map((a) => <SessionRow key={a.id} a={a} onChange={inv} past={groupLabel(new Date(a.startsAt)) === "Прошедшие"} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({ a, onChange, past }: { a: Appointment; onChange: () => void; past?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reschedule, setReschedule] = useState(false);
  const d = new Date(a.startsAt);
  const done = a.status === "done";
  const cancelled = a.status === "cancelled";

  const toggleDone = useMutation({ mutationFn: () => updateAppointment(a.id, { status: done ? "scheduled" : "done" }), onSuccess: onChange });
  const move = useMutation({ mutationFn: (iso: string) => updateAppointment(a.id, { startsAt: iso }), onSuccess: () => { setReschedule(false); setOpen(false); onChange(); } });
  const cancel = useMutation({ mutationFn: () => updateAppointment(a.id, { status: "cancelled" }), onSuccess: () => { setOpen(false); onChange(); } });
  const remove = useMutation({ mutationFn: () => deleteAppointment(a.id), onSuccess: () => { setOpen(false); onChange(); } });

  return (
    <div style={{ borderRadius: "var(--r-block)", background: "var(--surface)", boxShadow: open ? "var(--shadow-lift)" : "var(--shadow)" }} className="transition-shadow duration-200">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => toggleDone.mutate()}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors duration-200"
          style={{ border: `1.5px solid ${done ? "var(--good)" : "rgba(44,46,49,0.28)"}`, background: done ? "var(--good)" : "transparent" }}
        >
          {done && <Icon name="check" width={13} weight="fill" color="#fff" />}
        </button>
        <button onClick={() => { tap(); setOpen(!open); }} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[14px] font-bold ${done || cancelled ? "text-[var(--muted-2)] line-through" : ""}`}>{a.client.name}</span>
            <span className="block text-[12px] capitalize text-[var(--muted)]">{dayF.format(d)} · {timeF.format(d)}{cancelled && " · отменена"}</span>
          </span>
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2, ease: EASE }} className="text-[var(--muted-2)]">›</motion.span>
        </button>
      </div>

      <Disclosure open={open}>
        <div className="space-y-3 px-4 pb-4" style={{ borderTop: "1px solid var(--hairline)" }}>
          {reschedule ? (
            <div className="pt-3">
              <p className="mb-2 text-[13px] font-bold">Новое время</p>
              <SlotPicker onPick={(iso) => move.mutate(iso)} />
              <button onClick={() => setReschedule(false)} className="mt-2 text-[12px] font-semibold text-[var(--muted)]">Отмена</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-3">
              <Button size="sm" variant="soft" onClick={() => setReschedule(true)}>Перенести</Button>
              <Link href={`/clients/${a.client.id}`} className="text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]">Профиль клиента</Link>
              <span className="ml-auto flex gap-2">
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

function QuickAdd({ onDone }: { onDone: () => void }) {
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [clientId, setClientId] = useState("");
  const add = useMutation({ mutationFn: (iso: string) => createAppointment({ clientId: Number(clientId), startsAt: iso, durationMin: 60 }), onSuccess: onDone });

  return (
    <Card>
      <p className="mb-2 text-[13px] font-bold">Клиент</p>
      <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="mb-4 w-full rounded-xl bg-[var(--surface-2)] px-3.5 py-2.5 text-sm outline-none" style={{ border: "1.5px solid transparent" }}>
        <option value="">Выберите клиента</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {clientId ? (
        <>
          <p className="mb-2 text-[13px] font-bold">Свободное окно</p>
          <SlotPicker onPick={(iso) => add.mutate(iso)} />
        </>
      ) : (
        <p className="text-[12px] text-[var(--muted-2)]">Выберите клиента, затем свободное окно из вашего графика.</p>
      )}
    </Card>
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
    <div style={{ borderRadius: "var(--r-block)", background: "var(--surface)", boxShadow: open ? "var(--shadow-lift)" : "var(--shadow)" }} className="transition-shadow duration-200">
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl" style={{ background: "var(--a-tint)" }}>
          <span className="text-[15px] font-extrabold leading-none" style={{ color: "var(--a1-ink)" }}>{d.getDate()}</span>
          <span className="text-[9px] font-bold uppercase" style={{ color: "var(--a1-ink)" }}>{d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "")}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold">{b.psyName}</span>
          <span className="block text-[12px] text-[var(--muted)]">{timeF.format(d)} · {b.durationMin} мин {past && "· прошла"}</span>
        </span>
        {!past && <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2, ease: EASE }} className="text-[var(--muted-2)]">›</motion.span>}
      </button>

      {!past && (
        <Disclosure open={open}>
          <div className="space-y-3 px-4 pb-4" style={{ borderTop: "1px solid var(--hairline)" }}>
            {reschedule ? (
              <div className="pt-3">
                <p className="mb-2 text-[13px] font-bold">Выберите новое окно</p>
                <SlotPicker forClient onPick={(iso) => move.mutate(iso)} />
                <button onClick={() => setReschedule(false)} className="mt-2 text-[12px] font-semibold text-[var(--muted)]">Отмена</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-3">
                <Button size="sm" variant="soft" onClick={() => setReschedule(true)}>Перенести</Button>
                <button onClick={() => cancel.mutate()} className="ml-auto text-[12px] font-semibold text-[var(--muted-2)] hover:text-[var(--warn)]">Отменить запись</button>
              </div>
            )}
          </div>
        </Disclosure>
      )}
    </div>
  );
}
