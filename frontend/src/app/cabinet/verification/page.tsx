"use client";

import Link from "next/link";

import { PageHead } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { CatalogVerification } from "@/components/psy-verification";
import { tap } from "@/lib/haptics";

const RULES = [
  { icon: "book" as const, title: "Профильное образование", text: "Диплом психолога либо переподготовка. Курсы без документа не подходят." },
  { icon: "user" as const, title: "Заполненная анкета", text: "Методы, запросы, формат и цена — по ним вас находят в каталоге." },
  { icon: "lock" as const, title: "Документ на проверку", text: "Диплом или сертификат фотографией или PDF. Смотрит только модератор платформы." },
];

export default function VerificationPage() {
  return (
    <div>
      <PageHead title="Верификация" icon="therapy" sub="Проверяем документы вручную — обычно за пару дней" />
      <div className="sheet">
        <Link href="/cabinet" onClick={tap} className="back-link mb-3">Назад</Link>

        <div className="space-y-1.5">
          {RULES.map((rule) => (
            <div key={rule.title} className="card-soft flex items-start gap-3 p-3">
              <span className="ico ico-white h-10 w-10 shrink-0"><Icon name={rule.icon} width={18} weight="bold" color="var(--edge)" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-black leading-tight">{rule.title}</span>
                <span className="t-cap mt-0.5 block leading-snug">{rule.text}</span>
              </span>
            </div>
          ))}
        </div>

        <CatalogVerification />

        <p className="mt-4 text-center text-[10px] font-semibold leading-relaxed text-[var(--muted-2)]">
          Документы видит только модератор платформы. Клиентам в каталоге показывается лишь отметка «проверен».
        </p>
      </div>
    </div>
  );
}
