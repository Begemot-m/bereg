"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

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
 * Своего списка контактов тут нет и быть не может: Telegram не отдаёт контакты
 * мини-приложениям — ни методом, ни обходом. Нативный список с поиском и
 * отметками умеет открывать только сам Telegram, по кнопке в чате бота
 * (`request_users`). Поэтому кнопка кладёт эту кнопку в чат и открывает его, а
 * приложение ждёт возвращения и подтягивает заведённые карточки само.
 */
export function ContactPicker() {
  const qc = useQueryClient();
  const [waiting, setWaiting] = useState(false);

  const ask = useMutation({
    mutationFn: requestContactPick,
    onSuccess: () => { success(); setWaiting(true); openTelegramLink(`https://t.me/${BOT_NAME}`); },
  });

  // Выбор идёт в Telegram, ответ приходит боту — приложение об этом не узнает,
  // пока не спросит. Пока ждём, тихо перечитываем список: вернулся из чата —
  // карточки уже на месте, обновлять руками ничего не нужно.
  useEffect(() => {
    if (!waiting) return;
    const tick = setInterval(() => qc.invalidateQueries({ queryKey: ["clients"] }), 3000);
    const stop = setTimeout(() => setWaiting(false), 120_000);
    return () => { clearInterval(tick); clearTimeout(stop); };
  }, [waiting, qc]);

  // Раскрывать тут нечего: тап по строке сразу зовёт выбор контактов.
  return (
    <div className="card-plain p-3">
      <button onClick={() => { tap(); ask.mutate(); }} disabled={ask.isPending} className="flex w-full items-center gap-2 text-left disabled:opacity-50">
        <span className="ico h-8 w-8 shrink-0"><Icon name="telegram" width={15} weight="fill" color="var(--edge)" /></span>
        <span className="min-w-0 flex-1 text-[13px] font-black leading-none">Из контактов Telegram</span>
        <span className="shrink-0 text-[13px] font-black text-[var(--muted)]">→</span>
      </button>

      {waiting && (
        <div className="mt-2.5 flex items-center gap-2.5 rounded-[12px] px-3 py-2.5" style={{ background: "var(--amber-soft)", border: "var(--bw) solid var(--amber-edge)" }}>
          <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "var(--amber-edge)" }} /><span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: "var(--amber-edge)" }} /></span>
          <p className="text-[11.5px] font-black leading-snug">Ждём выбор в Telegram</p>
        </div>
      )}
      {ask.isError && <p className="mt-2 text-[11.5px] font-bold" style={{ color: "var(--salmon-edge)" }}>Не получилось открыть выбор. Попробуйте ещё раз.</p>}
    </div>
  );
}
