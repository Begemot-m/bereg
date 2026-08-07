"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowGlyph } from "@/components/blocks";
import { AnimatePresence, motion } from "motion/react";

import { getMonthAvailability, ymdLocal } from "@/lib/schedule";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { syncTelegramChrome } from "@/components/telegram-init";

import { CatalogFiltersSheet, CatalogSurvey } from "@/components/catalog-controls";
import { Icon, type IconName } from "@/components/icons";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { SlotPicker } from "@/components/slot-picker";
import { Button, Disclosure, Input } from "@/components/ui";
import { asset } from "@/lib/asset";
import { listMyBookings } from "@/lib/clients";
import {
  EMPTY_FILTERS,
  EMPTY_PREFS,
  METHOD_DESCRIPTIONS,
  filterCatalog,
  formatLabel,
  nextSlotLabel,
  getCatalogPsy,
  OWN_PROFILE_ID,
  personalSelection,
  profileToCatalogPsy,
  publishedCatalog,
  PSYS,
  reasonsFor,
  sortCatalog,
  type CatalogFilters,
  type CatalogPrefs,
  type Psy,
  type SortMode,
  type Tone,
} from "@/lib/catalog";
import { select, success, tap } from "@/lib/haptics";
import { bookSlot } from "@/lib/mybookings";
import { useProfile } from "@/lib/profile";
import { getSubscription } from "@/lib/subscription";
import { attachTherapist, isAttached } from "@/lib/therapists";

const PREFS_KEY = "bereg_catalog_prefs_v1";
const SEEN_KEY = "bereg_catalog_survey_seen_v1";
type CatalogMode = "personal" | "all";

const T: Record<Tone, { bg: string; soft: string; edge: string }> = {
  green: { bg: "var(--green)", soft: "var(--green-soft)", edge: "var(--green-edge)" },
  amber: { bg: "var(--amber)", soft: "var(--amber-soft)", edge: "var(--amber-edge)" },
  purple: { bg: "var(--purple)", soft: "var(--purple-soft)", edge: "var(--purple-edge)" },
  coral: { bg: "var(--coral)", soft: "var(--coral-soft)", edge: "var(--coral-edge)" },
  salmon: { bg: "var(--salmon)", soft: "var(--salmon-soft)", edge: "var(--salmon-edge)" },
  sky: { bg: "var(--sky)", soft: "#d5e8ef", edge: "#5f95ab" },
};
const CATALOG_TONE = { bg: "var(--tiffany)", soft: "var(--tiffany-soft)", edge: "var(--tiffany-edge)" };

const SORTS: { value: SortMode; label: string }[] = [
  { value: "recommended", label: "Рекомендованные" },
  { value: "soon", label: "Ближайшая запись" },
  { value: "price-asc", label: "Сначала дешевле" },
  { value: "price-desc", label: "Сначала дороже" },
  { value: "experience", label: "Больше опыта" },
  { value: "rating", label: "Выше рейтинг" },
  { value: "new", label: "Новые на платформе" },
];

function yearsWord(value: number) {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return "лет";
  const last = value % 10;
  if (last === 1) return "год";
  if (last >= 2 && last <= 4) return "года";
  return "лет";
}

