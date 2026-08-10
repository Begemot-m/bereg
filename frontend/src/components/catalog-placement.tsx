"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Icon } from "@/components/icons";
import { catalogProfileGaps } from "@/lib/catalog";
import { useProfile } from "@/lib/profile";
import { useVerification } from "@/lib/psy-verification";
import { CATALOG_FREE_DAYS, catalogDaysLeft, getSubscription, PLAN_PRICE, rub } from "@/lib/subscription";

const dayWord = (n: number) => {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return "дней";
  const last = n % 10;
  if (last === 1) return "день";
  if (last >= 2 && last <= 4) return "дня";
  return "дней";
};

/**
 * Где сейчас анкета: в каталоге или нет — и почему. Три условия сходятся в
 * одном месте, потому что человек видит только результат: проверка пройдена,
 * анкета собрана целиком, размещение оплачено (или идут бесплатные дни).
 */
export function CatalogPlacement({ className }: { className?: string }) {
  const profile = useProfile();
  const { data: verification } = useVerification();
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });

  const status = verification?.status ?? "none";
  const gaps = catalogProfileGaps(profile);
  const daysLeft = sub ? catalogDaysLeft(sub) : 0;

  let tone = "var(--purple-edge)";
  let title: string;
  let note: string;
  let icon: "seal" | "clock" | "compass" | "spark" = "compass";

  if (status !== "approved") {
    icon = status === "review" ? "clock" : "seal";
    tone = status === "review" ? "var(--amber-edge)" : "var(--muted)";
    title = status === "review" ? "Анкета на проверке" : "Анкеты в каталоге пока нет";
    note =
      status === "review"
        ? `После подтверждения карточка встаёт в каталог: ${CATALOG_FREE_DAYS} ${dayWord(CATALOG_FREE_DAYS)} бесплатно, дальше по подписке PRO.`
        : `Каталог открывается после верификации. Первые ${CATALOG_FREE_DAYS} ${dayWord(CATALOG_FREE_DAYS)} размещения — бесплатно.`;
  } else if (gaps.length) {
    icon = "seal";
    tone = "var(--salmon-edge)";
    title = "Проверка пройдена, карточка не собрана";
    note = `Не хватает: ${gaps.join(", ")}. Пока анкета неполная, в каталог она не попадает.`;
  } else if (sub?.pro) {
    icon = "spark";
    tone = "var(--green-edge)";
    title = "Анкета в каталоге";
    note = "Размещение входит в Хронику PRO — карточка стоит в выдаче, пока подписка активна.";
  } else if (daysLeft > 0) {
    icon = "compass";
    tone = "var(--purple-edge)";
    title = "Анкета в каталоге";
    note = `Бесплатное размещение — ещё ${daysLeft} ${dayWord(daysLeft)}. Дальше карточку держит PRO, ${rub(PLAN_PRICE.pro)} в месяц.`;
  } else {
    icon = "compass";
    tone = "var(--salmon-edge)";
    title = "Карточка снята с каталога";
    note = `Бесплатные ${CATALOG_FREE_DAYS} ${dayWord(CATALOG_FREE_DAYS)} закончились. Анкета осталась подтверждённой — вернуть её в выдачу можно подпиской PRO.`;
  }

  return (
    <div className={`card-soft flex items-start gap-3 p-4 ${className ?? ""}`} style={{ background: "var(--surface)" }}>
      <span className="ico ico-white h-11 w-11 shrink-0"><Icon name={icon} width={21} weight="bold" color={tone} /></span>
      <div className="min-w-0">
        <p className="t-micro" style={{ color: tone }}>Каталог специалистов</p>
        <p className="t-body mt-1 font-black">{title}</p>
        <p className="mt-1 text-[11.5px] font-semibold leading-snug text-[var(--muted)]">{note}</p>
        {status === "approved" && !gaps.length && !sub?.pro && (
          <Link href="/cabinet" className="mt-2 inline-block text-[12px] font-black" style={{ color: "var(--purple-edge)" }}>
            {daysLeft > 0 ? "Что входит в PRO" : "Подключить PRO"}
          </Link>
        )}
      </div>
    </div>
  );
}
