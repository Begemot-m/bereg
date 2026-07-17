"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Disclosure } from "@/components/ui";
import { createAppointment, listAppointments, updateAppointment, type ApptFormat } from "@/lib/appointments";
import { listClients } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";
import { getWorkHours } from "@/lib/schedule";

const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const SPRING = { type: "spring" as const, stiffness: 460, damping: 26 };

// Слоты одного дня: свободные окна (тап → выбор клиента → запись) и
// поставленные сессии (можно отменить). Формат берётся из окна.
export function DaySlots({ date }: { date: Date }) {
  const qc = useQueryClient();
  const { data: work } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const { data: appts = [] } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [pick, setPick] = useState<string | null>(null);

  const inv = () => { qc.invalidateQueries({ queryKey: ["appointments"] }); qc.invalidateQueries({ queryKey: ["slots"] }); qc.invalidateQueries({ queryKey: ["month-avail"] }); };
  const book = useMutation({ mutationFn: ({ clientId, iso, format }: { clientId: number; iso: string; format: ApptFormat }) => createAppointment({ clientId, startsAt: iso, format }), onSuccess: () => { success(); setPick(null); inv(); } });
  const cancel = useMutation({ mutationFn: (id: number) => updateAppointment(id, { status: "cancelled" }), onSuccess: () => { select(); inv(); } });
  const sortedClients = [...clients].sort((a, b) => (a.status === "therapy" ? 0 : 1) - (b.status === "therapy" ? 0 : 1));

  const wd = (date.getDay() + 6) % 7;
  const now = Date.now();
  const slots = [...(work?.hours?.[wd] ?? [])].sort((a, b) => a.t.localeCompare(b.t)).map((s) => {
    const [hh, mm] = s.t.split(":").map(Number);
    const dt = new Date(date); dt.setHours(hh, mm, 0, 0);
    const appt = appts.find((a) => a.status !== "cancelled" && new Date(a.startsAt).getTime() === dt.getTime());
    return { t: s.t, fmt: s.fmt, iso: dt.toISOString(), past: dt.getTime() < now, appt };
  });

  if (slots.length === 0) return <p className="py-3 text-center text-[13px] font-semibold text-[var(--muted-2)]">В этот день окон нет.</p>;

  return (
    <div className="space-y-1.5">
      {slots.map((s) => {
        const picking = pick === s.iso;
        if (s.appt) {
          return (
            <motion.div key={s.iso} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING} className="flex items-center gap-2 rounded-[12px] px-3 py-2 stroke" style={{ background: "var(--salmon-soft)", borderColor: "var(--salmon-edge)" }}>
              <span className="text-[13px] font-extrabold tnum">{timeF.format(new Date(s.iso))}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{s.appt.client.name}</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase stroke" style={{ background: "#fff" }}>{s.appt.format === "online" ? "онлайн" : "очно"}</span>
              <button onClick={() => cancel.mutate(s.appt!.id)} className="rounded-full px-2.5 py-1 text-[11px] font-extrabold stroke" style={{ background: "#fff" }}>Отменить</button>
            </motion.div>
          );
        }
        return (
          <motion.div key={s.iso} layout>
            <button
              disabled={s.past}
              onClick={() => { tap(); setPick(picking ? null : s.iso); }}
              className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left stroke disabled:opacity-45"
              style={{ background: picking ? "var(--head)" : "var(--green-soft)", borderColor: "var(--green-edge)" }}
            >
              <span className="text-[13px] font-extrabold tnum">{timeF.format(new Date(s.iso))}</span>
              <span className="flex flex-1 items-center gap-1 text-[13px] font-bold text-[var(--muted)]"><Icon name={s.fmt === "online" ? "video" : "pin"} width={12} />{s.past ? "прошло" : s.fmt === "online" ? "онлайн" : "очно"}</span>
              {!s.past && <span className="text-[16px] font-bold leading-none">{picking ? "×" : "＋"}</span>}
            </button>
            <Disclosure open={picking}>
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
