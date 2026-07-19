"use client";

import { Icon } from "@/components/icons";
import { tap } from "@/lib/haptics";

const TG_PHONE = "+79117230099";
const TG_LINK = `https://t.me/${TG_PHONE}`;
const PHONE_PRETTY = "+7 911 723-00-99";

// Отдел заботы — просто быстрый переход в Telegram, оформлено бенто-карточкой.
export function CareModule() {
  return (
    <div className="overflow-hidden rounded-[22px]" style={{ border: "var(--bw-lg) solid var(--edge)" }}>
      <div className="flex items-center gap-3 p-4" style={{ background: "var(--head-soft)" }}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-white" style={{ border: "var(--bw) solid var(--edge)" }}><Icon name="spark" width={22} weight="fill" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-black leading-tight">Мы на связи в Telegram</p>
          <p className="mt-0.5 text-[12px] font-semibold text-[var(--muted)]">Вопрос, идея или сложность — ответим живо · {PHONE_PRETTY}</p>
        </div>
      </div>
      <div className="bg-[var(--surface)] p-3">
        <a href={TG_LINK} target="_blank" rel="noopener noreferrer" onClick={() => tap()} className="flex w-full items-center justify-center gap-2 rounded-[15px] bg-[var(--ink)] py-3.5 text-[15px] font-black text-white transition-transform active:scale-[0.98]">
          <Icon name="spark" width={17} weight="fill" /> Написать в Telegram
        </a>
      </div>
    </div>
  );
}
