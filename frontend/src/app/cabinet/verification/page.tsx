"use client";

import { PageHead } from "@/components/blocks";
import { CatalogVerification } from "@/components/psy-verification";
import { useVerification } from "@/lib/psy-verification";

export default function VerificationPage() {
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
