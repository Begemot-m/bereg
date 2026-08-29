"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { ArrowGlyph } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { BOT_NAME } from "@/lib/brand";
import { requestContactPick } from "@/lib/clients";
import { success, tap } from "@/lib/haptics";
import { openTelegramLink } from "@/lib/telegram";

/**
 * Добавление клиента из контактов Telegram.
 *
 * Карточка заводится без всякой синхронизации: специалисту нужны лицо, имя и
 * ник для быстрого сообщения, а подключать свой профиль клиент будет только
 * если сам захочет — приглашение живёт в карточке.
 *
 * Список контактов приложению Telegram не отдаёт, такого API нет. Нативный
 * выбор человека возможен один — кнопка в чате бота, поэтому тап уводит туда:
 * дальше человека выбирают в самом Telegram, как при отправке сообщения.
 */
export function ContactPicker() {
  const [sent, setSent] = useState(false);
  const ask = useMutation({
    mutationFn: requestContactPick,
    onSuccess: () => { success(); setSent(true); openTelegramLink(`https://t.me/${BOT_NAME}`); },
  });

  return (
    <div className="card-plain p-3">
      <button onClick={() => { tap(); ask.mutate(); }} disabled={ask.isPending} className="flex w-full items-center gap-2 text-left">
        <span className="ico h-8 w-8 shrink-0"><Icon name="telegram" width={15} weight="fill" color="var(--edge)" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-black leading-none">Из контактов Telegram</span>
          <span className="t-cap mt-1.5 block leading-snug">Выберите человека в Telegram — карточка заведётся с именем и фото</span>
        </span>
        <ArrowGlyph size={14} className="shrink-0" />
      </button>
      {sent && <p className="t-cap mt-2 leading-snug">Выбор открыт в чате с ботом: отметьте людей — карточки появятся здесь.</p>}
      {ask.isError && <p className="mt-2 text-[11.5px] font-bold" style={{ color: "var(--salmon-edge)" }}>Не получилось открыть выбор. Попробуйте ещё раз.</p>}
    </div>
  );
}
