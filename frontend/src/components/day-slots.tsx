"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { FmtSwitch } from "@/components/fmt-switch";
import { Disclosure } from "@/components/ui";
import { createAppointment, listAppointments, updateAppointment, type ApptFormat } from "@/lib/appointments";
import { listClients } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";
import { getOverrides, getWorkHours, setOverride } from "@/lib/schedule";

const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const SPRING = { type: "spring" as const, stiffness: 460, damping: 26 };
type Patch = { removed?: boolean; fmt?: ApptFormat };

export function DaySlots({ date }: { date: Date }) {
  const qc = useQueryClient();
  const { data: work } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const { data: appts = [] } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: overrides = {} } = useQuery({ queryKey: ["overrides"], queryFn: getOverrides });
  const [pick, setPick] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  const inv = () => { for (const k of ["appointments", "slots", "month-avail", "overrides"]) qc.invalidateQueries({ queryKey: [k] }); };
  const book = useMutation({ mutationFn: ({ clientId, iso, format }: { clientId: number; iso: string; format: ApptFormat }) => createAppointment({ clientId, startsAt: iso, format }), onSuccess: () => { success(); setPick(null); inv(); } });
  const cancel = useMutation({ mutationFn: (id: number) => updateAppointment(id, { status: "cancelled" }), onSuccess: () => { select(); inv(); } });
  const setApptFmt = useMutation({ mutationFn: ({ id, format }: { id: number; format: ApptFormat }) => updateAppointment(id, { format }), onSuccess: inv });
  const setOv = useMutation({ mutationFn: ({ iso, patch }: { iso: string; patch: Patch }) => setOverride(iso, patch), onSuccess: () => { select(); inv(); } });
  const batch = useMutation({ mutationFn: async (ops: { iso: string; patch: Patch }[]) => { for (const o of ops) await setOverride(o.iso, o.patch); }, onSuccess: () => { success(); setMenu(false); inv(); } });
  const sortedClients = [...clients].sort((a, b) => (a.status === "therapy" ? 0 : 1) - (b.status === "therapy" ? 0 : 1));

  const wd = (date.getDay() + 6) % 7;
  const now = Date.now();
  const slots = [...(work?.hours?.[wd] ?? [])].sort((a, b) => a.t.localeCompare(b.t)).map((s) => {
    const [hh, mm] = s.t.split(":").map(Number);
    const dt = new Date(date); dt.setHours(hh, mm, 0, 0);
    const iso = dt.toISOString();
    const ov = overrides[iso];
    const appt = appts.find((a) => a.status !== "cancelled" && new Date(a.startsAt).getTime() === dt.getTime());
    return { t: s.t, fmt: (ov?.fmt ?? s.fmt) as ApptFormat, iso, past: dt.getTime() < now, appt, removed: !!ov?.removed };
  });

  if (slots.length === 0) return <p className="py-3 text-center text-[13px] font-semibold text-[var(--muted-2)]">В этот день окон нет.</p>;

  const futureFree = slots.filter((s) => !s.appt && !s.removed && !s.past);
  const removedSlots = slots.filter((s) => s.removed);
  const futureNonAppt = slots.filter((s) => !s.appt && !s.past);
  const menuAct = (ops: { iso: string; patch: Patch }[]) => { if (ops.length) batch.mutate(ops); else setMenu(false); };

  return (
    <div className="space-y-1.5">
      {/* Мини-меню дня */}
      <div className="relative mb-1 flex justify-end">
        <button onClick={() => { tap(); setMenu(!menu); }} className="flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-extrabold stroke" style={{ background: "#fff" }}>Действия ▾</button>
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={SPRING} className="absolute right-0 top-8 z-20 w-52 overflow-hidden rounded-[14px] p-1 stroke" style={{ background: "#fff", boxShadow: "0 12px 30px -12px rgba(32,28,24,.35)" }}>
              <MenuItem onClick={() => menuAct(futureFree.map((s) => ({ iso: s.iso, patch: { removed: true } })))}>🌙 Сделать выходным</MenuItem>
              <MenuItem onClick={() => menuAct(removedSlots.map((s) => ({ iso: s.iso, patch: { removed: false } })))}>↩︎ Вернуть все окна</MenuItem>
              <MenuItem onClick={() => menuAct(futureNonAppt.map((s) => ({ iso: s.iso, patch: { fmt: "online" } })))}>📹 Все окна — онлайн</MenuItem>
              <MenuItem onClick={() => menuAct(futureNonAppt.map((s) => ({ iso: s.iso, patch: { fmt: "offline" } })))}>📍 Все окна — очно</MenuItem>
            </motion.div>
          </>
        )}
      </div>

      {slots.map((s) => {
        const picking = pick === s.iso;
        if (s.appt) {
          return (
            <motion.div key={s.iso} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING} className="flex items-center gap-2 rounded-[12px] px-3 py-2 stroke" style={{ background: "var(--purple-soft)", borderColor: "var(--purple-edge)" }}>
              <span className="text-[13px] font-extrabold tnum">{timeF.format(new Date(s.iso))}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{s.appt.client.name}</span>
              <FmtSwitch fmt={s.appt.format} onToggle={() => setApptFmt.mutate({ id: s.appt!.id, format: s.appt!.format === "online" ? "offline" : "online" })} />
              <button onClick={() => cancel.mutate(s.appt!.id)} className="rounded-full px-2.5 py-1 text-[11px] font-extrabold stroke" style={{ background: "#fff" }}>Отменить</button>
            </motion.div>
          );
        }
        const frozen = s.removed;
        return (
          <motion.div key={s.iso} layout>
            <div className="flex items-center gap-2 rounded-[12px] px-3 py-2 stroke transition-all" style={{ background: frozen ? "#f7f3ea" : picking ? "var(--head)" : "var(--green-soft)", borderColor: frozen ? "var(--edge-neutral)" : "var(--green-edge)", opacity: frozen ? 0.62 : 1 }}>
              <span className={`text-[13px] font-extrabold tnum ${frozen ? "line-through text-[var(--muted-2)]" : ""}`}>{timeF.format(new Date(s.iso))}</span>
              <button disabled={frozen || s.past} onClick={() => { tap(); setPick(picking ? null : s.iso); }} className="flex-1 text-left text-[13px] font-bold text-[var(--muted)] disabled:opacity-70">{s.past ? "прошло" : frozen ? "заморожено" : picking ? "выберите клиента" : "свободно"}</button>
              {!s.past && !frozen && <FmtSwitch fmt={s.fmt} onToggle={() => setOv.mutate({ iso: s.iso, patch: { fmt: s.fmt === "online" ? "offline" : "online" } })} />}
              {!s.past && (frozen ? (
                <button onClick={() => setOv.mutate({ iso: s.iso, patch: { removed: false } })} className="flex h-6 w-6 items-center justify-center text-[15px] font-black leading-none" style={{ color: "var(--green-edge)" }} aria-label="Вернуть окно">✓</button>
              ) : (
                <button onClick={() => setOv.mutate({ iso: s.iso, patch: { removed: true } })} className="flex h-6 w-6 items-center justify-center text-[15px] font-black leading-none" style={{ color: "var(--salmon-edge)" }} aria-label="Заморозить окно">✕</button>
              ))}
            </div>
            <Disclosure open={picking && !frozen}>
              <div className="mt-1.5 rounded-[12px] p-2.5 stroke" style={{ background: "#fff" }}>
                <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--muted-2)]">Клиент · сначала в терапии</p>
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

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-bold transition-colors hover:bg-[var(--head-soft)] active:scale-[0.99]">{children}</button>
  );
}