export default function CatalogPage() {
  const router = useRouter();
  const profile = useProfile();
  const { data: subscription } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  const [mode, setMode] = useState<CatalogMode>("personal");
  const [prefs, setPrefs] = useState<CatalogPrefs>(EMPTY_PREFS);
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortMode>("recommended");
  const [page, setPage] = useState(0);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Psy | null>(null);
  const [returnToTherapy, setReturnToTherapy] = useState(false);

  // Пришли по ссылке от специалиста: /catalog?psy=<id>&book=1
  const [invited, setInvited] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReturnToTherapy(params.get("from") === "therapy");
    const id = Number(params.get("psy"));
    if (!id) return;
    setInvited(params.get("book") === "1");
    // Своя анкета в каталоге может быть не опубликована — тогда собираем её
    // из профиля, иначе приглашение вело бы в пустоту.
    const psy = PSYS.find((item) => item.id === id)
      ?? (id === OWN_PROFILE_ID && profile?.name ? profileToCatalogPsy(profile) : undefined);
    if (psy) { setSelected(psy); setSurveyOpen(false); return; }
    // Боевой каталог живёт на сервере: по ссылке приходит настоящий id, и
    // карточку надо забрать оттуда, а не искать в демо-списке.
    let alive = true;
    getCatalogPsy(id)
      .then((row) => { if (alive && row) { setSelected(row); setSurveyOpen(false); } })
      .catch(() => { /* карточки нет — остаёмся в общем каталоге */ });
    return () => { alive = false; };
  }, [profile]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) setPrefs({ ...EMPTY_PREFS, ...(JSON.parse(saved) as CatalogPrefs) });
      const deep = new URLSearchParams(window.location.search).get("psy");
      if (!deep && !localStorage.getItem(SEEN_KEY)) setTimeout(() => setSurveyOpen(true), 260);
    } catch { setSurveyOpen(true); }
  }, []);

  const catalog = useMemo(() => publishedCatalog(profile, subscription), [profile, subscription]);
  const personal = useMemo(() => personalSelection(prefs, catalog), [prefs, catalog]);
  const allFiltered = useMemo(() => sortCatalog(filterCatalog(filters, catalog), sort, prefs), [filters, sort, prefs, catalog]);
  const pageCount = Math.max(1, Math.ceil(allFiltered.length / 10));
  const allPage = allFiltered.slice(page * 10, page * 10 + 10);
  const visible = mode === "personal" ? personal : allPage;
  const activeFilters = filters.topics.length + filters.methods.length + Number(filters.format !== "any") + Number(filters.maxPrice != null) + Number(filters.gender !== "any") + Number(filters.minYears > 0) + Number(filters.verifiedOnly) + Number(filters.thisWeek) + Number(Boolean(filters.city.trim())) + Number(filters.language !== "any");
  const countFilters = useCallback((value: CatalogFilters) => filterCatalog(value, catalog).length, [catalog]);

  const savePrefs = (next: CatalogPrefs) => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    localStorage.setItem(SEEN_KEY, "1");
    setPrefs(next);
    setSurveyOpen(false);
    setMode("personal");
    setPage(0);
  };
  const viewAll = () => { localStorage.setItem(SEEN_KEY, "1"); setSurveyOpen(false); setMode("all"); };
  const switchMode = (next: CatalogMode) => { select(); setMode(next); setPage(0); };

  if (selected) return <PsyDetailView psy={selected} prefs={prefs} invited={invited} backLabel={returnToTherapy ? "вернуться в терапию" : "вернуться в каталог"} onBack={() => returnToTherapy ? router.push("/therapy") : setSelected(null)} />;

  return (
    <div className="-mx-4 -mt-6 @md:-mx-9">
      <header className="px-4 pb-14 pt-8 @md:px-9" style={{ background: "var(--page)" }}>
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.14em]">Психологи платформы</p><div className="mt-1 flex items-center gap-2.5"><span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-white"><Icon name="compass" width={22} weight="bold" color="var(--edge)" /></span><h1 className="font-tight text-[31px] font-black leading-none">Каталог</h1></div><p className="font-tight mt-2 max-w-[270px] text-[12px] font-bold leading-snug text-[var(--muted)]">Проверенные специалисты, которые подойдут именно вам</p></div>
          <button onClick={() => { tap(); setSurveyOpen(true); }} className="flex w-[92px] shrink-0 flex-col items-center gap-1 rounded-[14px] bg-white px-2 py-2.5" style={{ border: "var(--bw) solid var(--ink)" }} aria-label="Собрать персональную подборку">
            <Icon name="sort" width={20} weight="bold" color="var(--ink)" />
            <span className="text-[9.5px] font-black leading-tight">Персональная<br />подборка</span>
          </button>
        </div>
      </header>

      <main className="relative -mt-8 min-h-[72vh] rounded-t-[27px] bg-[#ffffff] px-4 pb-9 pt-4 @md:px-9" >
        <div className="grid grid-cols-2 gap-1 rounded-full bg-white p-1 stroke-lg">
          {([{ id: "personal", label: "Для вас" }, { id: "all", label: "Все специалисты" }] as { id: CatalogMode; label: string }[]).map((tab) => <button key={tab.id} onClick={() => switchMode(tab.id)} className="rounded-full px-2 py-2 text-[11px] font-black transition-colors" style={mode === tab.id ? { background: "var(--ink)", color: "#fff" } : { color: "var(--muted)" }}>{tab.label}</button>)}
        </div>

        {mode === "all" && <AllControls filters={filters} setFilters={(next) => { setFilters(next); setPage(0); }} sort={sort} setSort={(next) => { setSort(next); setPage(0); }} activeFilters={activeFilters} openFilters={() => setFiltersOpen(true)} />}

        <div className="mb-3 mt-5 flex items-end justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">{mode === "personal" ? "Персональная подборка" : `${allFiltered.length} специалистов`}</p><h2 className="font-tight mt-0.5 text-[21px] font-black">{mode === "personal" ? "Специалисты для вас" : `Страница ${Math.min(page + 1, pageCount)} из ${pageCount}`}</h2></div>
        </div>

        {visible.length ? <Stagger className="space-y-3">{visible.map((psy) => <StaggerItem key={psy.id}><PsyCard psy={psy} onOpen={() => { tap(); setSelected(psy); }} /></StaggerItem>)}</Stagger> : <CatalogEmpty filters={filters} onRelax={() => { setFilters({ ...filters, maxPrice: null, thisWeek: false }); setPage(0); }} />}

        {mode === "all" && allFiltered.length > 10 && <div className="mt-5 flex items-center justify-between gap-2"><Button variant="soft" disabled={page === 0} onClick={() => { setPage((value) => Math.max(0, value - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Предыдущие 10</Button><span className="tnum text-[11px] font-black text-[var(--muted)]">{page + 1}/{pageCount}</span><Button disabled={page + 1 >= pageCount} onClick={() => { setPage((value) => Math.min(pageCount - 1, value + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Следующие 10</Button></div>}
      </main>

      <CatalogSurvey open={surveyOpen} initial={prefs} onClose={() => setSurveyOpen(false)} onDone={savePrefs} onViewAll={viewAll} />
      <CatalogFiltersSheet open={filtersOpen} value={filters} resultCount={countFilters} onClose={() => setFiltersOpen(false)} onApply={(next) => { setFilters(next); setFiltersOpen(false); setPage(0); }} />
    </div>
  );
}

function AllControls({ filters, setFilters, sort, setSort, activeFilters, openFilters }: { filters: CatalogFilters; setFilters: (filters: CatalogFilters) => void; sort: SortMode; setSort: (sort: SortMode) => void; activeFilters: number; openFilters: () => void }) {
  return <Reveal delay={.03}><div className="mt-4 space-y-2"><label className="flex items-center gap-2 rounded-[14px] bg-white px-3.5 py-2.5 stroke"><Icon name="compass" width={16} color="var(--muted)" /><input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Имя, подход или запрос" className="min-w-0 flex-1 bg-transparent text-[13px] font-bold outline-none placeholder:font-semibold placeholder:text-[var(--muted-2)]" />{filters.query && <button onClick={() => setFilters({ ...filters, query: "" })} className="font-black text-[var(--muted)]" aria-label="Очистить поиск">×</button>}</label><div className="flex gap-2"><button onClick={openFilters} className="relative flex flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-white px-3 py-2 text-[11px] font-black stroke"><Icon name="filter" width={15} weight="bold" /> Фильтры{activeFilters > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--coral)] px-1 text-[10px] stroke">{activeFilters}</span>}</button><label className="flex flex-[1.35] items-center gap-1.5 rounded-[12px] bg-white px-3 py-2 stroke"><Icon name="sort" width={15} weight="bold" /><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="min-w-0 flex-1 bg-transparent text-[11px] font-black outline-none">{SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div></div></Reveal>;
}

function PsyCard({ psy, onOpen }: { psy: Psy; onOpen: () => void }) {
  const portrait = asset(psy.portrait);
  const helps = psy.helps ?? psy.topics.slice(0, 3).join(", ");
  const soon = psy.nextDays <= 3;

  return (
    <button onClick={onOpen} className="chunk w-full overflow-hidden rounded-[22px] p-0 text-left transition-transform duration-200 active:scale-[.99]">
      <div className="flex gap-3.5 p-4">
        <div className="relative h-[132px] w-[106px] shrink-0 overflow-hidden rounded-[16px]" style={{ background: "var(--head-soft)" }}>
          <Image src={portrait} alt={`Портрет: ${psy.name}`} fill sizes="106px" className="object-cover" priority={psy.id <= 3} unoptimized={isInlineImage(portrait)} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1.5">
            <h3 className="t-head min-w-0">{psy.name}</h3>
            {psy.verified && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--green-soft)]" title="Профиль подтверждён"><Icon name="check" width={12} weight="fill" color="var(--green-edge)" /></span>}
          </div>
           <p className="t-body mt-1.5"><span className="text-[var(--muted)]">Помогаю с </span>{helps}</p>
           {psy.quote && <p className="t-sub mt-2 pl-2.5 italic" style={{ borderLeft: "2px solid var(--edge)" }}>«{psy.quote}»</p>}
         </div>
       </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        <span className="t-cap inline-flex items-center gap-1" style={{ color: "var(--ink)" }}><Icon name="star" width={14} weight="fill" color="var(--amber-edge)" /> {psy.rating.toFixed(1)} <span className="text-[var(--muted)]">({psy.reviews})</span></span>
        <span className="chip">{psy.method}</span>
        <span className="t-cap">{psy.years} {yearsWord(psy.years)} практики</span>
      </div>

      {/* Стоимость + ближайшее окно + переход к профилю */}
      <div className="line-top mt-1 flex items-center gap-2 px-4 py-3">
        <div className="min-w-0">
          <p className="t-head">{psy.price.toLocaleString("ru-RU")} ₽<span className="t-cap"> / {psy.minutes} мин</span></p>
          <p className="t-cap mt-1 flex items-center gap-1" style={soon ? { color: "var(--ink)" } : undefined}><Icon name="calendar" width={11} weight="bold" color={soon ? "var(--edge)" : "var(--muted-2)"} /> {nextSlotLabel(psy.nextDays)}</p>
        </div>
        <span className="btn ml-auto shrink-0">Записаться <ArrowGlyph /></span>
      </div>
    </button>
  );
}

function CatalogEmpty({ filters, onRelax }: { filters: CatalogFilters; onRelax: () => void }) {
  const blocker = filters.thisWeek ? "свободное окно на этой неделе" : filters.maxPrice ? `цена до ${filters.maxPrice.toLocaleString("ru-RU")} ₽` : "выбранные условия";
  return <div className="card-soft p-5 text-center"><div className="flex justify-center"><span className="ico ico-white h-12 w-12"><Icon name="compass" width={23} weight="bold" color="var(--edge)" /></span></div><h3 className="font-tight mt-3 text-[19px] font-black">Точных совпадений нет</h3><p className="mt-1 text-[12px] font-semibold text-[var(--muted)]">Сильнее всего ограничивает: {blocker}.</p><Button className="mt-4" onClick={onRelax}>Ослабить условие</Button></div>;
}

function Portrait({ psy, size, tone = T[psy.tone] }: { psy: Psy; size: number; tone?: { bg: string; soft: string; edge: string } }) { const portrait = asset(psy.portrait); return <div className="relative shrink-0 overflow-hidden rounded-[18px]" style={{ width: size, height: Math.round(size * 1.12), border: `var(--bw-lg) solid ${tone.edge}`, background: tone.soft }}><Image src={portrait} alt={`Портрет: ${psy.name}`} fill sizes={`${size}px`} className="object-cover" priority unoptimized={isInlineImage(portrait)} /></div>; }

// Кнопка «добавить терапевта в мой раздел Терапия» — вверху анкеты.
function AttachTherapistButton({ name }: { name: string }) {
  const [attached, setAttached] = useState(() => isAttached(name));
  const add = () => { if (attached) return; success(); attachTherapist(name); setAttached(true); };
  return (
    <button onClick={add} aria-disabled={attached} className={`btn min-h-11 shrink-0 px-4 ${attached ? "btn-soft" : "btn-accent"}`}>
      {attached ? <><Icon name="check" width={15} weight="bold" color="var(--edge)" /> В терапии</> : <><Icon name="plus" width={15} weight="bold" color="#fff" /> В терапию</>}
    </button>
  );
}

function PsyDetailView({ psy, prefs, invited = false, backLabel, onBack }: { psy: Psy; prefs: CatalogPrefs; invited?: boolean; backLabel: string; onBack: () => void }) {
  const tone = CATALOG_TONE;
  const { data: bookings = [] } = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings });
  const wasInTherapy = bookings.some((booking) => booking.psyName === psy.name);
  const reasons = reasonsFor(psy, prefs);
  const details = detailLocation(psy);
  const firstSession = psy.firstSession ?? "На первой встрече знакомимся, обсуждаем ваш запрос и то, какой поддержки вы ждёте. В конце сверяемся — комфортно ли вам продолжать. Ничего решать сразу не нужно.";
  // Полоска Telegram — в цвет шапки специалиста, на выходе возвращаем тон раздела.
  useEffect(() => { syncTelegramChrome(tone.soft); return () => syncTelegramChrome(); }, [tone.soft]);

  return <div>
    <div className="-mx-4 -mt-2 px-4 pb-16 pt-2 @md:-mx-9 @md:px-9" style={{ background: tone.soft }}>
      {invited ? (
        // Пришли по личной ссылке: человек не искал каталог, ему нужен этот специалист.
        <div className="card-plain mb-3 flex items-center gap-3 p-3.5">
          <span className="ico h-10 w-10 shrink-0"><Icon name="calendar" width={19} weight="bold" color="var(--edge)" /></span>
          <span className="min-w-0">
            <span className="t-micro block">Приглашение на сессию</span>
            <span className="t-head mt-0.5 block leading-tight">{psy.name.split(" ")[0]} открыл{psy.gender === "man" ? "" : "а"} для вас свободные окна</span>
            <span className="t-cap mt-0.5 block">Выберите удобное время — это займёт минуту</span>
          </span>
        </div>
      ) : (
        <button onClick={onBack} className="back-link mb-3 mt-3">{backLabel}</button>
      )}
      <div className="flex items-center gap-3">
        <Portrait psy={psy} size={98} tone={tone} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5"><h1 className="t-title">{psy.name}</h1>{psy.verified && <Icon name="check" width={18} weight="fill" color="var(--green-edge)" />}</div>
          <p className="t-cap mt-1">{psy.method} · {psy.years} {yearsWord(psy.years)} практики</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="chip" style={{ background: "#fff" }}>
              <Icon name="star" width={12} weight="fill" color="var(--amber-edge)" />
              <span className="tnum">{psy.rating.toFixed(1)}</span>
              <span className="text-[var(--muted)]">· {psy.reviews}</span>
            </span>
            {psy.specialistTypes?.map((type) => (
              <span key={type} className="chip" style={{ background: "#fff" }}>{type}</span>
            ))}
            {psy.style && <span className="chip" style={{ background: "#fff" }}><Icon name="spark" width={11} weight="fill" color={tone.edge} /> {psy.style}</span>}
          </div>
        </div>
      </div>

      {/* Действия — сразу под именем, а не через полэкрана */}
      <div className="mt-3.5 flex gap-2">
        <AttachTherapistButton name={psy.name} />
        <a href={`https://t.me/${psy.tg}`} target="_blank" rel="noopener noreferrer" onClick={tap} className="btn min-h-11 shrink-0 bg-[var(--ink)] px-4 text-white">
          <Icon name="telegram" width={16} weight="fill" color="#fff" /> Написать
        </a>
      </div>
    </div>

    <div className="-mx-4 -mt-9 space-y-5 rounded-t-[27px] px-4 pb-10 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)" }}>
      {/* Постер встречи и запись — первое, что нужно решить */}
      <PricePoster psy={psy} />
      <BookingMini psy={psy} tone={tone} onDone={onBack} />

      {/* Почему предложен именно этому пользователю */}
      {reasons.length > 0 && <Section title="Почему подходит именно вам"><ul className="space-y-2">{reasons.map((reason) => <li key={reason} className="t-body flex items-start gap-2"><Icon name="check" width={14} weight="bold" color="var(--edge)" className="mt-0.5 shrink-0" />{reason}</li>)}</ul></Section>}

      <Section title="Особенно хорошо помогает"><div className="flex flex-wrap gap-1.5">{psy.topics.map((topic) => <span key={topic} className="chip" style={{ background: tone.soft }}>{topic}</span>)}</div></Section>

      {/* Как проходит первая встреча */}
      <Section title="Как проходит первая встреча"><p className="t-body">{firstSession}</p></Section>

      {/* Голосовое приветствие (демо-слот) */}
      <VoiceGreeting name={psy.name.split(" ")[0]} />

      {/* Подход и пример работы — без обещаний результата */}
      {psy.about && <Section title="Как я работаю"><p className="t-body">{psy.about}</p></Section>}
      <MethodList psy={psy} />

      {(psy.photos?.length ?? 0) > 1 && <PhotoGallery psy={psy} />}

      <LocationBlock psy={psy} details={details} />

      {/* Образование с раскрываемой проверкой документов */}
      {psy.education.length > 0 && <EducationBlock psy={psy} />}

      {/* Темы, с которыми специалист не работает */}
      {(psy.avoids?.length ?? 0) > 0 && <Section title="С чем не работает"><div className="flex flex-wrap gap-1.5">{psy.avoids!.map((topic) => <span key={topic} className="chip" style={{ background: "var(--surface-2)" }}>{topic}</span>)}</div><p className="t-cap mt-2.5">Если ваш запрос из этого списка — специалист подскажет, к кому обратиться.</p></Section>}

      {/* Отзывы — только после подтверждённых встреч */}
      <RatingBlock psy={psy} canRate={wasInTherapy} />

      {/* Правила отмены и связи между сессиями */}
      <RulesSection minutes={psy.minutes} />

      {/* Постоянная запись */}
      <TelegramPoster psy={psy} />
    </div>
  </div>;
}

function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 720);
      setShown(value * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown.toLocaleString("ru-RU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

// Постер встречи: цена и длительность крупно, в тоне каталога.
function PricePoster({ psy }: { psy: Psy }) {
  const tone = CATALOG_TONE;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-[20px] p-5"
      style={{ background: tone.bg }}
    >
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full" style={{ background: "#fff", opacity: 0.28 }} />
      <p className="t-micro relative">Встреча</p>
      <div className="relative mt-1 flex items-end gap-2">
        <p className="font-tight tnum text-[38px] font-black leading-none"><CountUp value={psy.price} /> ₽</p>
        <p className="t-sub mb-1">за {psy.minutes} мин</p>
      </div>
      <div className="relative mt-3.5 flex flex-wrap gap-1.5">
        <Fact icon="users" text={`${psy.clients} клиентов`} />
        <Fact icon="calendar" text={`${psy.sessions} сессий`} />
        <Fact icon="spark" text={`${psy.years} ${yearsWord(psy.years)} практики`} />
      </div>
    </motion.div>
  );
}

function Fact({ icon, text }: { icon: IconName; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-black">
      <Icon name={icon} width={12} weight="bold" color="var(--muted)" /> {text}
    </span>
  );
}

// Миниатюра записи: свёрнутая показывает ближайший свободный день,
// раскрытая — выбор дня и времени.
function BookingMini({ psy, tone, onDone }: { psy: Psy; tone: { bg: string; soft: string; edge: string }; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: avail } = useQuery({ queryKey: ["month-avail", psy.id], queryFn: () => getMonthAvailability(psy.id) });
  const nearest = useMemo(() => {
    if (!avail) return null;
    const today = ymdLocal(new Date());
    return Object.keys(avail).filter((day) => day >= today && avail[day] === "free").sort()[0] ?? null;
  }, [avail]);
  const label = nearest
    ? new Date(nearest + "T00:00:00").toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })
    : null;

  return (
    <div className="overflow-hidden rounded-[20px]" style={{ background: tone.soft }}>
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-white">
          <Icon name="calendar" width={21} weight="bold" color={tone.edge} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="t-head block">Записаться</span>
          <span className="t-sub block">{label ? `Ближайшее окно — ${label}` : "Посмотреть свободные окна"}</span>
        </span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} className="arrow"><ArrowGlyph /></motion.span>
      </button>
      <Disclosure open={open} autoScroll={false}>
        <div className="px-4 pb-4">
          <div className="rounded-[14px] bg-white p-3">
            <BookFlow psy={psy} onDone={onDone} />
          </div>
        </div>
      </Disclosure>
    </div>
  );
}

