"use client";

import Link from "next/link";

import { PageHead } from "@/components/blocks";
import { ProfessionalProfileEditor } from "@/components/profile-editor";
import { VerificationPrompt } from "@/components/verification-prompt";
import { OWN_PROFILE_ID } from "@/lib/catalog";
import { tap } from "@/lib/haptics";

export default function CabinetProfilePage() {
  return (
    <div>
      <PageHead title="Профиль специалиста" icon="user" back="/cabinet" backLight />
      <div className="sheet">
        {/* Подсказка о проверке — до анкеты: заполнять её имеет смысл, зная,
            что дальше документы и модерация. */}
        <VerificationPrompt compact className="mb-4 mt-3" />
        <ProfessionalProfileEditor />

        {/* Та же карточка, что видит клиент в каталоге, — собирается из анкеты. */}
        <Link
          href={`/catalog?psy=${OWN_PROFILE_ID}&from=profile`}
          onClick={tap}
          className="mt-6 block w-full py-2 text-center text-[13px] font-black"
          style={{ color: "var(--edge)" }}
        >
          Как выглядит мой профиль
        </Link>
      </div>
    </div>
  );
}
