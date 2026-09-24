"use client";

import Link from "next/link";

import { PageHead } from "@/components/blocks";
import { ProfessionalProfileEditor } from "@/components/profile-editor";
import { VerificationPrompt } from "@/components/verification-prompt";
import { Block, WebTitle } from "@/components/web-ui";
import { OWN_PROFILE_ID } from "@/lib/catalog";
import { tap } from "@/lib/haptics";
import { useWebMode } from "@/lib/web-mode";

export default function CabinetProfilePage() {
  const web = useWebMode();

  if (web)
    return (
      <div data-wide>
        <Link href="/cabinet" className="back-link mb-3">Кабинет</Link>
        <WebTitle
          title="Профиль специалиста"
          sub="Анкета в каталоге — то, по чему клиент выбирает"
          right={
            <Link
              href={`/catalog?psy=${OWN_PROFILE_ID}&from=profile`}
              onClick={tap}
              className="text-[12px] font-black"
              style={{ color: "var(--edge)" }}
            >
              Как выглядит мой профиль
            </Link>
          }
        />
        <VerificationPrompt compact className="mb-4" />
        <Block className="rounded-[18px] p-5" style={{ background: "var(--surface)" }}>
          <ProfessionalProfileEditor />
        </Block>
      </div>
    );

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
