"use client";

import { PageHead } from "@/components/blocks";
import { CatalogVerification } from "@/components/psy-verification";

export default function VerificationPage() {
  return (
    <div>
      <PageHead title="Верификация" icon="check" back="/cabinet" sub="Мы проверим документы в ближайшее время" />
      <div className="sheet">
        <CatalogVerification />

        <p className="mt-4 text-center text-[10px] font-semibold leading-relaxed text-[var(--muted-2)]">
          Документы видит только модератор платформы. Клиентам в каталоге показывается лишь отметка «проверен».
        </p>
      </div>
    </div>
  );
}
