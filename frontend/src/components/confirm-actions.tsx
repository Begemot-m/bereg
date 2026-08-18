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
    // Обе кнопки в одну строку и поровну на всю ширину блока: раньше они
    // жались влево и на узком экране переносились одна под другую.
    <div className="grid grid-cols-2 gap-1.5">
      <button
        onClick={() => { tap(); onConfirm(); }}
        disabled={busy}
        className="btn w-full gap-1 px-2 py-1 text-[11px] leading-none"
        style={{ background: "var(--green-edge)", borderColor: "var(--green-edge)" }}
      >
        <Icon name="check" width={11} weight="bold" color="#fff" />
        {confirming ? "Минуту…" : "Подтвердить"}
      </button>
      <button
        onClick={() => { tap(); onDecline(); }}
        disabled={busy}
        className="btn w-full gap-1 px-2 py-1 text-[11px] leading-none"
        style={{ background: "var(--coral-edge)", borderColor: "var(--coral-edge)" }}
      >
        <Icon name="close" width={11} weight="bold" color="#fff" />
        {declining ? "Минуту…" : "Отклонить"}
      </button>
    </div>
  );
}
