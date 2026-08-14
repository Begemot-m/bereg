"use client";

import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";

import { Icon } from "@/components/icons";
import { getCatalogPsy, profileToCatalogPsy, psyCurrency, type Psy } from "@/lib/catalog";
import { DEMO } from "@/lib/demo";
import { tap } from "@/lib/haptics";
import { formatMoney } from "@/lib/money";
import { getPsyProfile, LINK_META, normalizeLinkUrl, type LinkKind } from "@/lib/profile";
import { timeInZone, zoneOffset } from "@/lib/timezones";

/**
 * Анкета глазами клиента — для модерации. Раньше решение принималось по трём
 * строкам заявки: имя, метод и цена. Что человек написал о себе, какие ставит
 * правила и как выглядит его карточка в каталоге, модератор не видел вовсе.
 */
export type PreviewSource = {
  userId: number;
  name: string;
  about?: string;
  education?: string;
  method?: string;
  experienceYears?: number;
  sessionPrice?: number;
  city?: string;
  format?: string;
  photo?: string | null;
};

function fromApplication(source: PreviewSource): Psy | null {
  // Демо-заявка живёт в браузере, и своя анкета там же — берём её целиком.
  const local = DEMO ? getPsyProfile() : null;
  if (local) return profileToCatalogPsy(local);
  if (!source.name) return null;
  return {
    id: source.userId,
    name: source.name,
    portrait: source.photo ?? "",
    photos: source.photo ? [source.photo] : [],
    tone: "purple",
    verified: false,
    rating: 0,
    reviews: 0,
    method: source.method ?? "",
    methods: source.method ? [source.method] : [],
    topics: [],
    price: source.sessionPrice ?? 0,
    minutes: 50,
    format: (source.format as Psy["format"]) || "online",
    city: source.city ?? "",
    gender: "unspecified",
    languages: [],
    years: source.experienceYears ?? 0,
    sessions: 0,
    clients: 0,
    responseHrs: 24,
    nextDays: 14,
    availableTimes: ["day"],
    exposure: 0,
    newcomer: true,
    tg: "",
    about: source.about ?? "",
    education: source.education ? source.education.split(";").map((item) => item.trim()).filter(Boolean) : [],
  };
}

