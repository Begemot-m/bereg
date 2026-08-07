"use client";

import { PageHead } from "@/components/blocks";
import { ProfessionalProfileEditor } from "@/components/profile-editor";
import { VerificationPrompt } from "@/components/verification-prompt";

export default function CabinetProfilePage() {
  return (
    <div>
      <PageHead title="Профиль специалиста" icon="user" back="/cabinet" />
      <div className="sheet">
        {/* Подсказка о проверке — до анкеты: заполнять её имеет смысл, зная,
            что дальше документы и модерация. */}
        <VerificationPrompt compact className="mb-4 mt-3" />
        <ProfessionalProfileEditor />
      </div>
    </div>
  );
}
