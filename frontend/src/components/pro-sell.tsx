"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { tap } from "@/lib/haptics";
import { CATALOG_FREE_DAYS, FREE_CLIENT_LIMIT, getSubscription, monthlyPrice, PLAN_PRICE, rub, startSubscription } from "@/lib/subscription";

// PRO отличается от бесплатного двумя вещами: масштаб и новые клиенты.
// Весь функционал по клиенту (карточка, настроение, домашки, аналитика,
// сводка недели, шаблоны) доступен и бесплатно — на первых трёх.
// Продающий контент PRO — используется в онбординге, кабинете и пейволле.
export function ProSell({ art = "/sell/pro.webp", artTone = "var(--purple)" }: { art?: string; artTone?: string }) {
  void art; void artTone;
  const rows = [
    ["Клиенты", `до ${FREE_CLIENT_LIMIT}`, "без лимита"],
    ["Записи и расписание", "всё", "всё"],
    ["Задания и заметки", "всё", "всё"],
    ["Статистика работы", "всё", "всё"],
    ["Размещение в каталоге специалистов", `${CATALOG_FREE_DAYS} дней`, "постоянно"],
  ];
  return (
    <div>
      <p className="t-micro" style={{ color: "var(--edge)" }}>Хроника PRO</p>
      <h2 className="t-title mt-1">Больше клиентов —<br /><span className="text-[var(--purple-edge)]">без лимитов</span></h2>

      <div className="card-soft mt-3 flex items-start gap-3 p-3.5" style={{ background: "var(--purple-soft)" }}>
        <span className="ico ico-accent h-10 w-10 shrink-0"><Icon name="spark" width={18} weight="fill" /></span>
        <p className="t-sub"><b className="t-head">{FREE_CLIENT_LIMIT} клиента <span className="text-[var(--purple-edge)]">бесплатно</span></b><br />Все функции доступны сразу.</p>
      </div>

      <div className="mt-3 overflow-hidden rounded-[18px] bg-white stroke">
        <div className="grid grid-cols-[minmax(0,1fr)_68px_76px] bg-[var(--purple-soft)] px-3 py-2 text-[10px] font-black"><span>Возможности</span><span className="text-center">Бесплатно</span><span className="text-center text-[var(--purple-edge)]">PRO</span></div>
        {rows.map(([label, free, pro]) => <div key={label} className="line-top grid grid-cols-[minmax(0,1fr)_68px_76px] items-center px-3 py-2.5 text-[10.5px] font-bold"><span>{label}</span><span className="text-center text-[var(--muted)]">{free}</span><span className="text-center font-black text-[var(--purple-edge)]">{pro}</span></div>)}
      </div>
    </div>
  );
}

// Кнопка запуска PRO (чёрная) + цена. Триал уже активен в демо — оплата подтверждается через ЮKassa.
export function ProCta({ label = "Подключить PRO", note = true }: { label?: string; note?: boolean }) {
  const qc = useQueryClient();
  // Цену берём из подписки: у того, кому отказали в каталоге, она ниже, и
  // кнопка не должна обещать одну сумму, а касса выставлять другую.
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  const subscribe = useMutation({
    mutationFn: () => startSubscription("pro"),
    onSuccess: (r) => { if (r.confirmation_url) window.location.href = r.confirmation_url; else qc.invalidateQueries({ queryKey: ["subscription"] }); },
  });
  return (
    <div>
      <button onClick={() => { tap(); subscribe.mutate(); }} disabled={subscribe.isPending} className="btn w-full py-3.5 text-[14px]">
        {subscribe.isPending ? "Готовим оплату…" : `${label} · ${rub(monthlyPrice(sub))}/мес`}
      </button>
      {note && <p className="mt-2 text-center text-[10.5px] font-semibold text-[var(--muted)]">Отмена в любой момент · комиссии за запись нет</p>}
    </div>
  );
}

// Пейволл: всплывает, когда упёрлись в лимит бесплатного (4-й клиент, каталог, сводка…).
export function ProPaywall({ open, onClose, reason, cta = "Подключить PRO", children }: { open: boolean; onClose: () => void; reason?: string; cta?: string; children?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[85] flex items-end justify-center @md:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 bg-[rgba(32,28,24,.5)]" onClick={onClose} aria-label="Закрыть" />
          <motion.section role="dialog" aria-modal="true" initial={{ y: 28, opacity: 0.7 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-[var(--surface)] @md:rounded-[28px]">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <span className="chip chip-strong">Хроника PRO</span>
              <button onClick={onClose} className="ico h-8 w-8 keep-style" style={{ background: "var(--surface-2)" }} aria-label="Закрыть"><span className="text-[15px] font-black">×</span></button>
            </div>
            <div className="overflow-y-auto px-4 pb-2">
              {reason && <div className="card-soft mb-3 flex items-center gap-2.5 p-3" style={{ background: "var(--amber-soft)" }}><Icon name="spark" width={16} weight="fill" /> <p className="t-sub">{reason}</p></div>}
              {children}
              <ProSell />
            </div>
            <div className="border-t bg-[var(--surface)] p-4" style={{ borderColor: "var(--edge-neutral)" }}>
              <ProCta label={cta} />
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
