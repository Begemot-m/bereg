"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { PageHead } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { InviteShare } from "@/components/invite-share";
import { WindowsPoster, downloadPng, posterPng } from "@/components/invite-poster";
import { profileCompletionPercent } from "@/components/profile-editor";
import { bookingInviteUrl } from "@/components/session-invite";
import { asset } from "@/lib/asset";
import { APP_NAME } from "@/lib/brand";
import { OWN_PROFILE_ID, profileToCatalogPsy } from "@/lib/catalog";
import { DEMO } from "@/lib/demo";
import { success, tap } from "@/lib/haptics";
import { useFreeWindows, windowsInviteUrl, type Span } from "@/lib/invite-windows";
import { useMe } from "@/lib/me";
import { formatMoney } from "@/lib/money";
import { useProfile } from "@/lib/profile";
import { getWorkHours } from "@/lib/schedule";

const WINDOWS_TEXT = `Вот моё свободное время на ближайшие дни — выберите удобное, и встреча сразу окажется в календаре`;
const CARD_TEXT = `Моя визитка в «${APP_NAME}»: тут обо мне, о работе и запись на встречу`;

/**
 * Две ссылки, которыми специалист зовёт своих клиентов: афиша свободных окон
 * (для тех, кто уже решился и выбирает время) и визитка (для тех, кто ещё
 * присматривается). Обе ведут в мини-приложение, где клиент цепляется к
 * специалисту сам — заводить карточку и просить телефон не нужно.
 */
export default function CabinetInvitePage() {
  const { data: me } = useMe();
  const profile = useProfile();
  const { data: work } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours, enabled: Boolean(profile) });
  const [span, setSpan] = useState<Span>("week");
  const [saving, setSaving] = useState(false);

  const windowsFor = DEMO ? OWN_PROFILE_ID : me?.id ?? null;
  const { days } = useFreeWindows(windowsFor, span);
  const psy = profile ? profileToCatalogPsy(profile, work) : null;
  const filled = profileCompletionPercent(profile) > 0;

  const windowsLink = windowsInviteUrl(me?.id);
  const cardLink = bookingInviteUrl(me?.id);

  const savePoster = async () => {
    if (!psy) return;
    tap();
    setSaving(true);
    try {
      const png = await posterPng(psy, days, span, windowsLink);
      if (png) { downloadPng(png, `okna-${span === "week" ? "nedelya" : "mesyac"}.png`); success(); }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHead title="Пригласить клиента" icon="telegram" back="/cabinet" backLight />
      <div className="sheet space-y-5">
        <p className="t-sub">
          Клиент открывает ссылку в Telegram, попадает в приложение и записывается сам. Карточку заводить не нужно —
          она появится у вас в «Клиентах» после первой записи.
        </p>

        {!filled && (
          <div className="card p-4">
            <p className="t-head">Анкета пока пустая</p>
            <p className="t-sub mt-1">В ссылках клиент увидит только имя. Заполните анкету — и в приглашении появятся метод, опыт и цена.</p>
            <Link href="/cabinet/profile" onClick={tap} className="btn mt-3 w-full">Заполнить анкету</Link>
          </div>
        )}

        <section>
          <div className="mb-2 flex items-center gap-2">
            <span className="ico h-8 w-8"><Icon name="calendar" width={16} weight="bold" /></span>
            <div>
              <p className="t-head leading-tight">Афиша свободных окон</p>
              <p className="t-cap">Ссылка показывает время на неделю или месяц</p>
            </div>
          </div>

          {psy ? <WindowsPoster psy={psy} days={days} span={span} onSpan={setSpan} /> : <div className="card p-4"><p className="t-sub">Заполните имя в анкете, чтобы собрать афишу</p></div>}

          <div className="mt-2.5">
            <InviteShare link={windowsLink} text={WINDOWS_TEXT} />
            <button onClick={() => void savePoster()} disabled={!psy || saving} className="btn btn-outline mt-2 w-full py-1.5 text-[11.5px] disabled:opacity-50">
              <Icon name="image" width={13} weight="bold" color="var(--edge)" /> {saving ? "Рисуем…" : "Сохранить картинкой"}
            </button>
            <p className="t-cap mt-1.5">Картинка вертикальная — под сторис и пересылку в чат. Ссылка внутри останется живой.</p>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <span className="ico h-8 w-8"><Icon name="user" width={16} weight="bold" /></span>
            <div>
              <p className="t-head leading-tight">Визитка специалиста</p>
              <p className="t-cap">Анкета целиком: о вас, отзывы и запись</p>
            </div>
          </div>

          <CardPreview psy={psy} />

          <div className="mt-2.5">
            <InviteShare link={cardLink} text={CARD_TEXT} />
            <p className="t-cap mt-1.5">По этой ссылке клиент открывает вашу страницу, добавляет вас в «Терапию» и выбирает время.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Миниатюра визитки — то, что клиент увидит первым экраном. */
function CardPreview({ psy }: { psy: ReturnType<typeof profileToCatalogPsy> | null }) {
  if (!psy) return <div className="card p-4"><p className="t-sub">Визитка соберётся из анкеты</p></div>;
  const portrait = psy.portrait ? asset(psy.portrait) : "";
  return (
    <div className="card overflow-hidden p-3">
      <div className="flex gap-3">
        {portrait ? (
          <div className="relative h-[96px] w-[86px] shrink-0 overflow-hidden rounded-[14px]">
            <Image src={portrait} alt={`Портрет: ${psy.name}`} fill sizes="86px" className="object-cover" unoptimized={/^(data:|blob:)/i.test(portrait)} />
          </div>
        ) : (
          <span className="ico h-[86px] w-[86px] shrink-0 rounded-[14px]"><Icon name="user" width={34} weight="fill" /></span>
        )}
        <div className="min-w-0 flex-1">
          <p className="t-head flex items-center gap-1.5"><span className="truncate">{psy.name || "Ваше имя"}</span>{psy.verified && <Icon name="seal" width={15} weight="fill" color="var(--green)" className="shrink-0" />}</p>
          <p className="mt-0.5 text-[11px] font-black" style={{ color: "var(--edge)" }}>{psy.specialistTypes?.length ? psy.specialistTypes.join(" · ") : "Психолог"}</p>
          <p className="t-cap mt-0.5 truncate">{[psy.method, psy.years ? `${psy.years} лет практики` : ""].filter(Boolean).join(" · ")}</p>
          {psy.price > 0 && <p className="t-cap mt-1 font-black" style={{ color: "var(--ink)" }}>{formatMoney(psy.price, psy.currency ?? "RUB")} / {psy.minutes} мин</p>}
        </div>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        <span className="chip">В мою терапию</span>
        <span className="chip">Записаться</span>
      </div>
    </div>
  );
}
