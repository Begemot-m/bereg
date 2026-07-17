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
import { WeekWindows } from "@/components/week-windows";
import { Button, Card, Disclosure, Input, SkeletonRow } from "@/components/ui";
import { createAppointment, deleteAppointment, listAppointments, updateAppointment, type Appointment, type ApptFormat } from "@/lib/appointments";
import { listClients, listMyBookings, type MyBooking } from "@/lib/clients";
import { select, tap } from "@/lib/haptics";
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

  const { data: avail } = useQuery({ queryKey: ["month-avail", false], queryFn: () => getMonthAvailability(false) });

  return (
    <div>
      <Reveal>
        <PageHead title="Сессии" sub={selDay ? dateHeader(selDay) : "Ближайшие встречи"}>
          <WeekStrip selected={selDay ?? todayY} onSelect={(y) => setSelDay(y === selDay ? null : y)} />
        </PageHead>
      </Reveal>

      {/* Светлый скруглённый блок поверх цветного фона */}
      <div className="-mx-4 min-h-[64vh] rounded-t-[30px] px-4 pb-6 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)", borderTop: "var(--bw) solid var(--edge-neutral)" }}>
        <div className="mb-4 flex gap-2">
          <button onClick={() => { tap(); setShowCal(false); setPanel(panel === "add" ? null : "add"); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-extrabold text-[var(--bg)]" style={{ background: "var(--ink)", border: "var(--bw) solid var(--ink)" }}>
            <Icon name="plus" width={16} weight="regular" color="#fff" /> Записать
          </button>
          <button onClick={() => { tap(); setPanel(panel === "hours" ? null : "hours"); }} className="flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-extrabold stroke" style={panel === "hours" ? { background: "var(--head)", color: "var(--ink)", borderColor: "var(--edge)" } : { background: "#fff", color: "var(--ink)" }}>
            <Icon name="clock" width={16} /> Окна
          </button>
          <button onClick={() => { tap(); setShowCal(!showCal); setPanel(null); setSelDay(null); }} className="flex items-center justify-center rounded-full px-3.5 py-2.5 stroke" style={showCal ? { background: "var(--head)", borderColor: "var(--edge)" } : { background: "#fff" }}>
            <Icon name="calendar" width={17} weight="regular" />
          </button>
        </div>

        <Panel open={panel === "add"} title="Новая запись" onClose={() => setPanel(null)}><QuickAdd onDone={() => { setPanel(null); inv(); }} /></Panel>
        <Panel open={panel === "hours"} title="График окон" onClose={() => setPanel(null)}><WeekWindows /></Panel>
        <Panel open={showCal} title="Календарь занятости" onClose={() => setShowCal(false)}>
          <MonthCalendar appts={appts} selected={selDay} onSelectDay={setSelDay} avail={avail} tone="blend" />
        </Panel>

        {isLoading ? (
          <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>
        ) : dates.length === 0 ? (
          <EmptyState onAdd={() => setPanel("add")} selDay={selDay} />
        ) : (
          <div className="space-y-7">
            {dates.map((ymd) => (
              <div key={ymd}>
                <div className="mb-1 flex items-baseline gap-2 border-b pb-2" style={{ borderColor: "var(--edge-neutral)" }}>
                  <span className="text-[14px] font-extrabold capitalize">{dateHeader(ymd)}</span>
                </div>
                <div>
                  {(byDate.get(ymd) ?? []).map((a) => <SessionRow key={a.id} a={a} onChange={inv} />)}
                  <QuickBookRow ymd={ymd} onDone={inv} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Панель со стрелкой-сворачиванием (понятно, что можно закрыть).
function Panel({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Disclosure open={open} zoom>
      <Card className="mb-4">
        <button onClick={() => { tap(); onClose(); }} className="mb-3 flex w-full items-center justify-between">
          <span className="text-[13px] font-extrabold uppercase tracking-wide text-[var(--muted)]">{title}</span>
          <span className="flex items-center gap-1 text-[12px] font-bold text-[var(--muted-2)]">Свернуть <span className="text-[14px]">▲</span></span>
        </button>
        {children}
      </Card>
    </Disclosure>
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

// Быстрая запись: доступные окна этой даты по графику + выбор клиента (терапия в приоритете).
function QuickBookRow({ ymd, onDone }: { ymd: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<number | null>(null);
  const [fmt, setFmt] = useState<ApptFormat>("online");
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: slots = [] } = useQuery({ queryKey: ["slots", ymd, false], queryFn: () => getSlots(ymd), enabled: open });
  const book = useMutation({ mutationFn: (iso: string) => createAppointment({ clientId: clientId!, startsAt: iso, format: fmt }), onSuccess: () => { setOpen(false); setClientId(null); onDone(); } });

  const free = slots.filter((s) => !s.taken);
  const sorted = [...clients].sort((a, b) => (a.status === "therapy" ? 0 : 1) - (b.status === "therapy" ? 0 : 1));

  return (
    <div className="py-1.5">
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-2 py-1 text-left text-[13px] font-bold text-[var(--muted-2)] transition-colors hover:text-[var(--ink)]">
        <Icon name="plus" width={16} /> Записать
      </button>
      <Disclosure open={open} zoom>
        <div className="mt-2 rounded-[14px] p-3 stroke" style={{ background: "#fff" }}>
          {/* Клиент */}
          <div className="no-scrollbar mb-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
            {sorted.map((c) => {
              const on = clientId === c.id;
              return (
                <button key={c.id} onClick={() => { select(); setClientId(c.id); }} className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold stroke" style={on ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: c.status === "therapy" ? "var(--green-soft)" : "#fff" }}>
                  {c.name}{c.status === "therapy" && !on && <span className="text-[9px] font-extrabold uppercase" style={{ color: "var(--green-edge)" }}>•</span>}
                </button>
              );
            })}
          </div>
          {/* Формат */}
          <div className="mb-2.5 flex gap-1.5">
            {(["online", "offline"] as ApptFormat[]).map((f) => (
              <button key={f} onClick={() => { select(); setFmt(f); }} className="flex-1 rounded-full py-1 text-[12px] font-extrabold stroke" style={fmt === f ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff", color: "var(--muted)" }}>{f === "online" ? "Онлайн" : "Очно"}</button>
            ))}
          </div>
          {/* Окна */}
          {free.length === 0 ? (
            <p className="py-2 text-center text-[12px] font-semibold text-[var(--muted-2)]">Свободных окон на эту дату нет.</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {free.map((s) => (
                <button key={s.start} disabled={!clientId} onClick={() => { tap(); book.mutate(s.start); }} className="rounded-[10px] py-2 text-[12px] font-extrabold stroke disabled:opacity-40" style={{ background: clientId ? "var(--green-soft)" : "#fff", borderColor: clientId ? "var(--green-edge)" : undefined }}>
                  {new Date(s.start).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </button>
              ))}
            </div>
          )}
          {!clientId && <p className="mt-2 text-[11px] font-semibold text-[var(--muted-2)]">Выберите клиента, затем окно.</p>}
        </div>
      </Disclosure>
    </div>
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
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase stroke" style={{ background: a.format === "online" ? "var(--head-soft)" : "#fff", color: "var(--muted)" }}>{a.format === "online" ? "онлайн" : "очно"}</span>
          <span className="shrink-0 rounded-md px-2 py-0.5 text-[12px] font-bold stroke" style={{ background: "#fff", color: cancelled ? "var(--muted-2)" : "var(--ink)" }}>{timeF.format(d)}</span>
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
  const [q, setQ] = useState("");
  const add = useMutation({
    mutationFn: ({ iso, format }: { iso: string; format: "online" | "offline" }) => createAppointment({ clientId: Number(clientId), startsAt: iso, format }),
    onSuccess: onDone,
  });
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const sel = clients.find((c) => String(c.id) === clientId);

  return (
    <div>
      <p className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-[var(--muted)]">Клиент</p>
      {sel ? (
        <button onClick={() => { tap(); setClientId(""); }} className="mb-4 flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 stroke" style={{ background: "#fff" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] stroke text-[13px] font-extrabold" style={{ background: "var(--head-soft)" }}>{sel.name.charAt(0)}</span>
          <span className="flex-1 text-left text-[14px] font-bold">{sel.name}</span>
          <span className="text-[12px] font-semibold text-[var(--muted)]">сменить</span>
        </button>
      ) : (
        <div className="mb-4">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени" />
          <div className="no-scrollbar mt-2 max-h-52 space-y-1 overflow-y-auto rounded-[14px] p-1 stroke" style={{ background: "#fff" }}>
            {filtered.map((c) => (
              <button key={c.id} onClick={() => { tap(); setClientId(String(c.id)); }} className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition-colors active:scale-[0.99]" style={{ background: "transparent" }}>
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] stroke text-[13px] font-extrabold" style={{ background: "var(--head-soft)" }}>{c.name.charAt(0)}</span>
                <span className="text-[14px] font-bold">{c.name}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="px-2 py-3 text-[13px] font-semibold text-[var(--muted-2)]">Никого не нашли.</p>}
          </div>
        </div>
      )}
      {clientId && (
        <>
          <p className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-[var(--muted)]">Формат, день и окно</p>
          <SlotPicker variant="calendar" showAvail withFormat onPick={(iso, format) => add.mutate({ iso, format })} />
        </>
      )}
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
        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl" style={{ background: "var(--a-tint)" }}>
          <span className="text-[15px] font-extrabold leading-none" style={{ color: "var(--a1-ink)" }}>{d.getDate()}</span>
          <span className="text-[9px] font-bold uppercase" style={{ color: "var(--a1-ink)" }}>{d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "")}</span>
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
