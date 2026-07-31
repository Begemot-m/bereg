"use client";

import Link from "next/link";

import { PageHead } from "@/components/blocks";
import { ProfessionalProfileEditor } from "@/components/profile-editor";
import { tap } from "@/lib/haptics";

export default function CabinetProfilePage() {
  return (
    <div>
      <PageHead title="Профиль специалиста" sub="Заполняйте анкету и сразу смотрите, как её увидит клиент" />
      <div className="sheet">
        <Link href="/cabinet" onClick={tap} className="back-link mb-3">Назад</Link>
        <ProfessionalProfileEditor />
      </div>
    </div>
  );
}
