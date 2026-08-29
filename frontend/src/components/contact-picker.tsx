"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Disclosure } from "@/components/ui";
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
  const [open, setOpen] = useState(false);
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

  return (
    <div className="card-plain p-3">
      <button onClick={() => { tap(); setOpen((v) => !v); }} className="flex w-full items-center gap-2 text-left" aria-expanded={open}>
        <span className="ico h-8 w-8 shrink-0"><Icon name="telegram" width={15} weight="fill" color="var(--edge)" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-black leading-none">Из контактов Telegram</span>
          <span className="t-cap mt-1.5 block leading-snug">Отметьте людей в списке контактов — карточки заведутся с именем и фото</span>
        </span>
        <span className="shrink-0 text-[13px] font-black text-[var(--muted)]">{open ? "↑" : "↓"}</span>
      </button>

      <Disclosure open={open} autoScroll={false}>
        <div className="mt-2.5">
          <button onClick={() => { tap(); ask.mutate(); }} disabled={ask.isPending} className="btn w-full py-2.5 disabled:opacity-50">
            <Icon name="users" width={15} weight="bold" color="#fff" /> Открыть список контактов
          </button>

          {/* Шаги названы заранее: человек уходит в другое приложение, и без
              этого переход выглядит как «кнопка просто открыла бота». */}
          <ol className="mt-2.5 space-y-1.5">
            {[
              "Откроется чат с ботом — нажмите внизу «Выбрать из контактов»",
              "Telegram покажет ваш список контактов: отметьте до 10 человек",
              "Вернитесь сюда — карточки уже будут в списке",
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-2">
                <span className="mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-black" style={{ background: "var(--alt-soft)", color: "var(--muted)" }}>{i + 1}</span>
                <span className="t-cap leading-snug">{step}</span>
              </li>
            ))}
          </ol>

          <p className="t-cap mt-2.5 leading-snug">Можно и просто переслать боту контакт из Telegram — карточка заведётся так же.</p>

          {waiting && (
            <div className="mt-2.5 flex items-center gap-2.5 rounded-[12px] px-3 py-2.5" style={{ background: "var(--amber-soft)", border: "var(--bw) solid var(--amber-edge)" }}>
              <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "var(--amber-edge)" }} /><span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: "var(--amber-edge)" }} /></span>
              <p className="text-[11.5px] font-black leading-snug">Ждём выбор в Telegram — карточки появятся здесь сами.</p>
            </div>
          )}
          {ask.isError && <p className="mt-2 text-[11.5px] font-bold" style={{ color: "var(--salmon-edge)" }}>Не получилось открыть выбор. Попробуйте ещё раз.</p>}
        </div>
      </Disclosure>
    </div>
  );
}
