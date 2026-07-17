"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Disclosure } from "@/components/ui";
import { createAppointment, listAppointments, updateAppointment, type ApptFormat } from "@/lib/appointments";
import { listClients } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";
import { getWorkHours, WEEKDAYS } from "@/lib/schedule";

const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const SPRING = { type: "spring" as const, stiffness: 460, damping: 26 };

// Готовый недельный график окон: видно свободные/занятые, быстрое действие по тапу.
export function WeekWindows() {
  const qc = useQueryClient();
  const { data: work } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const { data: appts = [] } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }), []);
  const [sel, setSel] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [fmt, setFmt] = useState<ApptFormat>("online");

  const inv = () => { qc.invalidateQueries({ queryKey: ["appointments"] }); qc.invalidateQueries({ queryKey: ["slots"] }); qc.invalidateQueries({ queryKey: ["month-avail"] }); };
  const book = useMutation({ mutationFn: ({ clientId, iso, format }: { clientId: number; iso: string; format: ApptFormat }) => createAppointment({ clientId, startsAt: iso, format }), onSuccess: () => { success(); setPick(null); inv(); } });
  const cancel = useMutation({ mutationFn: (id: number) => updateAppointment(id, { status: "cancelled" }), onSuccess: () => { select(); inv(); } });

  const sortedClients = [...clients].sort((a, b) => (a.status === "therapy" ? 0 : 1) - (b.status === "therapy" ? 0 : 1));

  const slotsOf = (d: Date) => {
    const wd = (d.getDay() + 6) % 7;
    const now = Date.now();
    return [...(work?.hours?.[wd] ?? [])].sort((a, b) => a.t.localeCompare(b.t)).map((s) => {
      const [hh, mm] = s.t.split(":").map(Number);
      const dt = new Date(d); dt.setHours(hh, mm, 0, 0);
      const appt = appts.find((a) => a.status !== "cancelled" && new Date(a.startsAt).getTime() === dt.getTime());
      return { t: s.t, dur: s.d, iso: dt.toISOString(), past: dt.getTime() < now, appt };
    });
  };

  const hasWork = Object.values(work?.hours ?? {}).some((a) => (a ?? []).length > 0);
  const cur = days[sel];
  const curSlots = slotsOf(cur);

  if (!hasWork) {
    return (
      <div className="rounded-[14px] py-6 text-center text-[13px] font-semibold text-[var(--muted)] stroke" style={{ background: "#fff" }}>
        Окна ещё не заданы.<br /><Link href="/cabinet" className="font-extrabold underline">Настроить график в кабинете →</Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Обзор недели */}
      <div className="flex gap-1.5">
        {days.map((d, i) => {
          const list = slotsOf(d);
          const free = list.filter((s) => !s.appt && !s.past).length;
          const busy = list.filter((s) => s.appt).length;
          const isSel = i === sel;
          const wd = (d.getDay() + 6) % 7;
          return (
            <button key={i} onClick={() => { select(); setSel(i); setPick(null); }} className="flex flex-1 flex-col items-center gap-1 rounded-[11px] py-1.5 stroke" style={isSel ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff" }}>
              <span className="text-[9px] font-extrabold uppercase opacity-70">{WEEKDAYS[wd]}</span>
              <span className="text-[15px] font-extrabold leading-none">{d.getDate()}</span>
              <span className="flex gap-0.5">
                {free > 0 && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--green)", border: "1px solid var(--green-edge)" }} />}
                {busy > 0 && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--salmon)", border: "1px solid var(--salmon-edge)" }} />}
                {free + busy === 0 && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--edge-neutral)" }} />}
              </span>
            </button>
          );
        })}
      </div>

      {/* Окна выбранного дня */}
      {curSlots.length === 0 ? (
        <p className="py-4 text-center text-[13px] font-semibold text-[var(--muted-2)]">В этот день окон нет.</p>
      ) : (
        <div className="space-y-1.5">
          {curSlots.map((s) => {
            const picking = pick === s.iso;
            if (s.appt) {
              return (
                <div key={s.iso} className="flex items-center gap-2 rounded-[12px] px-3 py-2 stroke" style={{ background: "var(--salmon-soft)", borderColor: "var(--salmon-edge)" }}>
                  <span className="text-[13px] font-extrabold tnum">{timeF.format(new Date(s.iso))}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{s.appt.client.name}</span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase stroke" style={{ background: "#fff" }}>{s.appt.format === "online" ? "онлайн" : "очно"}</span>
                  <button onClick={() => cancel.mutate(s.appt!.id)} className="rounded-full px-2.5 py-1 text-[11px] font-extrabold stroke" style={{ background: "#fff" }}>Отменить</button>
                </div>
              );
            }
            return (
              <div key={s.iso}>
                <button
                  disabled={s.past}
                  onClick={() => { tap(); setPick(picking ? null : s.iso); }}
                  className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left stroke disabled:opacity-45"
                  style={{ background: picking ? "var(--head)" : "var(--green-soft)", borderColor: "var(--green-edge)" }}
                >
                  <span className="text-[13px] font-extrabold tnum">{timeF.format(new Date(s.iso))}</span>
                  <span className="flex-1 text-[13px] font-bold text-[var(--muted)]">{s.past ? "прошло" : "свободно"}</span>
                  {!s.past && <span className="text-[16px] font-bold leading-none">{picking ? "×" : "＋"}</span>}
                </button>
                <Disclosure open={picking}>
                  <div className="mt-1.5 rounded-[12px] p-2.5 stroke" style={{ background: "#fff" }}>
                    <div className="mb-2 flex gap-1.5">
                      {(["online", "offline"] as ApptFormat[]).map((f) => (
                        <button key={f} onClick={() => { select(); setFmt(f); }} className="flex-1 rounded-full py-1 text-[12px] font-extrabold stroke" style={fmt === f ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff", color: "var(--muted)" }}>{f === "online" ? "Онлайн" : "Очно"}</button>
                      ))}
                    </div>
                    <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--muted-2)]">Клиент · сначала в терапии</p>
                    <div className="no-scrollbar flex max-h-40 flex-col gap-1 overflow-y-auto">
                      <AnimatePresence>
                        {sortedClients.map((c) => (
                          <motion.button key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={SPRING} onClick={() => book.mutate({ clientId: c.id, iso: s.iso, format: fmt })} className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-left active:scale-[0.99]">
                            <span className="flex h-7 w-7 items-center justify-center rounded-[9px] stroke text-[12px] font-extrabold" style={{ background: c.status === "therapy" ? "var(--green-soft)" : "var(--head-soft)" }}>{c.name.charAt(0)}</span>
                            <span className="flex-1 text-[13px] font-bold">{c.name}</span>
                            {c.status === "therapy" && <span className="rounded-full px-1.5 text-[9px] font-extrabold uppercase text-[var(--green-edge)]">терапия</span>}
                          </motion.button>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </Disclosure>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
