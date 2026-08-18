"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/icons";
import type { MyBooking } from "@/lib/clients";
import { success, tap } from "@/lib/haptics";
import { zoneFormat } from "@/lib/zone";

/**
 * Ответ на подтверждение записи — окно с зелёной печатью. Один вид для обеих
 * сторон: специалист видит его сразу после нажатия «Подтвердить», клиент —
 * когда заходит и обнаруживает, что его встречу приняли.
 */
export function ConfirmDone({ open, when, note, onClose }: { open: boolean; when?: string; note?: string; onClose: () => void }) {
  if (typeof document === "undefined") return null;

  // Окно рисуем в body: внутри страницы оно лежит в слое `.sheet` (z-0), и
  // поверх затемнения оставался фокус-блок главной — «ближайшая сессия»
  // светилась сквозь окно, как будто её подсветили нарочно.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => { tap(); onClose(); }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: "rgba(32,28,24,.42)", backdropFilter: "blur(2px)" }}
        >
          <motion.div
            initial={{ y: 18, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 18, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="chunk w-full max-w-md p-5 text-center"
            style={{ background: "var(--surface)" }}
          >
            <motion.span
              initial={{ scale: 0.6 }}
              animate={{ scale: [0.6, 1.12, 1] }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "var(--green-soft)" }}
            >
              <Icon name="check" width={30} weight="bold" color="var(--green-edge)" />
            </motion.span>

            <p className="font-tight mt-3 text-[19px] font-black leading-tight">Запись успешно подтверждена</p>
            {when && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-black" style={{ color: "var(--green-edge)" }}>
                <Icon name="clock" width={14} weight="bold" color="var(--green-edge)" />
                {when}
              </p>
            )}
            {note && <p className="t-sub mt-2">{note}</p>}

            <button onClick={() => { tap(); onClose(); }} className="btn mt-4 w-full py-3">Понятно</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// Записи клиента, которые на его глазах ждали ответа. Окно показывается только
// тем, кто был в этом списке: встречу, назначенную самим специалистом, сервер
// отдаёт подтверждённой сразу, и «успешно подтверждена» для неё — вранье.
const WAIT_KEY = "bereg_confirm_waiting";
const whenF = zoneFormat({ weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function readWaiting(): number[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(WAIT_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((v): v is number => typeof v === "number") : [];
  } catch {
    return [];
  }
}

/**
 * Сторона клиента: специалист ответил «да», и человек узнаёт об этом окном, а
 * не исчезнувшей плашкой «ждёт подтверждения». Показывается один раз на запись.
 */
export function ClientConfirmWatch({ bookings }: { bookings: MyBooking[] }) {
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    const waiting = readWaiting();
    const stillWaiting = bookings.filter((b) => b.confirmed === false).map((b) => b.id);
    const answered = bookings.find((b) => b.confirmed === true && waiting.includes(b.id));

    const next = answered ? stillWaiting : [...new Set([...waiting, ...stillWaiting])];
    if (next.length !== waiting.length || next.some((id, i) => id !== waiting[i])) {
      localStorage.setItem(WAIT_KEY, JSON.stringify(next.slice(-50)));
    }
    if (!answered) return;
    success();
    const label = whenF.format(new Date(answered.startsAt));
    setShown(label.charAt(0).toUpperCase() + label.slice(1));
  }, [bookings]);

  return (
    <ConfirmDone
      open={shown !== null}
      when={shown ?? undefined}
      note="Специалист принял вашу запись — встреча в силе."
      onClose={() => setShown(null)}
    />
  );
}
