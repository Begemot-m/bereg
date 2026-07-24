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
import { getOverrides, getWorkHours, setOverride } from "@/lib/schedule";

const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const wdF = new Intl.DateTimeFormat("ru-RU", { weekday: "long" });
const dLong = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pl = (n: number, one: string, few: string, many: string) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many; };

type Slot = { iso: string; hour: number; t: string; fmt: ApptFormat; past: boolean; appt?: Appointment; removed: boolean };

// Агенда недели: каждый день — секция с ровной сеткой окон. Тап по окну раскрывает управление.
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
    <div className="space-y-4">
      {days.map((d, i) => {
        const slots = daySlots(d);
        const free = slots.filter((s) => !s.appt && !s.removed && !s.past).length;
        const busy = slots.filter((s) => !!s.appt).length;
        const isToday = i === 0;
        const openSlot = slots.find((s) => s.iso === open);
        return (
          <section key={i}>
            <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-[13.5px] font-black">{cap(wdF.format(d))}, {d.getDate()}</h3>
                {isToday && <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide" style={{ background: "var(--olive-soft)", border: "var(--bw) solid var(--olive-edge)", color: "var(--olive-edge)" }}>сегодня</span>}
              </div>
              <p className="text-[10.5px] font-black text-[var(--muted-2)]">
                {slots.length === 0 ? "выходной" : busy > 0 ? `${free} свободно · ${busy} ${pl(busy, "запись", "записи", "записей")}` : `${free} свободно`}
              </p>
            </div>
            {slots.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => <SlotChip key={s.iso} s={s} active={open === s.iso} onTap={() => { tap(); setOpen(open === s.iso ? null : s.iso); }} />)}
              </div>
            )}
            <Disclosure open={!!openSlot} zoom autoScroll={false}>
              {openSlot && <div className="mt-2"><SlotManage slot={openSlot} onClose={() => setOpen(null)} /></div>}
            </Disclosure>
          </section>
        );
      })}
    </div>
  );
}

function SlotChip({ s, active, onTap }: { s: Slot; active: boolean; onTap: () => void }) {
  const base = "relative flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-[14px] px-1";
  const fmtGlyph = <span className="absolute right-1.5 top-1.5"><Icon name={s.fmt === "online" ? "video" : "pin"} width={10} weight="fill" color="var(--muted-2)" /></span>;

  if (s.appt) {
    return (
      <motion.button whileTap={{ scale: 0.94 }} animate={{ scale: active ? 1.05 : 1 }} transition={{ type: "spring", stiffness: 460, damping: 26 }} onClick={onTap} className={base}
        style={{ background: active ? "var(--purple)" : "var(--purple-soft)", border: "var(--bw-lg) solid var(--purple-edge)", opacity: s.past ? 0.55 : 1, boxShadow: active ? "0 8px 18px -8px var(--purple-edge)" : "none" }}>
        <span className={`tnum text-[13.5px] font-black leading-none ${s.past ? "line-through" : ""}`}>{s.t}</span>
        <span className="max-w-full truncate text-[9.5px] font-bold text-[var(--muted)]">{s.appt.client.name.split(" ")[0]}</span>
        {fmtGlyph}
      </motion.button>
    );
  }
  if (s.removed) {
    return (
      <motion.button whileTap={{ scale: 0.94 }} animate={{ scale: active ? 1.05 : 1 }} transition={{ type: "spring", stiffness: 460, damping: 26 }} onClick={onTap} className={base}
        style={{ background: "#f4efe6", border: "var(--bw-lg) solid var(--edge-neutral)" }}>
        <span className="tnum text-[13.5px] font-black leading-none text-[var(--muted-2)] line-through">{s.t}</span>
        <span className="text-[9.5px] font-bold text-[var(--muted-2)]">закрыто</span>
      </motion.button>
    );
  }
  return (
    <motion.button whileTap={{ scale: 0.94 }} animate={{ scale: active ? 1.05 : 1 }} transition={{ type: "spring", stiffness: 460, damping: 26 }} onClick={onTap} disabled={s.past} className={base}
      style={{ background: active ? "var(--olive-soft)" : "#fff", border: `var(--bw-lg) solid ${s.past ? "var(--edge-neutral)" : "var(--olive-edge)"}`, opacity: s.past ? 0.5 : 1, boxShadow: active ? "0 8px 18px -8px var(--olive-edge)" : "none" }}>
      <span className={`tnum text-[13.5px] font-black leading-none ${s.past ? "line-through" : ""}`}>{s.t}</span>
      <span className="text-[9.5px] font-bold" style={{ color: s.past ? "var(--muted-2)" : "var(--olive-edge)" }}>{s.past ? "прошло" : "свободно"}</span>
      {!s.past && fmtGlyph}
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
    <div className="rounded-[16px] bg-white p-3.5" style={{ border: "var(--bw-lg) solid var(--olive-edge)", boxShadow: "0 14px 30px -18px rgba(32,28,24,.4)" }}>
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-[12.5px] font-black capitalize">{dLong.format(new Date(slot.iso))} · {slot.t}</p>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full stroke text-[13px] font-black" style={{ background: "#fff" }} aria-label="Закрыть">✕</button>
      </div>

      {slot.removed ? (
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-[var(--muted)]">Окно закрыто на этот день</p>
          <button onClick={() => openWin.mutate()} className="rounded-full px-3 py-1.5 text-[12px] font-black stroke" style={{ background: "#fff", color: "var(--green-edge)" }}>↺ Открыть</button>
        </div>
      ) : slot.appt ? (
        <>
          <div className="mb-2.5 flex items-center gap-2 rounded-[12px] bg-[var(--green-soft)] px-3 py-2" style={{ border: "var(--bw) solid var(--green-edge)" }}>
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