function MethodList({ psy }: { psy: Psy }) {
  const tone = CATALOG_TONE;
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Section title="Методы">
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
        className="grid grid-cols-2 items-start gap-2"
      >
        {psy.methods.map((method) => {
          const expanded = open === method;
          const main = method === psy.method;
          return (
            <motion.button
              key={method}
              layout
              variants={{ hidden: { opacity: 0, y: 10, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 420, damping: 26 } } }}
              onClick={() => { tap(); setOpen(expanded ? null : method); }}
              aria-expanded={expanded}
              className={`rounded-[16px] p-3.5 text-left ${expanded ? "col-span-2" : ""}`}
              style={{ background: main ? tone.soft : "#fff", border: `1px solid ${main ? tone.edge : "var(--edge-neutral)"}` }}
            >
              <motion.span layout="position" className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-white">
                  <Icon name="therapy" width={15} weight="bold" color={tone.edge} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="t-head block truncate">{method}</span>
                  {main && <span className="t-cap block">основной</span>}
                </span>
              </motion.span>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.span
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                    className="block overflow-hidden"
                  >
                    <span className="t-sub mt-2.5 block">{METHOD_DESCRIPTIONS[method] ?? "Метод подбирается под запрос и задачи клиента."}</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </motion.div>
    </Section>
  );
}

function LocationBlock({ psy, details }: { psy: Psy; details: string }) {
  const [open, setOpen] = useState(false);
  if (psy.format === "online") {
    return <Section title="Формат и место"><div className="flex items-start gap-3 panel p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--head-soft)] stroke"><Icon name="video" width={19} weight="bold" /></span><div><p className="text-[13px] font-black">{details}</p><p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">Языки: {psy.languages.join(", ")}</p></div></div></Section>;
  }
  const address = [psy.city, psy.district, psy.metro ? `м. ${psy.metro.replace(/^м\.\s*/i, "")}` : "", psy.publicExactAddress ? psy.address : ""].filter(Boolean).join(", ");
  const routes = [
    { label: "Яндекс", href: `https://yandex.ru/maps/?rtext=~${encodeURIComponent(address)}&rtt=auto` },
    { label: "Google", href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}` },
    { label: "2ГИС", href: `https://2gis.ru/search/${encodeURIComponent(address)}` },
  ];
  return (
    <Section title="Формат и место">
      <div className="overflow-hidden rounded-[18px] bg-white stroke-lg">
        <button onClick={() => { tap(); setOpen((value) => !value); }} className="block w-full text-left" aria-expanded={open}>
          <div className="relative h-[120px] overflow-hidden" style={{ background: "color-mix(in srgb, var(--tiffany-soft) 65%, white)", backgroundImage: "repeating-linear-gradient(0deg, rgba(32,28,24,.05) 0 1px, transparent 1px 22px), repeating-linear-gradient(90deg, rgba(32,28,24,.05) 0 1px, transparent 1px 22px)" }}>
            {/* дороги */}
            <span className="absolute left-0 top-[62%] h-3 w-full -rotate-3 bg-white stroke" />
            <span className="absolute left-[32%] top-0 h-full w-3 rotate-[7deg] bg-white stroke" />
            {/* пин-капля */}
            <motion.span animate={{ y: [0, -5, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} className="absolute left-1/2 top-[34%] flex h-11 w-11 -translate-x-1/2 rotate-45 items-center justify-center rounded-full rounded-bl-none bg-[var(--coral)] stroke-lg" style={{ boxShadow: "0 10px 18px -8px rgba(32,28,24,.5)" }}><Icon name="pin" width={19} weight="fill" className="-rotate-45" /></motion.span>
            <span className="absolute bottom-2 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.06em] stroke"><Icon name="route" width={11} weight="bold" /> Маршрут</span>
          </div>
          <div className="flex items-start gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--head-soft)] stroke"><Icon name="pin" width={17} weight="bold" /></span>
            <div className="min-w-0 flex-1"><p className="text-[13px] font-black leading-snug">{address}</p><p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">{formatLabel(psy.format)} · языки: {psy.languages.join(", ")}</p>{psy.privateAddressAvailable && <p className="mt-1.5 text-[10px] font-semibold text-[var(--muted-2)]">Точный адрес станет доступен после подтверждения очной записи.</p>}</div>
          </div>
        </button>
        <Disclosure open={open} zoom autoScroll={false}>
          <div className="line-top p-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[.07em] text-[var(--muted)]">Построить маршрут</p>
            <div className="grid grid-cols-3 gap-2">{routes.map((route) => <a key={route.label} href={route.href} target="_blank" rel="noopener noreferrer" onClick={success} className="flex items-center justify-center rounded-[11px] bg-[var(--surface-2)] px-2 py-2.5 text-[10px] font-black stroke">{route.label}</a>)}</div>
          </div>
        </Disclosure>
      </div>
    </Section>
  );
}

function TelegramPoster({ psy }: { psy: Psy }) {
  return (
    <div className="relative overflow-hidden rounded-[20px] p-5" style={{ background: "var(--head)" }}>
      <div className="relative flex items-start gap-3.5">
        <span className="ico ico-white h-12 w-12 shrink-0"><Icon name="telegram" width={23} weight="fill" color="var(--edge)" /></span>
        <div><h3 className="font-tight text-[18px] font-black leading-tight">Остались уточняющие вопросы?</h3><p className="mt-1 text-[11.5px] font-bold text-[var(--muted)]">Можете написать специалисту напрямую.</p></div>
      </div>
      <a href={`https://t.me/${psy.tg}`} target="_blank" rel="noopener noreferrer" onClick={success} className="btn relative mt-4 w-full py-3"><Icon name="telegram" width={16} weight="fill" color="#fff" /> Написать в Telegram</a>
    </div>
  );
}

// Голосовое приветствие — демо-слот под будущее аудио специалиста.
function VoiceGreeting({ name }: { name: string }) {
  return (
    <Section title="Голос специалиста">
      <div className="card-soft flex items-center gap-3 p-3.5">
        <span className="ico h-11 w-11 shrink-0 rounded-full" style={{ background: "var(--edge)" }}><Icon name="pulse" width={20} weight="fill" color="#fff" /></span>
        <div className="flex min-w-0 flex-1 items-center gap-[3px]">
          {[10, 18, 13, 22, 16, 26, 14, 20, 11, 24, 15, 19, 12].map((h, k) => <span key={k} className="w-[3px] rounded-full bg-[var(--edge)]" style={{ height: h, opacity: 0.5 + (k % 3) * 0.2 }} />)}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-black leading-none">приветствие</p>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[.06em] text-[var(--muted-2)]">скоро · {name}</p>
        </div>
      </div>
    </Section>
  );
}

// Образование + раскрываемая проверка документов.
function EducationBlock({ psy }: { psy: Psy }) {
  const [open, setOpen] = useState(false);
  return (
    <Section title="Образование">
      <div>
        <ul className="space-y-1.5">{psy.education.map((item) => <li key={item} className="flex gap-2 text-[12px] font-semibold"><Icon name="check" width={15} weight="bold" color="var(--edge)" className="mt-0.5 shrink-0" />{item}</li>)}</ul>
        <button onClick={() => { tap(); setOpen((v) => !v); }} className="mt-3 flex items-center gap-1.5 text-[11px] font-black text-[var(--muted)]" aria-expanded={open}>
          Как проверяются документы <ArrowGlyph className="transition-transform" style={{ transform: open ? "rotate(-90deg)" : "rotate(90deg)" }} />
        </button>
        <Disclosure open={open}>
          <p className="card-soft mt-2 p-3 text-[11px] font-semibold leading-relaxed">Дипломы и сертификаты специалист загружает при регистрации, платформа проверяет их до публикации профиля. Значок «подтверждён» — результат этой проверки, а не оплаты.</p>
        </Disclosure>
      </div>
    </Section>
  );
}

// Правила отмены и связи между сессиями.
function RulesSection({ minutes }: { minutes: number }) {
  const rules: { icon: IconName; tone: string; title: string; text: string }[] = [
    { icon: "clock", tone: "amber", title: "Отмена и перенос", text: "Бесплатно за 24 часа до встречи. Позже — сессия считается состоявшейся." },
    { icon: "note", tone: "purple", title: "Связь между сессиями", text: `Короткие сообщения по договорённости, ответ в рабочее время. Разбор вопросов — на встрече (${minutes} мин).` },
    { icon: "heart", tone: "salmon", title: "Это не экстренная помощь", text: "Чат со специалистом не заменяет кризисную линию. При острой ситуации обратитесь в неотложную службу." },
  ];
  return (
    <Section title="Правила отмены и связи">
      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.title} className="flex items-start gap-3 py-1.5">
            <span className="ico h-8 w-8 shrink-0" style={{ background: `var(--${r.tone}-edge)` }}><Icon name={r.icon} width={15} weight="bold" color="#fff" /></span>
            <div><p className="text-[12.5px] font-black">{r.title}</p><p className="mt-0.5 text-[11px] font-semibold leading-snug text-[var(--muted)]">{r.text}</p></div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PhotoGallery({ psy }: { psy: Psy }) {
  return <Section title="Фотографии"><div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">{psy.photos!.map((photo, index) => { const src = asset(photo); return <div key={`${photo.slice(0, 24)}-${index}`} className="relative h-[174px] w-[132px] shrink-0 snap-start overflow-hidden rounded-[16px] bg-white stroke-lg"><Image src={src} alt={`${psy.name}, фотография ${index + 1}`} fill sizes="132px" className="object-cover" unoptimized={isInlineImage(src)} /></div>; })}</div></Section>;
}

function isInlineImage(src: string) { return /^(data:|blob:)/i.test(src); }

function detailLocation(psy: Psy) {
  if (psy.format === "online") return "Онлайн — можно подключиться из любой точки";
  const place = [psy.city, psy.district, psy.metro ? `м. ${psy.metro.replace(/^м\.\s*/i, "")}` : ""].filter(Boolean).join(" · ");
  const exact = psy.publicExactAddress ? psy.address : "";
  return [formatLabel(psy.format), place, exact].filter(Boolean).join(" · ");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="relative"><p className="t-micro mb-2">{title}</p>{children}</section>; }

const RATING_KEY = "bereg_ratings";
function RatingBlock({ psy, canRate }: { psy: Psy; canRate: boolean }) {
  const [mine, setMine] = useState(0);
  useEffect(() => { try { const ratings = JSON.parse(localStorage.getItem(RATING_KEY) || "{}"); setMine(ratings[psy.id] ?? 0); } catch { /* ignore */ } }, [psy.id]);
  const rate = (value: number) => { success(); setMine(value); try { const ratings = JSON.parse(localStorage.getItem(RATING_KEY) || "{}"); ratings[psy.id] = value; localStorage.setItem(RATING_KEY, JSON.stringify(ratings)); } catch { /* ignore */ } };
  return (
    <Section title="Рейтинг и оценка">
      <div className="overflow-hidden rounded-[20px] bg-[var(--amber-soft)]">
        <div className="flex items-center gap-4 p-4">
          {/* Круговой рейтинг с анимированной дугой */}
          {(() => {
            const C = 2 * Math.PI * 15.5;
            return (
              <div className="relative flex h-[86px] w-[86px] shrink-0 items-center justify-center">
                <svg viewBox="0 0 36 36" className="h-[86px] w-[86px] -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="3.5" />
                  <motion.circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--amber-edge)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={C} initial={{ strokeDashoffset: C }} whileInView={{ strokeDashoffset: C * (1 - psy.rating / 5) }} viewport={{ once: true }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
                </svg>
                <div className="absolute flex flex-col items-center leading-none">
                  <span className="font-tight tnum text-[26px] font-black"><CountUp value={psy.rating} decimals={1} /></span>
                  <span className="text-[8px] font-black uppercase tracking-[.08em] text-[var(--muted)]">из 5</span>
                </div>
              </div>
            );
          })()}
          {/* Распределение оценок — анимированные полосы */}
          <div className="min-w-0 flex-1 space-y-1">
            {(() => {
              const raw = [5, 4, 3, 2, 1].map((s) => Math.max(0.02, 1 - Math.abs(s - psy.rating) * 0.62));
              const sum = raw.reduce((a, b) => a + b, 0);
              return [5, 4, 3, 2, 1].map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className="w-2 text-right text-[9px] font-black text-[var(--muted)]">{s}</span>
                  <Icon name="star" width={9} weight="fill" color="var(--amber-edge)" />
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/70">
                    <motion.div className="h-full rounded-full" style={{ background: "var(--amber-edge)" }} initial={{ width: 0 }} whileInView={{ width: `${Math.round((raw[i] / sum) * 100)}%` }} viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 + i * 0.07 }} />
                  </div>
                </div>
              ));
            })()}
            <p className="pt-0.5 text-[9px] font-black uppercase tracking-[.06em] text-[var(--muted)]">{psy.reviews} отзывов после встреч</p>
          </div>
        </div>
        <div className="border-t bg-white/55 p-4" style={{ borderColor: "var(--amber-edge)" }}>
          {canRate ? <><p className="mb-2 text-center text-[10px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Ваша оценка после встречи</p><div className="flex justify-center gap-2">{[1,2,3,4,5].map((value) => <motion.button key={value} whileTap={{ scale: .78 }} animate={mine === value ? { scale: [1, 1.16, 1] } : { scale: 1 }} onClick={() => rate(value)} className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-white stroke" aria-label={`Оценка ${value}`}><Icon name="star" width={21} weight={mine >= value ? "fill" : "regular"} color="var(--amber-edge)" /></motion.button>)}</div>{mine > 0 && <p className="mt-2 text-center text-[11px] font-black">Спасибо — оценку можно изменить</p>}</> : <p className="text-center text-[11px] font-semibold text-[var(--muted)]">Оценку можно оставить после состоявшейся сессии.</p>}
        </div>
      </div>
    </Section>
  );
}

