"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { FmtSwitch } from "@/components/fmt-switch";
import { Icon } from "@/components/icons";
import { SlotPicker } from "@/components/slot-picker";
import { Button, Disclosure } from "@/components/ui";
import { createAppointment, listAppointments, updateAppointment, type Appointment, type ApptFormat } from "@/lib/appointments";
import { listClients } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";
import { getOverrides, getWorkHours, setOverride } from "@/lib/schedule";
import { slotStyle } from "@/lib/slot-style";

const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const SPRING = { type: "spring" as const, stiffness: 460, damping: 26 };
type Patch = { removed?: boolean; fmt?: ApptFormat };

export function DaySlots({ date, bookedOnly = false }: { date: Date; bookedOnly?: boolean }) {
  const qc = useQueryClient();
  const { data: work } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const { data: appts = [] } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: overrides = {} } = useQuery({ queryKey: ["overrides"], queryFn: getOverrides });
  const [pick, setPick] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [showPastEmpty, setShowPastEmpty] = useState(false);

  const inv = () => { for (const k of ["appointments", "slots", "month-avail", "overrides"]) qc.invalidateQueries({ queryKey: [k] }); };
  const book = useMutation({ mutationFn: ({ clientId, iso, format }: { clientId: number; iso: string; format: ApptFormat }) => createAppointment({ clientId, startsAt: iso, format }), onSuccess: () => { success(); setPick(null); inv(); } });
  const setOv = useMutation({ mutationFn: ({ iso, patch }: { iso: string; patch: Patch }) => setOverride(iso, patch), onSuccess: () => { select(); inv(); } });
  const batch = useMutation({ mutationFn: async (ops: { iso: string; patch: Patch }[]) => { for (const o of ops) await setOverride(o.iso, o.patch); }, onSuccess: () => { success(); setMenu(false); inv(); } });
  const sortedClients = [...clients].sort((a, b) => (a.status === "therapy" ? 0 : 1) - (b.status === "therapy" ? 0 : 1));

  const wd = (date.getDay() + 6) % 7;
  const now = Date.now();
  const dayAppts = appts
    .filter((a) => a.status !== "cancelled" && sameDay(new Date(a.startsAt), date))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const scheduleSlots = [...(work?.hours?.[wd] ?? [])].sort((a, b) => a.t.localeCompare(b.t)).map((s) => {
    const [hh, mm] = s.t.split(":").map(Number);
    const dt = new Date(date); dt.setHours(hh, mm, 0, 0);
    const iso = dt.toISOString();
    const ov = overrides[iso];
    const appt = appts.find((a) => a.status !== "cancelled" && new Date(a.startsAt).getTime() === dt.getTime());
    return { t: s.t, hour: hh, fmt: (ov?.fmt ?? s.fmt) as ApptFormat, iso, past: dt.getTime() < now, appt, removed: !!ov?.removed };
  });
  const appointmentOnlySlots = dayAppts
    .filter((appt) => !scheduleSlots.some((slot) => new Date(slot.iso).getTime() === new Date(appt.startsAt).getTime()))
    .map((appt) => {
      const dt = new Date(appt.startsAt);
      return { t: timeF.format(dt), hour: dt.getHours(), fmt: appt.format, iso: appt.startsAt, past: dt.getTime() < now, appt, removed: false };
    });
  const slots = [...scheduleSlots, ...appointmentOnlySlots].sort((a, b) => a.iso.localeCompare(b.iso));

  // Режим «Ближайшие»: только записи этого дня (независимо от шаблона), без свободных окон и меню.
  if (bookedOnly) {
    if (dayAppts.length === 0) return null;
    return <div className="space-y-1.5">{dayAppts.map((a) => <BusyRow key={a.id} appt={a} hour={new Date(a.startsAt).getHours()} onChanged={inv} />)}</div>;
  }

  if (slots.length === 0) return <p className="py-3 text-center text-[13px] font-semibold text-[var(--muted-2)]">В этот день окон нет.</p>;

  const futureFree = slots.filter((s) => !s.appt && !s.removed && !s.past);
  const removedSlots = slots.filter((s) => s.removed);
  const futureNonAppt = slots.filter((s) => !s.appt && !s.past);
  const hiddenPastCount = slots.filter((s) => s.past && !s.appt).length;
  const hasFutureSlots = slots.some((s) => !s.past);
  const visibleSlots = slots.filter((s) => !s.past || !!s.appt || showPastEmpty);
  const menuAct = (ops: { iso: string; patch: Patch }[]) => { if (ops.length) batch.mutate(ops); else setMenu(false); };

  return (
    <div className="space-y-1.5">
      {/* История и меню дня */}
      {(hiddenPastCount > 0 || hasFutureSlots) && <div className="relative mb-1 flex items-center gap-2">
        {hiddenPastCount > 0 && (
          <button onClick={() => { tap(); setShowPastEmpty(!showPastEmpty); }} className="rounded-full px-3 py-1 text-[12px] font-extrabold stroke" style={{ background: showPastEmpty ? "var(--ink)" : "#fff", color: showPastEmpty ? "#fff" : undefined, borderColor: showPastEmpty ? "var(--ink)" : undefined }}>
            {showPastEmpty ? "Скрыть пустые окна" : `Показать все окна · ${hiddenPastCount}`}
          </button>
        )}
        {hasFutureSlots && <button onClick={() => { tap(); setMenu(!menu); }} className="ml-auto flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-extrabold stroke" style={{ background: "#fff" }}><Icon name="gear" width={14} /> Действия</button>}
        {hasFutureSlots && menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={SPRING} className="absolute right-0 top-8 z-20 w-52 overflow-hidden rounded-[14px] p-1 stroke" style={{ background: "#fff", boxShadow: "0 12px 30px -12px rgba(32,28,24,.35)" }}>
              <MenuItem onClick={() => menuAct(futureFree.map((s) => ({ iso: s.iso, patch: { removed: true } })))}>🌙 Сделать выходным</MenuItem>
              <MenuItem onClick={() => menuAct(removedSlots.map((s) => ({ iso: s.iso, patch: { removed: false } })))}>↺ Открыть все окна</MenuItem>
              <MenuItem onClick={() => menuAct(futureNonAppt.map((s) => ({ iso: s.iso, patch: { fmt: "online" } })))}>📹 Все окна — онлайн</MenuItem>
              <MenuItem onClick={() => menuAct(futureNonAppt.map((s) => ({ iso: s.iso, patch: { fmt: "offline" } })))}>📍 Все окна — очно</MenuItem>
            </motion.div>
          </>
        )}
      </div>}

      {visibleSlots.length === 0 && <p className="py-3 text-center text-[13px] font-semibold text-[var(--muted-2)]">Состоявшихся сессий нет.</p>}

      {visibleSlots.map((s) => {
        if (s.appt) return <BusyRow key={s.iso} appt={s.appt} hour={s.hour} onChanged={inv} />;
        const picking = pick === s.iso;
        const st = slotStyle(s.hour);
        if (s.removed) {
          return (
            <motion.div key={s.iso} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 rounded-[12px] px-3 py-2 stroke-lg" style={{ background: "#f7f3ea", borderColor: "var(--edge-neutral)", opacity: 0.7 }}>
              <span className="text-[13px] font-extrabold tnum text-[var(--muted-2)] line-through">{timeF.format(new Date(s.iso))}</span>
              <span className="flex-1 text-[12px] font-semibold text-[var(--muted-2)]">закрыто</span>
              {!s.past && <button onClick={() => setOv.mutate({ iso: s.iso, patch: { removed: false } })} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold stroke" style={{ background: "#fff", color: "var(--green-edge)" }}>↺ Открыть</button>}
            </motion.div>
          );
        }
        if (s.past) {
          return (
            <motion.div key={s.iso} layout initial={{ opacity: 0 }} animate={{ opacity: 0.52 }} className="flex items-center gap-2 rounded-[12px] px-3 py-2 stroke-lg" style={{ background: st.bg, borderColor: st.bd }}>
              <span className="text-[13px] font-extrabold tnum line-through">{timeF.format(new Date(s.iso))}</span>
              <span className="flex-1 text-[12px] font-semibold text-[var(--muted)] line-through">пустое окно</span>
              <Icon name={st.icon} width={13} weight="fill" color={st.ic} />
            </motion.div>
          );
        }
        return (
          <motion.div key={s.iso} layout>
            <div className="flex items-center gap-2 rounded-[12px] px-3 py-2 stroke-lg" style={{ background: picking ? st.bg : st.bg, borderColor: st.bd }}>
              <span className="text-[13px] font-extrabold tnum">{timeF.format(new Date(s.iso))}</span>
              <button disabled={s.past} onClick={() => { tap(); setPick(picking ? null : s.iso); }} className="flex-1 text-left text-[13px] font-bold text-[var(--muted)] disabled:opacity-70">{s.past ? "прошло" : picking ? "выберите клиента" : "свободное окно"}</button>
              {!s.past && <Icon name={st.icon} width={13} weight="fill" color={st.ic} />}
              {!s.past && <FmtSwitch fmt={s.fmt} onToggle={() => setOv.mutate({ iso: s.iso, patch: { fmt: s.fmt === "online" ? "offline" : "online" } })} />}
              {!s.past && <button onClick={() => setOv.mutate({ iso: s.iso, patch: { removed: true } })} className="flex h-6 w-6 items-center justify-center text-[15px] font-black leading-none" style={{ color: "var(--salmon-edge)" }} aria-label="Закрыть окно">✕</button>}
            </div>
            <Disclosure open={picking && !s.past}>
              <div className="mt-1.5 rounded-[12px] p-2.5 stroke" style={{ background: "#fff" }}>
                <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--muted-2)]">Клиент</p>
                <div className="no-scrollbar flex max-h-40 flex-col gap-1 overflow-y-auto">
                  <AnimatePresence>
                    {sortedClients.map((c) => (
                      <motion.button key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={SPRING} onClick={() => book.mutate({ clientId: c.id, iso: s.iso, format: s.fmt })} className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-left active:scale-[0.99]">
                        <span className="flex h-7 w-7 items-center justify-center rounded-[9px] stroke text-[12px] font-extrabold" style={{ background: c.status === "therapy" ? "var(--green-soft)" : "var(--head-soft)" }}>{c.name.charAt(0)}</span>
                        <span className="flex-1 text-[13px] font-bold">{c.name}</span>
                        {c.status === "therapy" && <span className="rounded-full px-1.5 text-[9px] font-extrabold uppercase text-[var(--green-edge)]">терапия</span>}
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </Disclosure>
          </motion.div>
        );
      })}
    </div>
  );
}

