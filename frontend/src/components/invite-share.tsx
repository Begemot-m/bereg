"use client";

import { useState, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { success, tap } from "@/lib/haptics";
import { INVITE_TEXT, inviteShareLink } from "@/lib/invite";

/**
 * Две кнопки приглашения — скопировать ссылку и отправить в Telegram. Полей
 * тут нет намеренно: контакт клиента для приглашения не нужен, ссылка сама
 * приводит человека в приложение и связывает его со специалистом.
 */
export function InviteShare({ link, status, onSent }: { link: string; status?: ReactNode; onSent?: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    tap();
    try {
      await navigator.clipboard.writeText(`${INVITE_TEXT} ${link}`);
      success();
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      onSent?.();
    } catch {
      /* буфер недоступен — остаётся кнопка «В Telegram» */
    }
  };

  return (
    <div>
      {status}
      {/* Кнопки низкие и в одну строку: это вспомогательное действие, а не
          главный призыв экрана — длинная подпись «Отправить в Telegram»
          растягивала блок на две строки. */}
      <div className={`flex gap-2 ${status ? "mt-2" : ""}`}>
        <button onClick={() => void copy()} disabled={!link} className="btn btn-white flex-1 py-1.5 text-[11.5px] disabled:opacity-50">
          {copied ? "Скопировано" : "Скопировать"}
        </button>
        <a
          href={link ? inviteShareLink(link) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => { tap(); onSent?.(); }}
          className={`btn btn-accent flex-1 py-1.5 text-[11.5px] ${link ? "" : "pointer-events-none opacity-50"}`}
        >
          <Icon name="telegram" width={12} weight="fill" color="#fff" /> В Telegram
        </a>
      </div>
    </div>
  );
}
