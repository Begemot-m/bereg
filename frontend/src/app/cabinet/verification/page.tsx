"use client";

import Link from "next/link";

import { PageHead } from "@/components/blocks";
import { CatalogVerification } from "@/components/psy-verification";
import { Block, WebTitle } from "@/components/web-ui";
import { useVerification } from "@/lib/psy-verification";
import { useWebMode } from "@/lib/web-mode";

export default function VerificationPage() {
  const web = useWebMode();
  const { data: verification } = useVerification();
  const status = verification?.status ?? "none";
  // Подтверждённому специалисту обещать проверку незачем: он её уже прошёл, и
  // анкету дальше можно править без модерации.
  const sub =
    status === "approved"
      ? "Проверка пройдена — анкету можно править свободно"
      : status === "review"
        ? "Документы у модератора — обычно 1–2 рабочих дня"
        : "Мы проверим документы в ближайшее время";

  if (web)
    return (
      <div>
        <Link href="/cabinet" className="back-link mb-3">Кабинет</Link>
        <WebTitle title="Верификация" sub={sub} />
        <Block className="rounded-[18px] p-5" style={{ background: "var(--surface)" }}>
          <CatalogVerification />
          <p className="mt-4 text-[10px] font-semibold leading-relaxed text-[var(--muted-2)]">
            Документы видит только модератор платформы. Клиентам в каталоге показывается лишь отметка «проверен».
          </p>
        </Block>
      </div>
    );

  return (
    <div>
      <PageHead title="Верификация" icon="check" back="/cabinet" sub={sub} />
      <div className="sheet">
        <CatalogVerification />

        <p className="mt-4 text-center text-[10px] font-semibold leading-relaxed text-[var(--muted-2)]">
          Документы видит только модератор платформы. Клиентам в каталоге показывается лишь отметка «проверен».
        </p>
      </div>
    </div>
  );
}
