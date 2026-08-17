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
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => { tap(); onConfirm(); }}
        disabled={busy}
        className="btn gap-1 px-2.5 py-1 text-[11.5px] leading-none"
        style={{ background: "var(--green-edge)", borderColor: "var(--green-edge)" }}
      >
        <Icon name="check" width={12} weight="bold" color="#fff" />
        {confirming ? "Минуту…" : "Подтвердить"}
      </button>
      <button
        onClick={() => { tap(); onDecline(); }}
        disabled={busy}
        className="btn gap-1 px-2.5 py-1 text-[11.5px] leading-none"
        style={{ background: "var(--coral-edge)", borderColor: "var(--coral-edge)" }}
      >
        <Icon name="close" width={12} weight="bold" color="#fff" />
        {declining ? "Минуту…" : "Отклонить"}
      </button>
    </div>
  );
}
