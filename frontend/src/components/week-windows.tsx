"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ClientPicker } from "@/components/day-slots";
import { FmtSwitch } from "@/components/fmt-switch";
import { Icon } from "@/components/icons";
import { SlotPicker } from "@/components/slot-picker";
import { Disclosure } from "@/components/ui";
import { createAppointment, listAppointments, updateAppointment, type Appointment, type ApptFormat } from "@/lib/appointments";
import { createClient, listClients } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";
import { getOverrides, getWorkHours, setOverride, WEEKDAYS } from "@/lib/schedule";
import { slotStyle } from "@/lib/slot-style";

const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const dLong = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

type Slot = { iso: string; hour: number; t: string; fmt: ApptFormat; past: boolean; appt?: Appointment; removed: boolean };

// Вся неделя сразу: каждый день — строка окон, тап по окну раскрывает управление.
export function WeekWindows() {
  const { data: work } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const { data: appts = [] } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });
  const { data: overrides = {} } = useQuery({ queryKey: ["overrides"], queryFn: getOverrides });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }), []);
  const [open, setOpen] = useState<string | null>(null);

  const daySlots = (d: Date): Slot[] => {
    const wd = (d.getDay() + 6) % 7;
    const now = Date.now();
    const schedule: Slot[] = [...(work?.hours?.[wd] ?? [])].sort((a, b) => a.t.localeCompare(b.t)).map((s) => {
      const [hh, mm] = s.t.split(":").map(Number);
      const dt = new Date(d); dt.setHours(hh, mm, 0, 0);
      const iso = dt.toISOString(); const ov = overrides[iso];
      const appt = appts.find((a) => a.status !== "cancelled" && new Date(a.startsAt).getTime() === dt.getTime());
      return { iso, hour: hh, t: s.t, fmt: (ov?.fmt ?? s.fmt) as ApptFormat, past: dt.getTime() < now, appt, removed: !!ov?.removed };
    });
    const apptOnly: Slot[] = appts
      .filter((a) => a.status !== "cancelled" && sameDay(new Date(a.startsAt), d) && !schedule.some((s) => new Date(s.iso).getTime() === new Date(a.startsAt).getTime()))
      .map((a) => { const dt = new Date(a.startsAt); return { iso: a.startsAt, hour: dt.getHours(), t: timeF.format(dt), fmt: a.format, past: dt.getTime() < now, appt: a, removed: false }; });
    return [...schedule, ...apptOnly].sort((a, b) => a.iso.localeCompare(b.iso));
  };

  const hasWork = Object.values(work?.hours ?? {}).some((a) => (a ?? []).length > 0);
  if (!hasWork) {
    return (
      <div className="rounded-[14px] py-6 text-center text-[13px] font-semibold text-[var(--muted)] stroke" style={{ background: "#fff" }}>
        Окна ещё не заданы.<br /><Link href="/cabinet" className="font-extrabold underline">Настроить график в кабинете →</Link>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Legend />
      {days.map((d, i) => {
        const wd = (d.getDay() + 6) % 7;
        const slots = daySlots(d);
        const openSlot = slots.find((s) => s.iso === open);
        return (
          <div key={i} className="border-t py-2" style={{ borderColor: "var(--edge-neutral)" }}>
            <div className="flex items-start gap-2.5">
              <div className="w-[42px] shrink-0 pt-0.5">
                <p className="text-[10px] font-black uppercase text-[var(--muted)]">{WEEKDAYS[wd]}</p>
                <p className="tnum text-[16px] font-black leading-none" style={i === 0 ? { color: "var(--olive-edge)" } : undefined}>{d.getDate()}</p>
              </div>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {slots.length === 0
                  ? <span className="py-1 text-[11px] font-semibold text-[var(--muted-2)]">выходной</span>
                  : slots.map((s) => <SlotChip key={s.iso} s={s} active={open === s.iso} onTap={() => { tap(); setOpen(open === s.iso ? null : s.iso); }} />)}
              </div>
            </div>
            <Disclosure open={!!openSlot} zoom autoScroll={false}>
              {openSlot && <div className="mt-2"><SlotManage slot={openSlot} onClose={() => setOpen(null)} /></div>}
            </Disclosure>
          </div>
        );
      })}
    </div>
  );
}

function Legend() {
  const dot = (bg: string, bd: string) => <span className="h-2 w-2 rounded-full" style={{ background: `var(--${bg})`, border: `1px solid var(--${bd})` }} />;
  return (
    <div className="flex items-center gap-3 pb-1 text-[10px] font-black text-[var(--muted)]">
      <span className="flex items-center gap-1">{dot("slot-morn", "slot-morn-e")} свободно</span>
      <span className="flex items-center gap-1">{dot("purple", "purple-edge")} запись</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "#e7e0d2" }} /> закрыто</span>
    </div>
  );
}

