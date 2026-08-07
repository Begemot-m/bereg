"use client";

import Link from "next/link";

import { Arrow, DailyDot } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { tap } from "@/lib/haptics";
import { useVerification } from "@/lib/psy-verification";

export const VERIFICATION_HREF = "/cabinet/verification";

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

  const view =
    status === "review"
      ? { tone: "amber", icon: "clock" as const, iconColor: "var(--amber-edge)", title: "Заявка на проверке", note: "Проверяем документы вручную — обычно пара дней" }
      : status === "rejected"
        ? { tone: "salmon", icon: "question" as const, iconColor: "var(--salmon-edge)", title: "Верификация: нужны правки", note: verification?.rejectReason ?? "Поправьте данные и отправьте заявку снова" }
        : { tone: "amber", icon: "check" as const, iconColor: "var(--olive-edge)", title: "Пройдите верификацию", note: "Чтобы ваш профиль могли разместить в каталоге специалистов." };

  // В самом профиле блок сжат до строки: заголовок и красный ярлык, без
  // пояснений — человек уже внутри анкеты и знает, зачем всё это.
  if (compact) {
    return (
      <Link
        href={VERIFICATION_HREF}
        onClick={tap}
        className={`flex items-center gap-2.5 rounded-[16px] p-3 transition-transform active:scale-[.99] ${className ?? ""}`}
        style={{ background: "#fff", border: "var(--bw-lg) solid #fff" }}
      >
        <span className="min-w-0 flex-1 text-[13px] font-black leading-tight">Пройдите верификацию, чтобы разместить анкету в каталоге</span>
        <DailyDot size={16} className="shrink-0" label="Верификация не пройдена" />
      </Link>
    );
  }

  return (
    <Link
      href={VERIFICATION_HREF}
      onClick={tap}
      className={`flex items-center gap-3 rounded-[16px] p-3 transition-transform active:scale-[.99] ${className ?? ""}`}
      style={{ background: `var(--${view.tone}-soft)`, border: "var(--bw-lg) solid #fff" }}
    >
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-white stroke">
        <Icon name={view.icon} width={20} weight="bold" color={view.iconColor} />
        {status !== "review" && <DailyDot size={16} className="absolute -right-1.5 -top-1.5" label="Верификация не пройдена" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-black leading-tight">{view.title}</span>
        <span className="mt-0.5 block text-[10.5px] font-semibold leading-snug text-[var(--muted)]">{view.note}</span>
      </span>
      <Arrow />
    </Link>
  );
}
