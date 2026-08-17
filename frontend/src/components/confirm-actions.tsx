"use client";

import { Icon } from "@/components/icons";
import { tap } from "@/lib/haptics";

/**
 * Ответ на самозапись клиента: подтвердить или отклонить. Один вид на всю
 * платформу — на главной, в «Сессиях», в неделе и в карточке клиента.
 */
export function ConfirmActions({
  onConfirm,
  onDecline,
  confirming,
  declining,
}: {
  onConfirm: () => void;
  onDecline: () => void;
  confirming?: boolean;
  declining?: boolean;
}) {
  const busy = Boolean(confirming || declining);
  return (
    <div className="flex gap-2">
      <button
        onClick={() => { tap(); onConfirm(); }}
        disabled={busy}
        className="btn flex-1 px-3 py-1.5 text-[12px]"
        style={{ background: "var(--green-edge)", borderColor: "var(--green-edge)" }}
      >
        <Icon name="check" width={13} weight="bold" color="#fff" />
        {confirming ? "Минуту…" : "Подтвердить"}
      </button>
      <button
        onClick={() => { tap(); onDecline(); }}
        disabled={busy}
        className="btn flex-1 px-3 py-1.5 text-[12px]"
        style={{ background: "var(--coral-edge)", borderColor: "var(--coral-edge)" }}
      >
        <Icon name="close" width={13} weight="bold" color="#fff" />
        {declining ? "Минуту…" : "Отклонить"}
      </button>
    </div>
  );
}