function BookFlow({ psy, onDone }: { psy: Psy; onDone: () => void }) {
  const qc = useQueryClient();
  const [done, setDone] = useState<{ at: string; format: string } | null>(null);
  const book = useMutation({ mutationFn: ({ iso, format }: { iso: string; format: "online" | "offline" }) => bookSlot(psy, iso, format), onSuccess: (booking) => { success(); setDone({ at: booking.startsAt, format: booking.format }); qc.invalidateQueries({ queryKey: ["my-bookings"] }); qc.invalidateQueries({ queryKey: ["slots"] }); qc.invalidateQueries({ queryKey: ["month-avail"] }); } });
  if (done) return <BookedNext psy={psy} at={done.at} format={done.format} onDone={onDone} />;
  return <><p className="t-micro mb-2">День и окно</p><SlotPicker psyId={psy.id} variant="calendar" showAvail onPick={(iso, format) => book.mutate({ iso, format })} /></>;
}

// Что делать сразу после записи. Для новичка это первый экран приложения:
// сначала подтверждаем встречу, потом мягко объясняем, зачем оставаться.
function BookedNext({ psy, at, format, onDone }: { psy: Psy; at: string; format: string; onDone: () => void }) {
  const psyName = psy.name;
  const [attached, setAttached] = useState(() => isAttached(psyName));
  const date = new Date(at);
  const place = [psy.city, psy.district, psy.metro ? `м. ${psy.metro.replace(/^м\.\s*/i, "")}` : ""].filter(Boolean).join(" · ");
  const finishFastEntry = () => window.dispatchEvent(new CustomEvent("bereg-fast-entry-complete"));
  const attach = () => { success(); attachTherapist(psyName, psy.id); setAttached(true); };

  return (
    <div>
      <div className="text-center">
        <span className="ico ico-accent mx-auto flex h-12 w-12"><Icon name="check" width={24} weight="bold" color="#fff" /></span>
        <p className="t-head mt-2">Вы записаны к {psyName.split(" ")[0]}</p>
        <p className="t-cap mt-1">
          {date.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })} в {date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} · {format === "online" ? "онлайн" : "очно"}
        </p>
      </div>

      {/* Куда приходить или чего ждать. Очно — адрес специалиста, онлайн —
          ссылка придёт от него же: сами мы её не генерируем. */}
      <div className="card-soft mt-3 flex items-start gap-3 p-3.5" style={{ background: format === "online" ? "var(--purple-soft)" : "var(--green-soft)" }}>
        <span className="ico h-9 w-9 shrink-0" style={{ background: "#fff" }}>
          <Icon name={format === "online" ? "video" : "pin"} width={17} weight="bold" color={format === "online" ? "var(--purple)" : "var(--green)"} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="t-head block leading-tight">{format === "online" ? "Встреча пройдёт онлайн" : "Очная встреча"}</span>
          {format === "online" ? (
            <span className="t-sub mt-1 block">{psyName.split(" ")[0]} пришлёт ссылку для подключения до начала сессии — она появится здесь и в напоминании.</span>
          ) : psy.address ? (
            <>
              <span className="t-sub mt-1 block">{psy.address}</span>
              {place && <span className="t-cap mt-0.5 block">{place}</span>}
            </>
          ) : (
            <>
              {place && <span className="t-sub mt-1 block">{place}</span>}
              <span className="t-cap mt-0.5 block">Точный адрес {psyName.split(" ")[0]} пришлёт перед встречей.</span>
            </>
          )}
        </span>
      </div>

      {/* Главный следующий шаг — прикрепить специалиста: без этого раздел
          «Терапия» пустой и человеку непонятно, ради чего оставаться. */}
      <div className="card-soft mt-4 p-3.5">
        <p className="t-micro">Что дальше</p>
        <p className="t-head mt-1 leading-tight">{attached ? `${psyName.split(" ")[0]} в вашей терапии` : "Добавьте специалиста в «Терапию»"}</p>
        <p className="t-sub mt-1">
          {attached
            ? "Встречи, задания и отметки настроения теперь собираются в одном разделе — специалист видит их к сессии."
            : "Тогда встречи, задания и настроение будут собираться в одном месте, а специалист увидит вашу динамику к следующей встрече."}
        </p>
        {!attached && <button onClick={attach} className="btn btn-accent mt-3 w-full py-2.5"><Icon name="plus" width={15} weight="bold" color="#fff" /> Добавить в мою терапию</button>}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Link href="/therapy" onClick={finishFastEntry} className="btn w-full py-2.5 text-[12px]">Открыть терапию</Link>
        <button onClick={() => { finishFastEntry(); onDone(); }} className="btn btn-white w-full py-2.5 text-[12px]">Осмотреться</button>
      </div>
      <p className="t-cap mt-2 text-center">Ничего настраивать не нужно — приложение покажет остальное по ходу.</p>
    </div>
  );
}
