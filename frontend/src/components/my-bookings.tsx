"use client";

import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { SlotPicker } from "@/components/slot-picker";
import { Disclosure } from "@/components/ui";
import { canCancel, useCancelLockDays } from "@/lib/cancel-policy";
import type { MyBooking } from "@/lib/clients";
import { tap } from "@/lib/haptics";
import { cancelMyBooking, rescheduleMyBooking } from "@/lib/mybookings";
import { slotStyle } from "@/lib/slot-style";

const SPRING = { type: "spring" as const, stiffness: 460, damping: 26 };
const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const dayF = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long" });

// Запись клиента. Вид тот же, что у занятого окна в сессиях психолога:
// строка со временем, шестерёнка разворачивает перенос и отмену.
export function BookingRow({ b, onChange, defaultOpen = false }: { b: MyBooking; onChange: () => void; defaultOpen?: boolean }) {
  const [manage, setManage] = useState(defaultOpen);
  const [resch, setResch] = useState(false);
  // Правило приезжает вместе с записью. Локальное значение — запасной вариант
  // для демо, где обе роли живут в одном браузере.
  const [localLock] = useCancelLockDays();
  const lockDays = b.cancelLockDays ?? localLock;
  const date = new Date(b.startsAt);
  const past = date.getTime() < Date.now();
  const locked = !past && !canCancel(b.startsAt, lockDays);
  const st = slotStyle(date.getHours());

  const move = useMutation({ mutationFn: (iso: string) => rescheduleMyBooking(b.id, iso), onSuccess: () => { setResch(false); setManage(false); onChange(); } });
  const cancel = useMutation({ mutationFn: () => cancelMyBooking(b.id), onSuccess: () => { setManage(false); onChange(); } });
  const toggle = () => { tap(); setManage(!manage); };

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: past ? 0.68 : 1, scale: 1 }} transition={SPRING} className="card-nested overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Миниатюра терапевта: буква на тоне времени суток — как в сессиях психолога */}
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-black" style={{ background: st.bg, border: `var(--bw) solid ${st.bd}` }}>{b.psyName.charAt(0).toUpperCase()}</span>
        <button onClick={toggle} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={manage}>
          <span className={`tnum text-[13px] font-extrabold ${past ? "line-through" : ""}`}>{timeF.format(date)}</span>
          <span className="min-w-0 flex-1">
            <span className={`font-tight flex min-w-0 items-center gap-1.5 text-[13px] font-bold ${past ? "line-through" : ""}`}>
              <Icon name="calendar" width={12} weight="bold" color="var(--muted)" />
              <span className="truncate">{cap(dayF.format(date))}</span>
            </span>
            <span className="t-cap block">{b.format === "online" ? "онлайн" : "очно"} · {b.psyName}</span>
          </span>
        </button>
        <Icon name={st.icon} width={13} weight="fill" color={st.ic} />
        <button onClick={toggle} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]" style={manage ? { background: "var(--ink)", color: "#fff" } : { background: "var(--surface-2)" }} aria-label="Управлять записью" aria-expanded={manage}>
          <Icon name="gear" width={15} color={manage ? "#fff" : undefined} />
        </button>
      </div>

      <Disclosure open={manage}>
        <div className="px-3 pb-3">
          {resch ? (
            <div className="card-soft p-2.5">
              <p className="t-micro mb-2">Новое окно</p>
              <SlotPicker psyId={b.psychologistId} variant="calendar" showAvail onPick={(iso) => move.mutate(iso)} />
              <button onClick={() => setResch(false)} className="mt-2 text-[12px] font-semibold text-[var(--muted)]">Отмена</button>
            </div>
          ) : locked ? (
            <div className="rounded-[13px] p-3" style={{ background: "var(--salmon-soft)" }}>
              <p className="text-[13px] font-black" style={{ color: "var(--salmon-edge)" }}>Отменить нельзя</p>
              <p className="t-cap mt-0.5">До сессии меньше {lockDays} дн. Чтобы отменить или перенести — свяжитесь с психологом.</p>
              <button onClick={() => setResch(true)} className="btn btn-white mt-2 px-3 py-1.5 text-[12px]">Перенести</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => setResch(true)} className="btn btn-white px-3 py-1.5 text-[12px]">Перенести</button>
              <button onClick={() => cancel.mutate()} className="ml-auto rounded-full px-3 py-1.5 text-[12px] font-extrabold text-white" style={{ background: "var(--salmon-edge)" }}>Отменить</button>
            </div>
          )}
        </div>
      </Disclosure>
    </motion.div>
  );
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
