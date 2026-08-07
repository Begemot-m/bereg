"use client";

import { Icon } from "@/components/icons";
import { Arrow } from "@/components/blocks";
import { tap } from "@/lib/haptics";

const TG_PHONE = "+79117230099";
const TG_LINK = `https://t.me/${TG_PHONE}`;

// Постер-блок отдела заботы: сплошная заливка в тонах приложения, живые детали,
// переход на сайт центра и связь в Telegram.
export function CareModule() {
  return (
    <div className="relative overflow-hidden rounded-[20px] p-5" style={{ background: "var(--purple)" }}>
      <div className="relative">
        <div className="flex items-center gap-2.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]" style={{ background: "var(--ink)" }}><Icon name="question" width={22} weight="fill" color="#fff" /></span>
          <p className="font-tight text-[19px] font-black leading-tight">У вас есть вопросы?</p>
        </div>

        <p className="mt-3 text-[13px] font-bold leading-snug">Мы стараемся улучшить платформу и сделать её удобной для всех. Если у вас есть вопросы, можете обратиться напрямую к нам. Мы ответим как можно скорее.</p>

        {/* Связь в Telegram — с настоящим значком Telegram */}
        <a href={TG_LINK} target="_blank" rel="noopener noreferrer" onClick={() => tap()} className="card-nested mt-4 flex items-center gap-3 p-3 transition-transform active:scale-[0.99]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]" style={{ background: "var(--purple-soft)" }}><Icon name="telegram" width={22} weight="fill" color="var(--purple-edge)" /></span>
          <span className="min-w-0 flex-1 text-[13px] font-black leading-tight">Написать нам в Telegram</span>
          <Arrow />
        </a>
      </div>
    </div>
  );
}
