"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { tap } from "@/lib/haptics";
import { getNotifications, markNotificationsRead } from "@/lib/notifications";
import { useRole } from "@/lib/role";

const KIND_ICON: Record<string, "swap" | "gear" | "spark"> = { cancel: "gear", reschedule: "swap", system: "spark" };
const rel = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
};

export function NotificationBell() {
  const [role] = useRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: list = [] } = useQuery({ queryKey: ["notifications", role], queryFn: () => getNotifications(role) });
  const markRead = useMutation({ mutationFn: () => markNotificationsRead(role), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
  const unread = list.filter((n) => !n.read).length;

  const openPanel = () => { tap(); setOpen(true); if (unread) markRead.mutate(); };

  return (
    <>
      <button onClick={openPanel} className="relative flex h-9 w-9 items-center justify-center rounded-full stroke" style={{ background: "var(--head-soft)" }} aria-label="Уведомления">
        <Icon name="bell" width={18} weight={unread ? "fill" : "regular"} />
        {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--coral)] px-1 text-[9px] font-black text-white" style={{ border: "var(--bw) solid var(--coral-edge)" }}>{unread > 9 ? "9+" : unread}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-[rgba(32,28,24,.28)]" onClick={() => setOpen(false)}>
            {/* Выпадающая панель от колокольчика — прижата к правому верху под шапкой */}
            <motion.div initial={{ opacity: 0, y: -10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={{ type: "spring", stiffness: 460, damping: 34 }} onClick={(e) => e.stopPropagation()} className="chunk absolute right-3 top-[calc(env(safe-area-inset-top)+58px)] max-h-[70dvh] w-[min(360px,calc(100vw-24px))] origin-top-right overflow-y-auto p-4 @md:right-6 @md:top-20" style={{ background: "var(--surface)" }}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-tight text-[18px] font-black">Уведомления</h3>
                <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full stroke text-[15px] font-bold" style={{ background: "#fff" }}>✕</button>
              </div>
              {list.length === 0 ? (
                <p className="py-8 text-center text-[13px] font-semibold text-[var(--muted-2)]">Пока пусто. Здесь появятся изменения по сессиям.</p>
              ) : (
                <div className="space-y-2">
                  {list.map((n) => (
                    <div key={n.id} className="flex items-start gap-2.5 rounded-[15px] p-3" style={{ background: n.read ? "#fff" : "var(--head-soft)", border: `var(--bw) solid ${n.read ? "var(--edge-neutral)" : "var(--edge)"}` }}>
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white stroke"><Icon name={KIND_ICON[n.kind] ?? "bell"} width={15} weight="bold" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold leading-snug">{n.text}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted-2)]">{rel(n.createdAt)}</p>
                      </div>
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--coral)]" />}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
