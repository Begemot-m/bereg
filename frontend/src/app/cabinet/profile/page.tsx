"use client";

import Link from "next/link";

import { PageHead } from "@/components/blocks";
import { ProfessionalProfileEditor } from "@/components/profile-editor";
import { VerificationPrompt } from "@/components/verification-prompt";
import { tap } from "@/lib/haptics";

export default function CabinetProfilePage() {
  return (
    <div>
      <PageHead title="Профиль специалиста" sub="Заполняйте анкету и сразу смотрите, как её увидит клиент" />
      <div className="sheet">
        <Link href="/cabinet" onClick={tap} className="back-link mb-3">Назад</Link>
        {/* Подсказка о проверке — до анкеты: заполнять её имеет смысл, зная,
            что дальше документы и модерация. */}
        <VerificationPrompt className="mb-4" />
        <ProfessionalProfileEditor />
      </div>
    </div>
  );
}
