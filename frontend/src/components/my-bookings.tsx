"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { SlotPicker } from "@/components/slot-picker";
import { Button, Card, Disclosure, SkeletonRow } from "@/components/ui";
import { canCancel, useCancelLockDays } from "@/lib/cancel-policy";
import { listMyBookings, type MyBooking } from "@/lib/clients";
import { tap } from "@/lib/haptics";
import { cancelMyBooking, rescheduleMyBooking } from "@/lib/mybookings";

const EASE = [0.16, 1, 0.3, 1] as const;
const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

// Управление записями клиента: перенести, отменить, записаться заново.
export function MyBookingsManager() {
  const qc = useQueryClient();
  const { data: bookings = [], isLoading } = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings });
  const [booking, setBooking] = useState(false);
  const inv = () => qc.invalidateQueries({ queryKey: ["my-bookings"] });
  const ordered = [...bookings].sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  if (isLoading) return <SkeletonRow />;
  return (
    <div className="space-y-2.5">
      {ordered.length === 0 ? (
        <Card><p className="text-sm text-[var(--muted)]">Записей пока нет.</p><Link href="/catalog" className="mt-3 inline-block"><Button size="sm" arrow>Найти специалиста</Button></Link></Card>
      ) : (
        ordered.map((item) => <MyRow key={item.id} b={item} onChange={inv} />)
      )}

      <button onClick={() => { tap(); setBooking(!booking); }} className="flex w-full items-center justify-center gap-1.5 rounded-[16px] py-3 text-[13px] font-black transition-transform active:scale-[0.99]" style={{ background: "var(--amber)", border: "var(--bw-lg) solid var(--amber-edge)" }} aria-expanded={booking}>
        {booking ? "Свернуть" : "Записаться на сессию"}
      </button>
      <Disclosure open={booking}>
        <div className="rounded-[18px] bg-white p-3" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
          <SlotPicker forClient variant="calendar" showAvail onPick={() => { setBooking(false); inv(); }} />
        </div>
      </Disclosure>
    </div>
  );
}

function MyRow({ b, onChange }: { b: MyBooking; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [reschedule, setReschedule] = useState(false);
  const [lockDays] = useCancelLockDays();
  const d = new Date(b.startsAt);
  const past = d < new Date();
  const locked = !past && !canCancel(b.startsAt, lockDays);

  const move = useMutation({ mutationFn: (iso: string) => rescheduleMyBooking(b.id, iso), onSuccess: () => { setReschedule(false); setOpen(false); onChange(); } });
  const cancel = useMutation({ mutationFn: () => cancelMyBooking(b.id), onSuccess: () => { setOpen(false); onChange(); } });

  return (
    <Card className="!p-0" style={past ? { opacity: 0.68 } : undefined}>
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl stroke" style={{ background: "var(--head-soft)" }}>
          <span className="text-[15px] font-extrabold leading-none">{d.getDate()}</span>
          <span className="text-[9px] font-bold uppercase">{d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "")}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[14px] font-bold ${past ? "line-through" : ""}`}>{b.psyName}</span>
          <span className={`block text-[12px] text-[var(--muted)] ${past ? "line-through" : ""}`}>{timeF.format(d)} · {b.format === "online" ? "онлайн" : "очно"}</span>
          {past && <span className="mt-0.5 block text-[10px] font-extrabold uppercase tracking-wide text-[var(--muted)]">выполнено</span>}
        </span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2, ease: EASE }} className="text-[var(--muted-2)]">›</motion.span>
      </button>
      <Disclosure open={open}>
        <div className="px-4 pb-4">
          {reschedule ? (
            <div className="rounded-2xl p-3 stroke" style={{ background: "#fff" }}>
              <p className="mb-2 text-[13px] font-bold">Новое окно</p>
              <SlotPicker forClient variant="calendar" showAvail onPick={(iso) => move.mutate(iso)} />
              <button onClick={() => setReschedule(false)} className="mt-2 text-[12px] font-semibold text-[var(--muted)]">Отмена</button>
            </div>
          ) : locked ? (
            <div className="rounded-[14px] p-3" style={{ background: "var(--salmon-soft)", border: "var(--bw) solid var(--salmon-edge)" }}>
              <p className="text-[13px] font-black" style={{ color: "var(--salmon-edge)" }}>Отменить нельзя</p>
              <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">До сессии меньше {lockDays} дн. Чтобы отменить или перенести — свяжитесь с психологом.</p>
              <div className="mt-2"><Button size="sm" variant="soft" onClick={() => setReschedule(true)}>Перенести</Button></div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="soft" onClick={() => setReschedule(true)}>Перенести</Button>
              <button onClick={() => cancel.mutate()} className="ml-auto text-[12px] font-semibold text-[var(--muted-2)] hover:text-[var(--warn)]">Отменить запись</button>
            </div>
          )}
        </div>
      </Disclosure>
    </Card>
  );
}
