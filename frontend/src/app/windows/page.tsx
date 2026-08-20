"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { WindowsPoster } from "@/components/invite-poster";
import { OWN_PROFILE_ID, PSYS, getCatalogPsy, profileToCatalogPsy, type Psy } from "@/lib/catalog";
import { DEMO } from "@/lib/demo";
import { tap } from "@/lib/haptics";
import { useFreeWindows, type Span } from "@/lib/invite-windows";
import { useMe } from "@/lib/me";
import { useProfile } from "@/lib/profile";
import { getWorkHours } from "@/lib/schedule";

/**
 * Афиша свободных окон. Открывается по ссылке специалиста (`win_<id>` в
 * стартовой метке бота) и показывает клиенту то же, что тот увидел бы в
 * анкете, — только сразу и без листания каталога.
 */
export default function WindowsPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const profile = useProfile();
  const { data: work } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours, enabled: Boolean(profile) });
  const [span, setSpan] = useState<Span>("week");
  const [id, setId] = useState<number | null>(null);

  useEffect(() => {
    const value = Number(new URLSearchParams(window.location.search).get("psy"));
    setId(Number.isFinite(value) && value > 0 ? value : null);
  }, []);

  // Своя афиша — когда специалист смотрит, что уйдёт клиенту.
  const own = !id || id === OWN_PROFILE_ID || id === me?.id;
  const demoCard = id ? PSYS.find((item) => item.id === id) : undefined;
  const { data: row } = useQuery({
    queryKey: ["catalog-psy", id],
    queryFn: () => getCatalogPsy(id!),
    enabled: Boolean(id) && !own && !demoCard && !DEMO,
  });

  const psy: Psy | null = demoCard ?? row ?? (profile ? profileToCatalogPsy(profile, work) : null);
  // Окна берём взглядом клиента: с `psy` сервер применяет правило записи
  // заранее — то же, что увидит человек, когда откроет анкету.
  const windowsFor = own ? (DEMO ? OWN_PROFILE_ID : me?.id ?? null) : id;
  const { days, loading } = useFreeWindows(windowsFor, span);

  const bookHref = `/catalog?psy=${id ?? (own ? OWN_PROFILE_ID : 0)}&book=1`;

  return (
    <div className="pb-4">
      <header className="pb-4 pt-2">
        <p className="t-micro">Приглашение на встречу</p>
        <h1 className="t-display mt-1">Свободные окна</h1>
      </header>

      {psy ? (
        <WindowsPoster
          psy={psy}
          days={days}
          span={span}
          onSpan={setSpan}
          onPick={() => { tap(); router.push(bookHref); }}
          footer={
            <button
              onClick={() => { tap(); router.push(bookHref); }}
              className="btn mt-3 w-full"
            >
              <Icon name="calendar" width={15} weight="fill" color="#fff" /> Записаться на встречу
            </button>
          }
        />
      ) : (
        <div className="card p-5 text-center">
          <p className="t-sub">{loading ? "Загружаем окна…" : "Специалист не найден — попросите ссылку заново"}</p>
        </div>
      )}

      <p className="t-cap mt-3 px-1 text-center">
        Выберите время — откроется анкета специалиста с записью. Встреча появится в вашей «Терапии».
      </p>
    </div>
  );
}