// Занятое окно: белая карточка + компактная шестерёнка (отменить / перенести).
function BusyRow({ appt, hour, onChanged }: { appt: Appointment; hour: number; onChanged: () => void }) {
  const [manage, setManage] = useState(false);
  const [resch, setResch] = useState(false);
  const st = slotStyle(hour);
  const past = new Date(appt.startsAt).getTime() < Date.now();
  const setFmt = useMutation({ mutationFn: (format: ApptFormat) => updateAppointment(appt.id, { format }), onSuccess: onChanged });
  const cancel = useMutation({ mutationFn: () => updateAppointment(appt.id, { status: "cancelled" }), onSuccess: () => { setManage(false); onChanged(); } });
  const move = useMutation({ mutationFn: (iso: string) => updateAppointment(appt.id, { startsAt: iso }), onSuccess: () => { setResch(false); setManage(false); onChanged(); } });
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: past ? 0.68 : 1, scale: 1 }} transition={SPRING} className="rounded-[12px] stroke-lg" style={{ background: "#fff", borderColor: "var(--edge-neutral)" }}>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="h-6 w-1.5 shrink-0 rounded-full" style={{ background: st.bg, border: `1px solid ${st.bd}` }} />
        <span className={`text-[13px] font-extrabold tnum ${past ? "line-through" : ""}`}>{timeF.format(new Date(appt.startsAt))}</span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[13px] font-bold ${past ? "line-through" : ""}`}>{appt.client.name}</span>
          {past && <span className="block text-[9px] font-extrabold uppercase tracking-wide text-[var(--muted)]">выполнено</span>}
        </span>
        <Icon name={st.icon} width={13} weight="fill" color={st.ic} />
        <FmtSwitch fmt={appt.format} onToggle={() => setFmt.mutate(appt.format === "online" ? "offline" : "online")} />
        <button onClick={() => { tap(); setManage(!manage); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] stroke" style={manage ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff" }} aria-label="Управлять сессией" aria-expanded={manage}><Icon name="gear" width={15} color={manage ? "#fff" : undefined} /></button>
      </div>
      <Disclosure open={manage}>
        <div className="px-3 pb-3">
          {resch ? (
            <div className="rounded-[12px] p-2.5 stroke" style={{ background: "#faf7f0" }}>
              <p className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--muted)]">Новое окно</p>
              <SlotPicker variant="calendar" showAvail onPick={(iso) => move.mutate(iso)} />
              <button onClick={() => setResch(false)} className="mt-2 text-[12px] font-semibold text-[var(--muted)]">Отмена</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="soft" onClick={() => setResch(true)}>Перенести</Button>
              <button onClick={() => cancel.mutate()} className="ml-auto rounded-full px-3 py-1.5 text-[12px] font-extrabold stroke" style={{ background: "#fff", color: "var(--salmon-edge)", borderColor: "var(--salmon-edge)" }}>Отменить</button>
            </div>
          )}
        </div>
      </Disclosure>
    </motion.div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-bold transition-colors hover:bg-[var(--head-soft)] active:scale-[0.99]">{children}</button>
  );
}
