"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { MonthCalendar } from "@/components/calendar";
import { PageHead } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { SlotPicker } from "@/components/slot-picker";
import { WeekStrip } from "@/components/week-strip";
import { Button, Card, Disclosure, SkeletonRow } from "@/components/ui";
import { WorkHoursEditor } from "@/components/work-hours";
import { createAppointment, deleteAppointment, listAppointments, updateAppointment, type Appointment } from "@/lib/appointments";
import { listClients, listMyBookings, type MyBooking } from "@/lib/clients";
import { tap } from "@/lib/haptics";
import { useRole } from "@/lib/role";
import { ymdLocal } from "@/lib/schedule";
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
  const wd = weekdayF.format(d);
  return `${dayShort.format(d)} · ${rel ? rel + " · " : ""}${wd}`;
}

function PsySessions() {
  const qc = useQueryClient();
  const [panel, setPanel] = useState<null | "hours" | "add">(null);
  const [showCal, setShowCal] = useState(false);
  const [selDay, setSelDay] = useState<string | null>(null);

  const { data: appts = [], isLoading } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });
  const inv = () => qc.invalidateQueries({ queryKey: ["appointments"] });

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
        <PageHead title="Сессии" sub={selDay ? dateHeader(selDay) : "Ближайшие встречи"}>
          <WeekStrip selected={selDay ?? todayY} onSelect={(y) => setSelDay(y === selDay ? null : y)} />
        </PageHead>
      </Reveal>

      <Reveal delay={0.03}>
        <div className="mb-4 flex gap-2">
          <button onClick={() => { tap(); setPanel(panel === "add" ? null : "add"); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-extrabold text-[var(--bg)] stroke" style={{ background: "var(--ink)" }}>
            <Icon name="plus" width={16} weight="regular" color="#fff" /> Записать
          </button>
          <button onClick={() => { tap(); setPanel(panel === "hours" ? null : "hours"); }} className="flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[13px] font-extrabold text-[var(--ink)] stroke">
            <Icon name="clock" width={16} /> Окна
          </button>
          <button onClick={() => { tap(); setShowCal(!showCal); setSelDay(null); }} className="flex items-center justify-center rounded-full px-3.5 py-2.5 stroke" style={{ background: showCal ? "var(--ink)" : "#fff" }}>
            <Icon name="calendar" width={17} weight={showCal ? "fill" : "regular"} color={showCal ? "#fff" : undefined} />
          </button>
        </div>
      </Reveal>

      <Disclosure open={panel === "add"}><div className="mb-4"><QuickAdd onDone={() => { setPanel(null); inv(); }} /></div></Disclosure>
      <Disclosure open={panel === "hours"}><Card className="mb-4"><WorkHoursEditor onSaved={() => setPanel(null)} /></Card></Disclosure>
      <Disclosure open={showCal}><div className="mb-4"><MonthCalendar appts={appts} selected={selDay} onSelectDay={setSelDay} tone="blend" /></div></Disclosure>

      {isLoading ? (
        <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>
      ) : dates.length === 0 ? (
        <EmptyState onAdd={() => setPanel("add")} selDay={selDay} />
      ) : (
        <div className="space-y-7">
          {dates.map((ymd) => (
            <div key={ymd}>
              <div className="mb-1 flex items-baseline gap-2 border-b pb-2" style={{ borderColor: "var(--hairline)" }}>
                <span className="text-[14px] font-extrabold capitalize">{dateHeader(ymd)}</span>
              </div>
              <div>
                {(byDate.get(ymd) ?? []).map((a) => <SessionRow key={a.id} a={a} onChange={inv} />)}
                <AddRow onOpen={() => setPanel("add")} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onAdd, selDay }: { onAdd: () => void; selDay: string | null }) {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--a-tint)" }}>
        <Icon name="calendar" width={24} color="var(--a1)" />
      </div>
      <p className="text-[14px] font-semibold">{selDay ? "На этот день записей нет" : "Пока нет предстоящих сессий"}</p>
      <p className="mx-auto mt-1 max-w-[220px] text-[13px] text-[var(--muted-2)]">Задайте рабочие окна и запишите первого клиента.</p>
      <div className="mt-4"><Button size="sm" onClick={onAdd} arrow>Записать сессию</Button></div>
    </div>
  );
}

function AddRow({ onOpen }: { onOpen: () => void }) {
  return (
    <button onClick={() => { tap(); onOpen(); }} className="flex w-full items-center gap-2 py-2.5 text-left text-[13px] font-semibold text-[var(--muted-2)] transition-colors hover:text-[var(--a1)]">
      <Icon name="plus" width={16} /> Записать
    </button>
  );
}

// Плоская строка в духе Todoist: чекбокс + имя + время, тап раскрывает редактор.
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

  return (
    <div className="border-b" style={{ borderColor: "var(--hairline)" }}>
      <div className="flex items-center gap-3 py-2.5">
        <button
          onClick={() => toggleDone.mutate()}
          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition-colors duration-200"
          style={{ border: `1.5px solid ${done ? "var(--good)" : "rgba(44,46,49,0.28)"}`, background: done ? "var(--good)" : "transparent" }}
        >
          {done && <Icon name="check" width={12} weight="fill" color="#fff" />}
        </button>
        <button onClick={() => { tap(); setOpen(!open); }} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className={`min-w-0 flex-1 truncate text-[14px] font-semibold ${done || cancelled ? "text-[var(--muted-2)] line-through" : ""}`}>{a.client.name}</span>
          <span className="shrink-0 rounded-md px-2 py-0.5 text-[12px] font-bold" style={{ background: "var(--surface-2)", color: cancelled ? "var(--muted-2)" : "var(--a1-ink)" }}>{timeF.format(d)}</span>
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2, ease: EASE }} className="shrink-0 text-[var(--muted-2)]">›</motion.span>
        </button>
      </div>

      <Disclosure open={open}>
        <div className="pb-3">
          {reschedule ? (
            <div className="rounded-2xl bg-[var(--surface-2)] p-3">
              <p className="mb-2 text-[13px] font-bold">Новое время</p>
              <SlotPicker onPick={(iso) => move.mutate(iso)} />
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

function QuickAdd({ onDone }: { onDone: () => void }) {
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [clientId, setClientId] = useState("");
  const add = useMutation({ mutationFn: (iso: string) => createAppointment({ clientId: Number(clientId), startsAt: iso, durationMin: 60 }), onSuccess: onDone });

  return (
    <Card>
      <p className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-[var(--muted)]">Клиент</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {clients.map((c) => {
          const on = String(c.id) === clientId;
          return (
            <button
              key={c.id}
              onClick={() => { tap(); setClientId(String(c.id)); }}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-transform active:scale-95 stroke"
              style={on ? { background: "var(--ink)", color: "#fff" } : { background: "#fff" }}
            >
              {c.name}
            </button>
          );
        })}
      </div>
      {clientId ? (
        <>
          <p className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-[var(--muted)]">Выберите день и окно</p>
          <SlotPicker variant="calendar" showAvail onPick={(iso) => add.mutate(iso)} />
        </>
      ) : (
        <p className="text-[12px] font-semibold text-[var(--muted-2)]">Выберите клиента — откроется календарь со свободными окнами.</p>
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
    <Card className="!p-0">
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-3 p-4 text-left">
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
          <div className="px-4 pb-4">
            {reschedule ? (
              <div className="rounded-2xl bg-[var(--surface-2)] p-3">
                <p className="mb-2 text-[13px] font-bold">Новое окно</p>
                <SlotPicker forClient onPick={(iso) => move.mutate(iso)} />
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