export function PsyPreviewSheet({ source, onClose }: { source: PreviewSource | null; onClose: () => void }) {
  // В бою анкета берётся тем же роутом, что кормит каталог: модератор видит
  // ровно ту карточку, которая появится в выдаче после одобрения.
  const { data: psy, isLoading } = useQuery({
    queryKey: ["admin-psy-preview", source?.userId],
    queryFn: async () => {
      if (!source) return null;
      if (DEMO) return fromApplication(source);
      try {
        return (await getCatalogPsy(source.userId)) ?? fromApplication(source);
      } catch {
        return fromApplication(source);
      }
    },
    enabled: Boolean(source),
    staleTime: 30_000,
  });

  return (
    <AnimatePresence>
      {source && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-end justify-center bg-[rgba(24,22,20,.6)] p-3 @md:items-center" onClick={onClose}>
          <motion.div
            initial={{ y: 28 }}
            animate={{ y: 0 }}
            exit={{ y: 22, opacity: 0 }}
            onClick={(event) => event.stopPropagation()}
            className="chunk flex max-h-[min(90vh,calc(100dvh-var(--top-pad)))] w-full max-w-md flex-col overflow-hidden bg-white"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="t-micro">Профиль глазами клиента</p>
                <p className="truncate text-[15px] font-black">{psy?.name || source.name}</p>
              </div>
              <button onClick={() => { tap(); onClose(); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[15px] font-black stroke" aria-label="Закрыть">×</button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto border-y px-4 py-4" style={{ borderColor: "var(--edge-neutral)" }}>
              {isLoading && <p className="t-cap">Загружаем анкету…</p>}
              {!isLoading && !psy && <p className="t-cap">Анкета не открылась — возможно, специалист её ещё не сохранил.</p>}
              {psy && <PreviewBody psy={psy} />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PreviewBody({ psy }: { psy: Psy }) {
  const zone = psy.timezone ?? "";
  const links = (psy.links ?? []).map((link) => ({ ...link, href: normalizeLinkUrl(link.kind, link.url) })).filter((link) => link.href);
  return (
    <>
      <div className="flex gap-3">
        <div className="h-[104px] w-[84px] shrink-0 overflow-hidden rounded-[14px] bg-[var(--head-soft)] stroke">
          {psy.portrait
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={psy.portrait} alt="" className="h-full w-full object-cover" />
            : <span className="flex h-full w-full items-center justify-center text-[26px] font-black">{psy.name.trim().charAt(0).toUpperCase() || "П"}</span>}
        </div>
        <div className="min-w-0">
          <p className="text-[16px] font-black leading-tight">{psy.name}</p>
          <p className="t-cap mt-1">{[psy.specialistTypes?.join(" · "), psy.method, psy.years ? `${psy.years} лет практики` : ""].filter(Boolean).join(" · ")}</p>
          <p className="mt-1.5 text-[13px] font-black">{psy.price ? formatMoney(psy.price, psyCurrency(psy)) : "цена не указана"}<span className="t-cap"> / {psy.minutes || "—"} мин</span></p>
          {(psy.region || psy.city || zone) && (
            <p className="t-cap mt-1">{[psy.region || psy.city, zoneOffset(zone), timeInZone(zone)].filter(Boolean).join(" · ")}</p>
          )}
        </div>
      </div>

      {psy.quote && <p className="border-l-2 pl-2.5 text-[12px] font-semibold italic leading-snug text-[var(--muted)]" style={{ borderColor: "var(--tiffany-edge)" }}>«{psy.quote}»</p>}

      {psy.topics.length > 0 && <PreviewList title="Запросы" items={psy.topics} />}
      {psy.methods.length > 0 && <PreviewList title="Методы" items={psy.methods} />}
      {(psy.avoids?.length ?? 0) > 0 && <PreviewList title="С чем не работает" items={psy.avoids!} />}
      {psy.languages.length > 0 && <PreviewList title="Языки" items={psy.languages} />}

      {psy.about && <PreviewText title="О себе" text={psy.about} />}
      {psy.firstSession && <PreviewText title="Первая встреча" text={psy.firstSession} />}
      {psy.education.length > 0 && (
        <section>
          <p className="t-micro mb-1.5">Образование</p>
          <ul className="space-y-1">{psy.education.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-[12px] font-semibold"><Icon name="check" width={13} className="mt-0.5 shrink-0" />{item}</li>)}</ul>
        </section>
      )}
      {(psy.rules?.length ?? 0) > 0 && (
        <section>
          <p className="t-micro mb-1.5">Правила работы</p>
          <div className="space-y-1.5">{psy.rules!.map((rule) => <p key={rule.id} className="text-[12px] font-semibold leading-snug"><span className="font-black">{rule.title}: </span>{rule.text}</p>)}</div>
        </section>
      )}
      {links.length > 0 && (
        <section>
          <p className="t-micro mb-1.5">Ссылки</p>
          <div className="space-y-1">{links.map((link, index) => <a key={index} href={link.href!} target="_blank" rel="noreferrer" className="block truncate text-[12px] font-bold underline">{LINK_META[link.kind as LinkKind]?.label ?? link.kind}: {link.url}</a>)}</div>
        </section>
      )}
    </>
  );
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <p className="t-micro mb-1.5">{title}</p>
      <div className="flex flex-wrap gap-1.5">{items.map((item) => <span key={item} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold stroke">{item}</span>)}</div>
    </section>
  );
}

function PreviewText({ title, text }: { title: string; text: string }) {
  return (
    <section>
      <p className="t-micro mb-1">{title}</p>
      <p className="text-[12.5px] font-semibold leading-relaxed">{text}</p>
    </section>
  );
}
