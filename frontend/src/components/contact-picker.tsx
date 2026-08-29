"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { BOT_NAME } from "@/lib/brand";
import { requestContactPick } from "@/lib/clients";
import { DEMO } from "@/lib/demo";
import { success } from "@/lib/haptics";
import { openTelegramLink } from "@/lib/telegram";

/**
 * Пакетное добавление клиентов из контактов Telegram — плюсик в «Клиентах».
 *
 * Своего списка контактов у приложения нет и быть не может: Telegram не отдаёт
 * контакты мини-приложениям — ни методом, ни обходом. Нативный список умеет
 * открывать только сам Telegram, по кнопке `request_users` в чате бота. Поэтому
 * `start()` кладёт эту кнопку в чат и открывает его, а приложение ждёт
 * возвращения и подтягивает заведённые карточки само.
 *
 * Карточки заводятся без всякой синхронизации: специалисту нужны лицо, имя и
 * ник, чтобы вести записи и написать в один тап. Приглашение подключить свой
 * профиль живёт в самой карточке, отдельным решением.
 */
export function useContactPick() {
  const qc = useQueryClient();
  const [waiting, setWaiting] = useState(false);

  const ask = useMutation({
    mutationFn: requestContactPick,
    // В демо чата с ботом нет — уводить человека на t.me незачем: мок заводит
    // пару карточек сам, чтобы был виден результат выбора.
    onSuccess: () => { success(); setWaiting(true); if (!DEMO) openTelegramLink(`https://t.me/${BOT_NAME}`); },
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

  return { start: () => ask.mutate(), waiting, failed: ask.isError };
}

export function ContactPickNote({ waiting, failed }: { waiting: boolean; failed: boolean }) {
  if (!waiting && !failed) return null;
  return waiting ? (
    <div className="mb-3 flex items-center gap-2.5 rounded-[12px] px-3 py-2.5" style={{ background: "var(--amber-soft)", border: "var(--bw) solid var(--amber-edge)" }}>
      <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "var(--amber-edge)" }} /><span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: "var(--amber-edge)" }} /></span>
      <p className="text-[11.5px] font-black leading-snug">Ждём выбор в Telegram</p>
    </div>
  ) : (
    <p className="mb-3 text-[11.5px] font-bold" style={{ color: "var(--salmon-edge)" }}>Не получилось открыть выбор контактов. Попробуйте ещё раз.</p>
  );
}
