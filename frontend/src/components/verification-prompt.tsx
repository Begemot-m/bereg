"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DailyDot } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { tap } from "@/lib/haptics";
import { CATALOG_DECLINE_TEXT, PRO_DISCOUNT_PRICE_RUB, PRO_PRICE_RUB } from "@/lib/pricing";
import { useVerification } from "@/lib/psy-verification";
import { rub } from "@/lib/subscription";

export const VERIFICATION_HREF = "/cabinet/verification";

// Окно с отказом закрывается насовсем: перечитать решение можно на странице
// верификации, а висеть в кабинете вечно ему незачем.
const DECLINE_HIDDEN_KEY = "bereg_catalog_decline_hidden";

export function CatalogDeclineNote({ reason, className }: { reason?: string | null; className?: string }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => { setHidden(localStorage.getItem(DECLINE_HIDDEN_KEY) === "1"); }, []);
  if (hidden) return null;
  const close = () => { tap(); localStorage.setItem(DECLINE_HIDDEN_KEY, "1"); setHidden(true); };

  return (
    <section className={`rounded-[16px] p-4 ${className ?? ""}`} style={{ background: "var(--amber-soft)" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span className="ico h-9 w-9 shrink-0" style={{ background: "#fff" }}><Icon name="seal" width={17} weight="bold" color="var(--amber-edge)" /></span>
          <p className="text-[14px] font-black leading-tight">Каталог: решение модерации</p>
        </div>
        <button onClick={close} aria-label="Закрыть сообщение" className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/70 transition-transform active:scale-90">
          <Icon name="close" width={13} weight="bold" color="var(--ink)" />
        </button>
      </div>
      <p className="mt-2.5 text-[12.5px] font-semibold leading-relaxed">{reason?.trim() || CATALOG_DECLINE_TEXT}</p>
      <p className="mt-2 text-[12px] font-bold leading-snug">
        Подписка для вас дешевле — {rub(PRO_DISCOUNT_PRICE_RUB)} в месяц вместо {rub(PRO_PRICE_RUB)}.
      </p>
    </section>
  );
}

/**
 * Приглашение пройти верификацию. Стоит выше заполнения анкеты — и в кабинете,
 * и в самом редакторе профиля: без проверки анкета всё равно никуда не попадёт,
 * поэтому требование человек видит раньше, чем начнёт её заполнять.
 * Восклицательный знак — тот же ярлык, что у настроения дня.
 */
export function VerificationPrompt({ className, compact }: { className?: string; compact?: boolean }) {
  const { data: verification } = useVerification();
  const status = verification?.status ?? "none";
  if (status === "approved") return null;
  // Отказ по каталогу — не задача «пройти верификацию», а сообщение, которое
  // человек прочитал и закрыл. Ссылку на заявку тут показывать незачем.
  if (status === "declined") return <CatalogDeclineNote reason={verification?.rejectReason} className={className} />;

  const view =
    status === "review"
      ? { icon: "clock" as const, iconColor: "var(--amber-edge)", title: "Заявка на проверке", note: "Проверяем документы вручную — обычно пара дней" }
      : status === "rejected"
        ? { icon: "question" as const, iconColor: "var(--salmon-edge)", title: "Верификация: нужны правки", note: verification?.rejectReason ?? "Поправьте данные и отправьте заявку снова" }
        : { icon: "seal" as const, iconColor: "var(--green)", title: "Пройдите верификацию", note: "Чтобы ваш профиль могли разместить в каталоге специалистов." };

  // В самом профиле блок сжат до строки: заголовок и красный ярлык, без
  // пояснений — человек уже внутри анкеты и знает, зачем всё это.
  if (compact) {
    return (
      <Link
        href={VERIFICATION_HREF}
        onClick={tap}
        className={`flex items-center gap-2.5 rounded-[16px] bg-white p-3 transition-transform active:scale-[.99] ${className ?? ""}`}
      >
        <DailyDot size={17} className="shrink-0" label="Верификация не пройдена" />
        <span className="min-w-0 flex-1 text-[13px] font-black leading-tight">Пройдите верификацию, чтобы разместить анкету в каталоге</span>
      </Link>
    );
  }

  return (
    <Link
      href={VERIFICATION_HREF}
      onClick={tap}
      className={`flex items-center gap-3 rounded-[16px] bg-white p-3 transition-transform active:scale-[.99] ${className ?? ""}`}
    >
      <span className="relative flex shrink-0 items-center justify-center">
        <Icon name={view.icon} width={38} weight="fill" color={view.iconColor} />
        {status !== "review" && <DailyDot size={15} className="absolute -right-1 -top-1" label="Верификация не пройдена" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-black leading-tight">{view.title}</span>
        <span className="mt-0.5 block text-[10.5px] font-semibold leading-snug text-[var(--muted)]">{view.note}</span>
      </span>
    </Link>
  );
}