function SlotChip({ s, active, onTap }: { s: Slot; active: boolean; onTap: () => void }) {
  const st = slotStyle(s.hour);
  const common = "flex items-center gap-1 rounded-[10px] px-2 py-1.5 text-[11px] font-black tnum";
  if (s.appt) {
    return (
      <motion.button whileTap={{ scale: 0.9 }} animate={{ scale: active ? 1.06 : 1 }} transition={{ type: "spring", stiffness: 420, damping: 24 }} onClick={onTap} className={common} style={{ background: "#fff", border: "var(--bw) solid var(--purple-edge)", opacity: s.past ? 0.5 : 1, boxShadow: active ? "0 6px 14px -6px var(--purple-edge)" : "none" }}>
        <span className={s.past ? "line-through" : ""}>{s.t}</span>
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--purple-soft)] text-[8px] font-black">{s.appt.client.name.charAt(0)}</span>
      </motion.button>
    );
  }
  if (s.removed) {
    return <motion.button whileTap={{ scale: 0.9 }} animate={{ scale: active ? 1.06 : 1 }} onClick={onTap} className={`${common} line-through`} style={{ background: "#f4efe6", border: "var(--bw) solid var(--edge-neutral)", color: "var(--muted-2)" }}>{s.t}</motion.button>;
  }
  return (
    <motion.button whileTap={{ scale: 0.9 }} animate={{ scale: active ? 1.06 : 1 }} transition={{ type: "spring", stiffness: 420, damping: 24 }} onClick={onTap} disabled={s.past} className={common} style={{ background: s.past ? "#f4efe6" : st.bg, border: `var(--bw) solid ${s.past ? "var(--edge-neutral)" : st.bd}`, opacity: s.past ? 0.5 : 1, boxShadow: active ? `0 6px 14px -6px ${st.bd}` : "none" }}>
      <span className={s.past ? "line-through" : ""}>{s.t}</span>
      {!s.past && <Icon name={st.icon} width={10} weight="fill" color={st.ic} />}
    </motion.button>
  );
}

// Управление окном: раскрывается под днём. Свободное — запись/закрыть; занятое — перенос/отмена.
function SlotManage({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const qc = useQueryClient();
  const inv = () => { for (const k of ["appointments", "slots", "month-avail", "overrides"]) qc.invalidateQueries({ queryKey: [k] }); };
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const sorted = [...clients].sort((a, b) => (a.status === "therapy" ? 0 : 1) - (b.status === "therapy" ? 0 : 1));
  const [resch, setResch] = useState(false);

  const book = useMutation({ mutationFn: ({ clientId, format }: { clientId: number; format: ApptFormat }) => createAppointment({ clientId, startsAt: slot.iso, format }), onSuccess: () => { success(); onClose(); inv(); } });
  const create = useMutation({ mutationFn: (name: string) => createClient(name, ""), onSuccess: (c) => { qc.invalidateQueries({ queryKey: ["clients"] }); book.mutate({ clientId: c.id, format: slot.fmt }); } });
  const setFmt = useMutation({ mutationFn: async (format: ApptFormat) => { if (slot.appt) await updateAppointment(slot.appt.id, { format }); else await setOverride(slot.iso, { fmt: format }); }, onSuccess: () => { select(); inv(); } });
  const cancel = useMutation({ mutationFn: () => updateAppointment(slot.appt!.id, { status: "cancelled" }), onSuccess: () => { onClose(); inv(); } });
  const move = useMutation({ mutationFn: (iso: string) => updateAppointment(slot.appt!.id, { startsAt: iso }), onSuccess: () => { success(); onClose(); inv(); } });
  const closeWin = useMutation({ mutationFn: () => setOverride(slot.iso, { removed: true }), onSuccess: () => { onClose(); inv(); } });
  const openWin = useMutation({ mutationFn: () => setOverride(slot.iso, { removed: false }), onSuccess: () => { select(); inv(); } });

  return (
    <div className="rounded-[16px] bg-white p-3" style={{ border: "var(--bw-lg) solid var(--olive-edge)" }}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-black capitalize">{dLong.format(new Date(slot.iso))} · {slot.t}</p>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full stroke text-[13px] font-black" style={{ background: "#fff" }} aria-label="Закрыть">✕</button>
      </div>

      {slot.removed ? (
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-[var(--muted)]">Окно закрыто на этот день</p>
          <button onClick={() => openWin.mutate()} className="rounded-full px-3 py-1.5 text-[12px] font-black stroke" style={{ background: "#fff", color: "var(--green-edge)" }}>↺ Открыть</button>
        </div>
      ) : slot.appt ? (
        <>
          <div className="mb-2 flex items-center gap-2 rounded-[12px] bg-[var(--green-soft)] px-3 py-2" style={{ border: "var(--bw) solid var(--green-edge)" }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-white text-[12px] font-black stroke">{slot.appt.client.name.charAt(0)}</span>
            <span className="text-[13px] font-black">{slot.appt.client.name}</span>
          </div>
          {resch ? (
            <div className="rounded-[12px] p-2.5 stroke" style={{ background: "#faf7f0" }}>
              <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">Новое окно</p>
              <SlotPicker variant="calendar" showAvail onPick={(iso) => move.mutate(iso)} />
              <button onClick={() => setResch(false)} className="mt-2 text-[12px] font-semibold text-[var(--muted)]">Отмена</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <FmtSwitch fmt={slot.appt.format} onToggle={() => setFmt.mutate(slot.appt!.format === "online" ? "offline" : "online")} />
              <button onClick={() => setResch(true)} className="rounded-full bg-white px-3 py-1.5 text-[12px] font-black stroke">Перенести</button>
              {!slot.past && <button onClick={() => cancel.mutate()} className="ml-auto rounded-full px-3 py-1.5 text-[12px] font-black stroke" style={{ background: "#fff", color: "var(--salmon-edge)", borderColor: "var(--salmon-edge)" }}>Отменить</button>}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">Свободное окно</p>
            <div className="flex items-center gap-1.5">
              <FmtSwitch fmt={slot.fmt} onToggle={() => setFmt.mutate(slot.fmt === "online" ? "offline" : "online")} />
              <button onClick={() => closeWin.mutate()} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black stroke" style={{ color: "var(--salmon-edge)" }}>Закрыть</button>
            </div>
          </div>
          <ClientPicker clients={sorted} onCreateClient={(name) => create.mutate(name)} onPick={(id) => book.mutate({ clientId: id, format: slot.fmt })} />
        </>
      )}
    </div>
  );
}
