"use client";

import { useQuery } from "@tanstack/react-query";

import { Icon } from "@/components/icons";
import { ProPaywall } from "@/components/pro-sell";
import { formatMoney } from "@/lib/money";
import { useProfile } from "@/lib/profile";
import { FREE_CLIENT_LIMIT, getSubscription, monthlyPrice, rub } from "@/lib/subscription";

/**
 * Сервер отбил подтверждение записи: бесплатные места заняты, нужна подписка.
 * Ошибка приезжает строкой «API 402: {…}» — тела в ней достаточно, отдельный
 * тип ошибки ради одного места заводить незачем.
 */
export const isNeedsPro = (err: unknown) => String(err instanceof Error ? err.message : err).includes("needs_pro");

/**
 * Предложение PRO прямо на подтверждении записи. Считаем вслух: одна сессия
 * специалиста обычно дороже месяца подписки, и без этой строчки цена выглядит
 * расходом, а не разменом. Цену берём из его же анкеты.
 */
export function ConfirmProPaywall({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useProfile();
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });

  const session = profile?.sessionPrice ?? 0;
  const month = monthlyPrice(sub);

  return (
    <ProPaywall
      open={open}
      onClose={onClose}
      cta="Подключить и подтвердить"
      reason={`Бесплатные места заняты: их ${FREE_CLIENT_LIMIT}. Чтобы подтвердить встречу с новым человеком, нужна подписка.`}
    >
      {session > 0 && (
        <div className="card-soft mb-3 p-3" style={{ background: "var(--surface-2)" }}>
          <p className="t-micro" style={{ color: "var(--muted)" }}>Сравните</p>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="rounded-[12px] bg-white p-2.5 text-center">
              <p className="tnum font-tight text-[17px] font-black leading-none">{formatMoney(session, profile?.currency ?? "RUB")}</p>
              <p className="t-cap mt-1">одна ваша сессия</p>
            </div>
            <span className="text-[13px] font-black text-[var(--muted-2)]">против</span>
            <div className="rounded-[12px] p-2.5 text-center" style={{ background: "var(--purple-soft)" }}>
              <p className="tnum font-tight text-[17px] font-black leading-none" style={{ color: "var(--purple-edge)" }}>{rub(month)}</p>
              <p className="t-cap mt-1">месяц PRO, клиентов без счёта</p>
            </div>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[10.5px] font-semibold leading-snug text-[var(--muted)]">
            <Icon name="check" width={12} weight="bold" color="var(--green-edge)" className="mt-px shrink-0" />
            Комиссии с сессий нет — подписка не зависит от того, сколько вы заработали.
          </p>
        </div>
      )}
      <div className="card-soft mb-3 p-3" style={{ background: "var(--surface-2)" }}>
        <p className="text-[11.5px] font-semibold leading-snug text-[var(--muted)]">
          Запись никуда не пропадёт: окно держится за клиентом, пока вы не ответите. Анкета остаётся в каталоге в любом случае — место в нём бесплатное.
        </p>
      </div>
    </ProPaywall>
  );
}
