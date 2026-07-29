"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { asset } from "@/lib/asset";
import { tap } from "@/lib/haptics";
import { FREE_CLIENT_LIMIT, PLAN_PRICE, rub, startSubscription } from "@/lib/subscription";

export const PRO_PERKS: { icon: IconName; title: string; text: string }[] = [
  { icon: "users", title: "Клиенты без лимита", text: "Ведите всю практику, а не первых троих." },
  { icon: "spark", title: "Сводка недели к сессии", text: "Настроение, домашки и тревоги клиента — за 10 секунд перед встречей." },
  { icon: "chart", title: "Аналитика и динамика", text: "Прогресс клиента виден от встречи к встрече — есть что показать." },
  { icon: "note", title: "Шаблоны домашек и техник", text: "Отправляйте задания в один тап, не печатая заново." },
  { icon: "compass", title: "Каталог новых клиентов", text: "Честная выдача — место и рейтинг не купить. Комиссии за запись нет." },
];

// Графический слот: положи файл в public/sell/<name>.webp — подхватится.
// Пока файла нет — мягкая заглушка (её не стыдно показать, но она под замену).
function SellArt({ src, tone = "var(--purple)" }: { src: string; tone?: string }) {
  const [broken, setBroken] = useState(false);
  if (!broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset(src)} alt="" onError={() => setBroken(true)} className="mx-auto max-h-[220px] w-full rounded-[18px] object-cover" />;
  }
  return (
    <div className="relative flex h-[150px] w-full items-center justify-center overflow-hidden rounded-[18px]" style={{ background: tone }}>
      <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/25" />
      <span aria-hidden className="pointer-events-none absolute -bottom-12 left-6 h-28 w-28 rounded-full bg-black/10" />
      <span className="ico h-14 w-14 keep-style" style={{ background: "#fff" }}><Icon name="spark" width={26} weight="fill" /></span>
      <span className="absolute bottom-2.5 right-3 text-[9px] font-black uppercase tracking-[.1em] text-white/70">графика · слот</span>
    </div>
  );
}

// Продающий контент PRO — используется в онбординге, кабинете и пейволле.
export function ProSell({ art = "/sell/pro.webp", artTone = "var(--purple)" }: { art?: string; artTone?: string }) {
  return (
    <div>
      <p className="t-micro" style={{ color: "var(--edge)" }}>Методика PRO</p>
      <h2 className="t-title mt-1">Ведите практику,<br />а не таблицы</h2>

      <div className="mt-3"><SellArt src={art} tone={artTone} /></div>

      <div className="card-soft mt-3 flex items-center gap-3 p-3.5">
        <span className="ico ico-accent h-10 w-10"><Icon name="check" width={18} weight="bold" /></span>
        <p className="t-sub"><b className="t-head">{FREE_CLIENT_LIMIT} клиента — бесплатно.</b> Попробуйте на реальной практике, без карты. Дальше — PRO.</p>
      </div>

      <ul className="mt-3 space-y-2.5">
        {PRO_PERKS.map((p) => (
          <li key={p.title} className="flex items-start gap-3">
            <span className="ico h-9 w-9 shrink-0"><Icon name={p.icon} width={17} weight="bold" /></span>
            <span className="min-w-0"><span className="t-head block">{p.title}</span><span className="t-sub block">{p.text}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Кнопка запуска PRO (чёрная) + цена. Триал уже активен в демо — оплата подтверждается через ЮKassa.
export function ProCta({ label = "Подключить PRO", note = true }: { label?: string; note?: boolean }) {
  const qc = useQueryClient();
  const subscribe = useMutation({
    mutationFn: () => startSubscription("tools"),
    onSuccess: (r) => { if (r.confirmation_url) window.location.href = r.confirmation_url; else qc.invalidateQueries({ queryKey: ["subscription"] }); },
  });
  return (
    <div>
      <button onClick={() => { tap(); subscribe.mutate(); }} disabled={subscribe.isPending} className="btn w-full py-3.5 text-[14px]">
        {subscribe.isPending ? "Готовим оплату…" : `${label} · ${rub(PLAN_PRICE.tools)}/мес`}
      </button>
      {note && <p className="mt-2 text-center text-[10.5px] font-semibold text-[var(--muted)]">14 дней бесплатно · отмена в любой момент · комиссии за запись нет</p>}
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
              <span className="chip chip-strong">Методика PRO</span>
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
