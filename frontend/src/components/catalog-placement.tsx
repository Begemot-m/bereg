"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { catalogProfileGaps } from "@/lib/catalog";
import { tap } from "@/lib/haptics";
import { useProfile } from "@/lib/profile";
import { useVerification } from "@/lib/psy-verification";
import { FREE_CLIENT_LIMIT, getSubscription, TRIAL_DAYS, trialWindowLeft } from "@/lib/subscription";

const dayWord = (n: number) => {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return "дней";
  const last = n % 10;
  if (last === 1) return "день";
  if (last >= 2 && last <= 4) return "дня";
  return "дней";
};

/**
 * Где сейчас анкета: в каталоге или нет — и почему. Условий два: проверка
 * пройдена и анкета собрана целиком. Место в каталоге не продаётся, поэтому
 * подписка тут ни при чём — она только упоминается там, где идут пробные дни.
 */
const HIDDEN_KEY = "bereg_catalog_placement_hidden";

export function CatalogPlacement({ className }: { className?: string }) {
  const [hidden, setHidden] = useState<string | null>(null);
  useEffect(() => { setHidden(localStorage.getItem(HIDDEN_KEY)); }, []);
  const profile = useProfile();
  const { data: verification } = useVerification();
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });

  const status = verification?.status ?? "none";
  const gaps = catalogProfileGaps(profile);
  const daysLeft = sub ? trialWindowLeft(sub) : 0;

  let tone = "var(--purple-edge)";
  let title: string;
  let note: string;
  let icon: "seal" | "clock" | "compass" | "spark" = "compass";
  // Что именно сейчас показано — по этому ключу помним, что человек закрыл
  // блок. Состояние сменилось (например, анкету одобрили) — покажем снова.
  const state = status !== "approved" ? status : gaps.length ? "gaps" : sub?.pro && sub.status === "active" ? "pro" : daysLeft > 0 ? "trial" : "after-trial";

  if (status === "declined") {
    // Отказ окончательный — обещать «после верификации» тут было бы враньём.
    icon = "seal";
    tone = "var(--amber-edge)";
    title = "Каталог недоступен";
    note = "Модерация отказала в размещении, но профиль и анкету видят ваши клиенты. Подписка для вас дешевле.";
  } else if (status !== "approved") {
    icon = status === "review" ? "clock" : "seal";
    tone = status === "review" ? "var(--amber-edge)" : "var(--muted)";
    title = status === "review" ? "Анкета на проверке" : "Анкеты в каталоге пока нет";
    note =
      status === "review"
        ? `После подтверждения карточка встаёт в каталог — бесплатно и насовсем. Заодно включатся ${TRIAL_DAYS} ${dayWord(TRIAL_DAYS)} PRO.`
        : `Каталог открывается после верификации: место в нём бесплатное. В день одобрения включаются ${TRIAL_DAYS} ${dayWord(TRIAL_DAYS)} PRO.`;
  } else if (gaps.length) {
    icon = "seal";
    tone = "var(--salmon-edge)";
    title = "Проверка пройдена, карточка не собрана";
    note = `Не хватает: ${gaps.join(", ")}. Пока анкета неполная, в каталог она не попадает.`;
  } else if (sub?.pro && sub.status === "active") {
    icon = "spark";
    tone = "var(--green-edge)";
    title = "Анкета в каталоге";
    note = "Место бесплатное и остаётся за вами всегда. Выше в выдаче — те, кто чаще заходит: место не продаётся.";
  } else if (daysLeft > 0) {
    icon = "compass";
    tone = "var(--purple-edge)";
    title = "Анкета в каталоге";
    note = `Место в каталоге бесплатное — карточка не снимается. Пробный PRO без лимита клиентов — ещё ${daysLeft} ${dayWord(daysLeft)}.`;
  } else {
    icon = "compass";
    tone = "var(--purple-edge)";
    title = "Анкета в каталоге";
    note = `Карточка стоит в выдаче бесплатно. Пробные дни вышли: подтверждать записи можно, пока клиентов не больше ${FREE_CLIENT_LIMIT}, дальше нужен PRO.`;
  }

  const close = () => { tap(); localStorage.setItem(HIDDEN_KEY, state); setHidden(state); };
  if (hidden === state) return null;

  return (
    <div className={`card-soft flex items-start gap-3 p-4 ${className ?? ""}`} style={{ background: "var(--surface)", border: `var(--bw) solid ${tone}` }}>
      <span className="ico ico-white h-11 w-11 shrink-0"><Icon name={icon} width={21} weight="bold" color={tone} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="t-micro" style={{ color: tone }}>Каталог специалистов</p>
          <button onClick={close} aria-label="Скрыть блок" className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white transition-transform active:scale-90">
            <Icon name="close" width={13} weight="bold" color="var(--ink)" />
          </button>
        </div>
        <p className="t-body mt-1 font-black">{title}</p>
        <p className="mt-1 text-[11.5px] font-semibold leading-snug text-[var(--muted)]">{note}</p>
        {status === "approved" && !gaps.length && sub?.status !== "active" && (
          <Link href="/cabinet" className="mt-2 inline-block text-[12px] font-black" style={{ color: "var(--purple-edge)" }}>
            {daysLeft > 0 ? "Что входит в PRO" : "Подключить PRO"}
          </Link>
        )}
      </div>
    </div>
  );
}
