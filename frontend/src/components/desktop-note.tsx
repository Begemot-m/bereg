"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";
import { APP_NAME, BOT_NAME, botDeepLink } from "@/lib/brand";

const STAY_KEY = "bereg_desktop_ok";
const LINK = botDeepLink("desktop");

export function desktopNoteDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STAY_KEY) === "1";
  } catch {
    return false;
  }
}

const STEPS = [
  "Возьмите телефон и откройте в нём Telegram",
  `Найдите чат с ботом @${BOT_NAME}`,
  "Нажмите кнопку «Открыть» — приложение запустится",
];

/**
 * Мини-приложение открыли в Telegram на компьютере. Интерфейс собран под
 * телефон: узкая колонка, нижние табы, жесты. Вместо того чтобы показывать
 * растянутое приложение, зовём человека на телефон — а упрямому оставляем
 * дверь, чтобы не запирать того, кому очень надо.
 */
export function DesktopNote({ onStay }: { onStay: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(LINK);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const stay = () => {
    try {
      localStorage.setItem(STAY_KEY, "1");
    } catch {
      /* приватный режим — просто продолжаем без запоминания */
    }
    onStay();
  };

  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto" style={{ background: "var(--page)" }}>
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 py-10">
        <span className="ico ico-accent h-14 w-14"><Icon name="device" width={26} weight="bold" color="#fff" /></span>
        <h1 className="font-tight mt-3 text-[24px] font-black leading-tight">Пока только с телефона</h1>
        <p className="t-sub mt-1.5">
          {APP_NAME} собрана под мобильный Telegram: расписание, карточки клиентов и заметки рассчитаны
          на телефон. Версия для компьютера в разработке.
        </p>

        <ol className="mt-5 flex flex-col gap-2.5">
          {STEPS.map((text, i) => (
            <li
              key={text}
              className="flex items-start gap-3 rounded-[var(--r-block)] px-3.5 py-3"
              style={{ background: "var(--surface)", border: "var(--bw) solid var(--stroke)" }}
            >
              <span
                className="mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-black"
                style={{ background: "var(--head-soft)" }}
              >
                {i + 1}
              </span>
              <span className="text-[14px] font-medium leading-snug">{text}</span>
            </li>
          ))}
        </ol>

        <button onClick={() => void copy()} className="btn btn-accent mt-5 w-full py-3">
          {copied ? "Ссылка скопирована" : "Скопировать ссылку на бота"}
        </button>
        <p className="t-cap mt-2 text-center opacity-70">{LINK}</p>

        <button onClick={stay} className="mt-5 text-[13px] font-bold underline underline-offset-4" style={{ color: "var(--muted)" }}>
          Всё равно продолжить на компьютере
        </button>
      </div>
    </div>
  );
}
