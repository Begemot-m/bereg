"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  personalSelection,
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

  // Прямой переход на страницу специалиста: /catalog?psy=<id>
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("psy"));
    if (id) {
      const psy = PSYS.find((item) => item.id === id);
      if (psy) { setSelected(psy); setSurveyOpen(false); }
    }
  }, []);

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

  if (selected) return <PsyDetailView psy={selected} prefs={prefs} onBack={() => setSelected(null)} />;

  return (
    <div className="-mx-4 -mt-6 @md:-mx-9">
      <header className="px-4 pb-14 pt-8 @md:px-9" style={{ background: "var(--page)" }}>
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.14em]">Психологи платформы</p><div className="mt-1 flex items-center gap-2.5"><span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white stroke-lg"><Icon name="compass" width={22} weight="bold" /></span><h1 className="font-tight text-[31px] font-black leading-none">Каталог</h1></div><p className="mt-2 max-w-[250px] text-[12px] font-bold leading-snug text-[var(--muted)]">Не рейтинг лучших, а специалисты, которые подходят именно вам.</p></div>
          <button onClick={() => { tap(); setSurveyOpen(true); }} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#fffdf7] stroke-lg" aria-label="Настроить подборку"><Icon name="sort" width={23} weight="bold" /></button>
        </div>
      </header>

      <main className="relative -mt-8 min-h-[72vh] rounded-t-[30px] bg-[#fffdf7] px-4 pb-9 pt-4 @md:px-9" style={{ borderTop: "var(--bw-lg) solid var(--edge-neutral)" }}>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-white p-1 stroke-lg">
          {([{ id: "personal", label: "Для вас" }, { id: "all", label: "Все специалисты" }] as { id: CatalogMode; label: string }[]).map((tab) => <button key={tab.id} onClick={() => switchMode(tab.id)} className="rounded-full px-2 py-2 text-[11px] font-black transition-colors" style={mode === tab.id ? { background: "var(--ink)", color: "#fff" } : { color: "var(--muted)" }}>{tab.label}</button>)}
        </div>

        {mode === "all" && <AllControls filters={filters} setFilters={(next) => { setFilters(next); setPage(0); }} sort={sort} setSort={(next) => { setSort(next); setPage(0); }} activeFilters={activeFilters} openFilters={() => setFiltersOpen(true)} />}

        <div className="mb-3 mt-5 flex items-end justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">{mode === "personal" ? "Персональная подборка" : `${allFiltered.length} специалистов`}</p><h2 className="font-tight mt-0.5 text-[21px] font-black">{mode === "personal" ? "Специалисты для вас" : `Страница ${Math.min(page + 1, pageCount)} из ${pageCount}`}</h2></div>
          {mode === "personal" && <button onClick={() => setSurveyOpen(true)} className="shrink-0 rounded-full bg-[var(--olive-soft)] px-3 py-1.5 text-[10px] font-black stroke">Изменить</button>}
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
  return <Reveal delay={.03}><div className="mt-4 space-y-2"><label className="flex items-center gap-2 rounded-[15px] bg-white px-3.5 py-2.5 stroke"><Icon name="compass" width={16} color="var(--muted)" /><input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Имя, подход или запрос" className="min-w-0 flex-1 bg-transparent text-[13px] font-bold outline-none placeholder:font-semibold placeholder:text-[var(--muted-2)]" />{filters.query && <button onClick={() => setFilters({ ...filters, query: "" })} className="font-black text-[var(--muted)]" aria-label="Очистить поиск">×</button>}</label><div className="flex gap-2"><button onClick={openFilters} className="relative flex flex-1 items-center justify-center gap-1.5 rounded-[13px] bg-white px-3 py-2 text-[11px] font-black stroke"><Icon name="filter" width={15} weight="bold" /> Фильтры{activeFilters > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--coral)] px-1 text-[10px] stroke">{activeFilters}</span>}</button><label className="flex flex-[1.35] items-center gap-1.5 rounded-[13px] bg-white px-3 py-2 stroke"><Icon name="sort" width={15} weight="bold" /><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="min-w-0 flex-1 bg-transparent text-[11px] font-black outline-none">{SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div></div></Reveal>;
}

function PsyCard({ psy, onOpen }: { psy: Psy; onOpen: () => void }) {
  const portrait = asset(psy.portrait);
  const helps = psy.helps ?? psy.topics.slice(0, 3).join(", ");
  const soon = psy.nextDays <= 3;

  return (
    <button onClick={onOpen} className="w-full overflow-hidden rounded-[24px] bg-white text-left transition-transform duration-200 active:scale-[.99]" style={{ border: "var(--bw-lg) solid var(--edge-neutral)", boxShadow: "0 16px 32px -22px rgba(32,28,24,.42)" }}>
      <div className="flex gap-3.5 p-4">
        <div className="relative h-[132px] w-[106px] shrink-0 overflow-hidden rounded-[18px]" style={{ border: "var(--bw-lg) solid var(--olive-edge)", background: "var(--olive-soft)" }}>
          <Image src={portrait} alt={`Портрет: ${psy.name}`} fill sizes="106px" className="object-cover" priority={psy.id <= 3} unoptimized={isInlineImage(portrait)} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1.5">
            <h3 className="min-w-0 text-[17px] font-black leading-[1.06]">{psy.name}</h3>
            {psy.verified && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--green-soft)]" style={{ border: "1.5px solid var(--green-edge)" }} title="Профиль подтверждён"><Icon name="check" width={12} weight="fill" color="var(--green-edge)" /></span>}
          </div>
           <p className="mt-1.5 text-[12.5px] font-bold leading-snug"><span className="text-[var(--muted)]">Помогаю с </span>{helps}</p>
           {psy.quote && <p className="mt-2 border-l-2 pl-2.5 text-[11.5px] font-semibold italic leading-snug text-[var(--muted)]" style={{ borderColor: "var(--olive-edge)" }}>«{psy.quote}»</p>}
         </div>
       </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 text-[11px] font-black">
        <span className="inline-flex items-center gap-1"><Icon name="star" width={14} weight="fill" color="var(--amber-edge)" /> {psy.rating.toFixed(1)} <span className="font-bold text-[var(--muted)]">({psy.reviews})</span></span>
        <span className="rounded-full bg-[var(--olive-soft)] px-2 py-1" style={{ border: "1.5px solid var(--olive-edge)" }}>{psy.method}</span>
        <span className="text-[var(--muted)]">{psy.years} {yearsWord(psy.years)} практики</span>
      </div>

      {/* Стоимость + ближайшее окно + переход к профилю */}
      <div className="mt-1 flex items-center gap-2 border-t px-4 py-3" style={{ borderColor: "var(--edge-neutral)" }}>
        <div className="min-w-0">
          <p className="text-[15px] font-black leading-none">{psy.price.toLocaleString("ru-RU")} ₽<span className="text-[11px] font-bold text-[var(--muted)]"> / {psy.minutes} мин</span></p>
          <p className="mt-1 flex items-center gap-1 text-[10px] font-black" style={{ color: soon ? "var(--olive-edge)" : "var(--muted)" }}><Icon name="calendar" width={11} weight="bold" /> {nextSlotLabel(psy.nextDays)}</p>
        </div>
        <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-[var(--ink)] px-4 py-2.5 text-[12px] font-black text-white">Посмотреть и записаться →</span>
      </div>
    </button>
  );
}

function CatalogEmpty({ filters, onRelax }: { filters: CatalogFilters; onRelax: () => void }) {
  const blocker = filters.thisWeek ? "свободное окно на этой неделе" : filters.maxPrice ? `цена до ${filters.maxPrice.toLocaleString("ru-RU")} ₽` : "выбранные условия";
  return <div className="rounded-[22px] bg-[var(--amber-soft)] p-5 text-center stroke-lg" style={{ borderColor: "var(--amber-edge)" }}><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[15px] bg-white stroke"><Icon name="compass" width={23} weight="bold" /></div><h3 className="font-tight mt-3 text-[19px] font-black">Точных совпадений нет</h3><p className="mt-1 text-[12px] font-semibold text-[var(--muted)]">Сильнее всего ограничивает: {blocker}.</p><Button className="mt-4" onClick={onRelax}>Ослабить условие</Button></div>;
}

function Portrait({ psy, size }: { psy: Psy; size: number }) { const tone = T[psy.tone]; const portrait = asset(psy.portrait); return <div className="relative shrink-0 overflow-hidden rounded-[20px]" style={{ width: size, height: Math.round(size * 1.12), border: `var(--bw-lg) solid ${tone.edge}`, background: tone.soft }}><Image src={portrait} alt={`Портрет: ${psy.name}`} fill sizes={`${size}px`} className="object-cover" priority unoptimized={isInlineImage(portrait)} /></div>; }

// Кнопка «добавить терапевта в мой раздел Терапия» — вверху анкеты.
function AttachTherapistButton({ name }: { name: string }) {
  const [attached, setAttached] = useState(() => isAttached(name));
  const add = () => { if (attached) return; success(); attachTherapist(name); setAttached(true); };
  return (
    <button onClick={add} disabled={attached} className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[15px] px-3 text-[12px] font-black transition-transform active:scale-[0.98] disabled:active:scale-100" style={attached ? { background: "var(--green-soft)", border: "var(--bw-lg) solid var(--green-edge)" } : { background: "var(--olive)", border: "var(--bw-lg) solid var(--olive-edge)" }}>
      {attached ? <><Icon name="check" width={16} weight="bold" color="var(--green-edge)" /> В вашей терапии</> : <><Icon name="plus" width={16} weight="bold" /> В мою терапию</>}
    </button>
  );
}

function PsyDetailView({ psy, prefs, onBack }: { psy: Psy; prefs: CatalogPrefs; onBack: () => void }) {
  const tone = T[psy.tone];
  const { data: bookings = [] } = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings });
  const wasInTherapy = bookings.some((booking) => booking.psyName === psy.name);
  const reasons = reasonsFor(psy, prefs);
  const details = detailLocation(psy);
  const firstSession = psy.firstSession ?? "На первой встрече знакомимся, обсуждаем ваш запрос и то, какой поддержки вы ждёте. В конце сверяемся — комфортно ли вам продолжать. Ничего решать сразу не нужно.";
  const toBooking = () => { tap(); document.getElementById("book-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  return <div>
    <div className="-mx-4 -mt-2 px-4 pb-16 pt-2 @md:-mx-9 @md:px-9" style={{ background: tone.soft }}>
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-[13px] font-bold text-[var(--muted)]">← Каталог</button>
      <div className="flex items-center gap-3">
        <Portrait psy={psy} size={98} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5"><h1 className="font-tight text-[21px] font-black leading-[1.02]">{psy.name}</h1>{psy.verified && <Icon name="check" width={18} weight="fill" color="var(--green-edge)" />}</div>
          <p className="mt-1.5 text-[11px] font-black text-[var(--muted)]">{psy.method} · {psy.years} {yearsWord(psy.years)} практики</p>
          {psy.style && <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-black" style={{ border: `1.5px solid ${tone.edge}` }}><Icon name="spark" width={11} weight="fill" /> стиль: {psy.style}</span>}
        </div>
      </div>
    </div>

    <div className="-mx-4 -mt-9 space-y-5 rounded-t-[30px] bg-[#fffaf0] px-4 pb-10 pt-5 @md:-mx-9 @md:px-9" style={{ borderTop: "var(--bw-lg) solid var(--edge-neutral)", backgroundImage: `linear-gradient(180deg, ${tone.soft} 0, #fffaf0 180px)` }}>
      <div className="flex gap-2">
        <AttachTherapistButton name={psy.name} />
        <a href={`https://t.me/${psy.tg}`} target="_blank" rel="noopener noreferrer" onClick={tap} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-white stroke-lg" aria-label={`Написать ${psy.name} в Telegram`}><Icon name="telegram" width={21} weight="fill" /></a>
      </div>

      {/* Почему предложен именно этому пользователю */}
      {reasons.length > 0 && <Section title="Почему подходит именно вам"><div className="rounded-[18px] bg-[var(--green-soft)] p-3.5 stroke-lg" style={{ borderColor: "var(--green-edge)" }}><ul className="space-y-1.5">{reasons.map((reason) => <li key={reason} className="flex items-start gap-2 text-[12.5px] font-bold"><Icon name="check" width={14} weight="bold" color="var(--green-edge)" className="mt-0.5 shrink-0" />{reason}</li>)}</ul></div></Section>}

      <Section title="Особенно хорошо помогает"><div className="flex flex-wrap gap-1.5 rounded-[18px] bg-white p-4 stroke-lg">{psy.topics.map((topic) => <span key={topic} className="rounded-full bg-[var(--olive-soft)] px-2.5 py-1 text-[11px] font-black" style={{ border: `1.5px solid var(--olive-edge)` }}>{topic}</span>)}</div></Section>

      <PracticeStats psy={psy} />
      <button onClick={toBooking} className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[var(--ink)] py-3.5 text-[14px] font-black text-white transition-transform active:scale-[0.99]"><Icon name="calendar" width={16} weight="bold" color="#fff" /> Посмотреть свободные окна</button>

      {/* Как проходит первая встреча */}
      <Section title="Как проходит первая встреча"><div className="rounded-[18px] bg-[var(--purple-soft)] p-4 stroke-lg" style={{ borderColor: "var(--purple-edge)" }}><p className="text-[13px] font-semibold leading-relaxed">{firstSession}</p></div></Section>

      {/* Голосовое приветствие (демо-слот) */}
      <VoiceGreeting name={psy.name.split(" ")[0]} />

      {/* Подход и пример работы — без обещаний результата */}
      {psy.about && <Section title="Как я работаю"><p className="text-[13px] font-semibold leading-relaxed">{psy.about}</p></Section>}
      <MethodList psy={psy} />

      {(psy.photos?.length ?? 0) > 1 && <PhotoGallery psy={psy} />}

      <LocationBlock psy={psy} details={details} />

      {/* Образование с раскрываемой проверкой документов */}
      {psy.education.length > 0 && <EducationBlock psy={psy} />}

      {/* Темы, с которыми специалист не работает */}
      {(psy.avoids?.length ?? 0) > 0 && <Section title="С чем не работает"><div className="rounded-[18px] bg-white p-4 stroke-lg"><div className="flex flex-wrap gap-1.5">{psy.avoids!.map((topic) => <span key={topic} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-bold text-[var(--muted)]" style={{ border: "1.5px solid var(--edge-neutral)" }}>{topic}</span>)}</div><p className="mt-2.5 text-[10.5px] font-semibold text-[var(--muted-2)]">Если ваш запрос из этого списка — специалист подскажет, к кому обратиться.</p></div></Section>}

      {/* Отзывы — только после подтверждённых встреч */}
      <RatingBlock psy={psy} canRate={wasInTherapy} />

      {/* Правила отмены и связи между сессиями */}
      <RulesSection minutes={psy.minutes} />

      {/* Постоянная запись */}
      <div id="book-section"><Section title="Записаться · ближайшие окна"><div className="rounded-[18px] bg-white p-4 stroke-lg"><BookFlow psyName={psy.name} onDone={onBack} /></div></Section></div>
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

function PracticeStats({ psy }: { psy: Psy }) {
  const stats = [
    { value: psy.sessions, suffix: "", label: "сессий проведено", icon: "calendar" as IconName },
    { value: psy.clients, suffix: "", label: "клиентов", icon: "users" as IconName },
    { value: psy.years, suffix: "", label: "лет практики", icon: "therapy" as IconName },
    { value: psy.rating, suffix: "", label: `${psy.reviews} отзывов`, icon: "star" as IconName, decimals: 1 },
    { value: psy.responseHrs, suffix: " ч", label: "обычно отвечает", icon: "clock" as IconName },
  ];
  return (
    <motion.section initial="hidden" whileInView="show" viewport={{ once: true, amount: .25 }} variants={{ hidden: {}, show: { transition: { staggerChildren: .07 } } }} className="overflow-hidden rounded-[22px] bg-[var(--ink)] text-white stroke-lg">
      <div className="grid grid-cols-2 border-b border-white/20">
        <div className="p-4"><p className="text-[9px] font-black uppercase tracking-[.09em] text-white/60">Встреча</p><p className="font-tight mt-1 text-[24px] font-black">{psy.price.toLocaleString("ru-RU")} ₽</p></div>
        <div className="border-l border-white/20 p-4"><p className="text-[9px] font-black uppercase tracking-[.09em] text-white/60">Длительность</p><p className="font-tight mt-1 text-[24px] font-black">{psy.minutes} мин</p></div>
      </div>
      <div className="grid grid-cols-2">
        {stats.map((stat, index) => (
          <motion.div key={stat.label} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 420, damping: 24 } } }} className={`p-3.5 ${index % 2 ? "border-l border-white/15" : ""} ${index < 4 ? "border-b border-white/15" : ""} ${index === 4 ? "col-span-2 flex items-center gap-3" : ""}`}>
            <Icon name={stat.icon} width={16} weight="fill" color="var(--olive)" />
            <p className="font-tight tnum mt-1 text-[20px] font-black leading-none"><CountUp value={stat.value} decimals={stat.decimals} />{stat.suffix}</p>
            <p className={`mt-1 text-[9px] font-bold uppercase tracking-[.04em] text-white/55 ${index === 4 ? "ml-auto" : ""}`}>{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

function MethodList({ psy }: { psy: Psy }) {
  const tone = T[psy.tone];
  const [open, setOpen] = useState<string | null>(psy.method);
  return (
    <Section title="Методы">
      <div className="space-y-2">
        {psy.methods.map((method) => {
          const expanded = open === method;
          return (
            <div key={method} className="overflow-hidden rounded-[17px] bg-white stroke">
              <button onClick={() => { tap(); setOpen(expanded ? null : method); }} className="flex w-full items-center gap-2 p-3 text-left" aria-expanded={expanded}>
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] stroke" style={{ background: tone.soft, borderColor: tone.edge }}><Icon name="therapy" width={15} weight="bold" /></span>
                <p className="min-w-0 flex-1 text-[13px] font-black">{method}{method === psy.method ? " · основной" : ""}</p>
                <motion.span animate={{ rotate: expanded ? 45 : 0 }} className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-2)] stroke"><Icon name="plus" width={13} weight="bold" /></motion.span>
              </button>
              <Disclosure open={expanded} zoom autoScroll={false}>
                <p className="px-3 pb-3 text-[11px] font-semibold leading-relaxed text-[var(--muted)]">{METHOD_DESCRIPTIONS[method] ?? "Метод подбирается под запрос и задачи клиента."}</p>
              </Disclosure>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function LocationBlock({ psy, details }: { psy: Psy; details: string }) {
  const [open, setOpen] = useState(false);
  if (psy.format === "online") {
    return <Section title="Формат и место"><div className="flex items-start gap-3 rounded-[18px] bg-white p-4 stroke-lg"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--head-soft)] stroke"><Icon name="video" width={19} weight="bold" /></span><div><p className="text-[13px] font-black">{details}</p><p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">Языки: {psy.languages.join(", ")}</p></div></div></Section>;
  }
  const address = [psy.city, psy.district, psy.metro ? `м. ${psy.metro.replace(/^м\.\s*/i, "")}` : "", psy.publicExactAddress ? psy.address : ""].filter(Boolean).join(", ");
  const routes = [
    { label: "Яндекс", href: `https://yandex.ru/maps/?rtext=~${encodeURIComponent(address)}&rtt=auto` },
    { label: "Google", href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}` },
    { label: "2ГИС", href: `https://2gis.ru/search/${encodeURIComponent(address)}` },
  ];
  return (
    <Section title="Формат и место">
      <div className="overflow-hidden rounded-[20px] bg-white stroke-lg">
        <button onClick={() => { tap(); setOpen((value) => !value); }} className="block w-full text-left" aria-expanded={open}>
          <div className="relative h-[116px] overflow-hidden" style={{ background: "color-mix(in srgb, var(--sky) 55%, white)" }}>
            <span className="absolute -left-8 top-8 h-4 w-[130%] -rotate-6 bg-white/80 stroke" />
            <span className="absolute left-[42%] -top-8 h-[180%] w-4 rotate-[18deg] bg-white/80 stroke" />
            <span className="absolute -bottom-2 left-5 h-3 w-[90%] rotate-[9deg] bg-white/70 stroke" />
            <motion.span animate={{ y: [0, -5, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} className="absolute left-[58%] top-[35%] flex h-12 w-12 items-center justify-center rounded-full bg-[var(--coral)] stroke-lg" style={{ boxShadow: "0 8px 16px -8px rgba(32,28,24,.55)" }}><Icon name="route" width={24} weight="fill" /></motion.span>
            <span className="absolute bottom-2 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.06em] stroke">Нажмите для маршрута</span>
          </div>
          <div className="flex items-start gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[var(--head-soft)] stroke"><Icon name="pin" width={17} weight="bold" /></span>
            <div className="min-w-0 flex-1"><p className="text-[13px] font-black leading-snug">{address}</p><p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">{formatLabel(psy.format)} · языки: {psy.languages.join(", ")}</p>{psy.privateAddressAvailable && <p className="mt-1.5 text-[10px] font-semibold text-[var(--muted-2)]">Точный адрес станет доступен после подтверждения очной записи.</p>}</div>
          </div>
        </button>
        <Disclosure open={open} zoom autoScroll={false}>
          <div className="border-t p-3" style={{ borderColor: "var(--edge-neutral)" }}>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[.07em] text-[var(--muted)]">Построить маршрут</p>
            <div className="grid grid-cols-3 gap-2">{routes.map((route) => <a key={route.label} href={route.href} target="_blank" rel="noopener noreferrer" onClick={success} className="flex items-center justify-center rounded-[12px] bg-[var(--surface-2)] px-2 py-2.5 text-[10px] font-black stroke">{route.label}</a>)}</div>
          </div>
        </Disclosure>
      </div>
    </Section>
  );
}

function TelegramPoster({ psy }: { psy: Psy }) {
  return (
    <div className="relative overflow-hidden rounded-[22px] bg-[var(--purple)] p-5 stroke-lg" style={{ borderColor: "var(--purple-edge)" }}>
      <motion.span aria-hidden className="absolute -right-7 -top-8 h-24 w-24 rounded-full bg-white/20" animate={{ y: [0, 8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} />
      <div className="relative flex items-start gap-3.5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-white stroke-lg"><Icon name="telegram" width={23} weight="fill" color="var(--purple-edge)" /></span>
        <div><h3 className="font-tight text-[18px] font-black leading-tight">Остались уточняющие вопросы?</h3><p className="mt-1 text-[11.5px] font-bold text-[var(--muted)]">Можете написать специалисту напрямую.</p></div>
      </div>
      <a href={`https://t.me/${psy.tg}`} target="_blank" rel="noopener noreferrer" onClick={success} className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--ink)] py-3 text-[13px] font-black text-white"><Icon name="telegram" width={16} weight="fill" color="#fff" /> Написать в Telegram</a>
    </div>
  );
}

// Голосовое приветствие — демо-слот под будущее аудио специалиста.
function VoiceGreeting({ name }: { name: string }) {
  return (
    <Section title="Голос специалиста">
      <div className="flex items-center gap-3 rounded-[18px] bg-white p-3.5 stroke-lg">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--olive)]" style={{ border: "var(--bw-lg) solid var(--olive-edge)" }}><Icon name="pulse" width={20} weight="fill" /></span>
        <div className="flex min-w-0 flex-1 items-center gap-[3px]">
          {[10, 18, 13, 22, 16, 26, 14, 20, 11, 24, 15, 19, 12].map((h, k) => <span key={k} className="w-[3px] rounded-full bg-[var(--olive-edge)]" style={{ height: h, opacity: 0.5 + (k % 3) * 0.2 }} />)}
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
      <div className="rounded-[18px] bg-white p-4 stroke-lg">
        <ul className="space-y-1.5">{psy.education.map((item) => <li key={item} className="flex gap-2 text-[12px] font-semibold"><Icon name="check" width={15} weight="bold" color="var(--green-edge)" className="mt-0.5 shrink-0" />{item}</li>)}</ul>
        <button onClick={() => { tap(); setOpen((v) => !v); }} className="mt-3 flex items-center gap-1.5 text-[11px] font-black text-[var(--muted)]" aria-expanded={open}>
          <Icon name="check" width={13} weight="bold" color="var(--green-edge)" /> Как проверяются документы <span className="transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }}>⌄</span>
        </button>
        <Disclosure open={open}>
          <p className="mt-2 rounded-[12px] bg-[var(--green-soft)] p-3 text-[11px] font-semibold leading-relaxed" style={{ border: "1.5px solid var(--green-edge)" }}>Дипломы и сертификаты специалист загружает при регистрации, платформа проверяет их до публикации профиля. Значок «подтверждён» — результат этой проверки, а не оплаты.</p>
        </Disclosure>
      </div>
    </Section>
  );
}

// Правила отмены и связи между сессиями.
function RulesSection({ minutes }: { minutes: number }) {
  const rules: { icon: IconName; title: string; text: string }[] = [
    { icon: "clock", title: "Отмена и перенос", text: "Бесплатно за 24 часа до встречи. Позже — сессия считается состоявшейся." },
    { icon: "note", title: "Связь между сессиями", text: `Короткие сообщения по договорённости, ответ в рабочее время. Разбор вопросов — на встрече (${minutes} мин).` },
    { icon: "heart", title: "Это не экстренная помощь", text: "Чат со специалистом не заменяет кризисную линию. При острой ситуации обратитесь в неотложную службу." },
  ];
  return (
    <Section title="Правила отмены и связи">
      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.title} className="flex items-start gap-3 rounded-[16px] bg-white p-3.5 stroke">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--head-soft)] stroke"><Icon name={r.icon} width={15} weight="bold" /></span>
            <div><p className="text-[12.5px] font-black">{r.title}</p><p className="mt-0.5 text-[11px] font-semibold leading-snug text-[var(--muted)]">{r.text}</p></div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PhotoGallery({ psy }: { psy: Psy }) {
  return <Section title="Фотографии"><div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">{psy.photos!.map((photo, index) => { const src = asset(photo); return <div key={`${photo.slice(0, 24)}-${index}`} className="relative h-[174px] w-[132px] shrink-0 snap-start overflow-hidden rounded-[18px] bg-white stroke-lg"><Image src={src} alt={`${psy.name}, фотография ${index + 1}`} fill sizes="132px" className="object-cover" unoptimized={isInlineImage(src)} /></div>; })}</div></Section>;
}

function isInlineImage(src: string) { return /^(data:|blob:)/i.test(src); }

function detailLocation(psy: Psy) {
  if (psy.format === "online") return "Онлайн — можно подключиться из любой точки";
  const place = [psy.city, psy.district, psy.metro ? `м. ${psy.metro.replace(/^м\.\s*/i, "")}` : ""].filter(Boolean).join(" · ");
  const exact = psy.publicExactAddress ? psy.address : "";
  return [formatLabel(psy.format), place, exact].filter(Boolean).join(" · ");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="relative"><div className="mb-2 flex items-center gap-2"><p className="text-[10px] font-black uppercase tracking-[.07em] text-[var(--muted)]">{title}</p><span className="h-px flex-1 bg-gradient-to-r from-[var(--edge-neutral)] to-transparent" /></div>{children}</section>; }

const RATING_KEY = "bereg_ratings";
function RatingBlock({ psy, canRate }: { psy: Psy; canRate: boolean }) {
  const [mine, setMine] = useState(0);
  useEffect(() => { try { const ratings = JSON.parse(localStorage.getItem(RATING_KEY) || "{}"); setMine(ratings[psy.id] ?? 0); } catch { /* ignore */ } }, [psy.id]);
  const rate = (value: number) => { success(); setMine(value); try { const ratings = JSON.parse(localStorage.getItem(RATING_KEY) || "{}"); ratings[psy.id] = value; localStorage.setItem(RATING_KEY, JSON.stringify(ratings)); } catch { /* ignore */ } };
  return (
    <Section title="Рейтинг и оценка">
      <div className="overflow-hidden rounded-[20px] bg-[var(--amber-soft)] stroke-lg" style={{ borderColor: "var(--amber-edge)" }}>
        <div className="flex items-center gap-4 p-4">
          <div><p className="font-tight tnum text-[34px] font-black leading-none"><CountUp value={psy.rating} decimals={1} /></p><p className="mt-1 text-[10px] font-black text-[var(--muted)]">{psy.reviews} отзывов</p></div>
          <div className="flex flex-1 justify-end gap-1">
            {[1,2,3,4,5].map((value) => <motion.span key={value} initial={{ scale: 0, rotate: -20 }} whileInView={{ scale: 1, rotate: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 420, damping: 24, delay: value * .06 }}><Icon name="star" width={24} weight={value <= Math.round(psy.rating) ? "fill" : "regular"} color="var(--amber-edge)" /></motion.span>)}
          </div>
        </div>
        <div className="border-t bg-white/55 p-4" style={{ borderColor: "var(--amber-edge)" }}>
          {canRate ? <><p className="mb-2 text-center text-[10px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Ваша оценка после встречи</p><div className="flex justify-center gap-2">{[1,2,3,4,5].map((value) => <motion.button key={value} whileTap={{ scale: .78 }} animate={mine === value ? { scale: [1, 1.16, 1] } : { scale: 1 }} onClick={() => rate(value)} className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white stroke" aria-label={`Оценка ${value}`}><Icon name="star" width={21} weight={mine >= value ? "fill" : "regular"} color="var(--amber-edge)" /></motion.button>)}</div>{mine > 0 && <p className="mt-2 text-center text-[11px] font-black">Спасибо — оценку можно изменить</p>}</> : <p className="text-center text-[11px] font-semibold text-[var(--muted)]">Оценку можно оставить после состоявшейся сессии.</p>}
        </div>
      </div>
    </Section>
  );
}

function BookFlow({ psyName, onDone }: { psyName: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [done, setDone] = useState<{ at: string; format: string } | null>(null);
  const book = useMutation({ mutationFn: ({ iso, format }: { iso: string; format: "online" | "offline" }) => bookSlot(psyName, iso, format), onSuccess: (booking) => { success(); setDone({ at: booking.startsAt, format: booking.format }); qc.invalidateQueries({ queryKey: ["my-bookings"] }); qc.invalidateQueries({ queryKey: ["slots"] }); qc.invalidateQueries({ queryKey: ["month-avail"] }); } });
  if (done) { const date = new Date(done.at); const finishFastEntry = () => window.dispatchEvent(new CustomEvent("bereg-fast-entry-complete")); return <div className="text-center"><p className="text-[14px] font-black">Вы записаны к {psyName}</p><p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">{date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} в {date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} · {done.format === "online" ? "онлайн" : "очно"}</p><div className="mt-3 flex justify-center gap-2"><Link href="/sessions" onClick={finishFastEntry}><Button size="sm" variant="soft">Мои сессии</Button></Link><Button size="sm" variant="ghost" onClick={() => { finishFastEntry(); onDone(); }}>Готово</Button></div></div>; }
  return <><p className="mb-2 text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">День и окно</p><SlotPicker forClient variant="calendar" showAvail onPick={(iso, format) => book.mutate({ iso, format })} /></>;
}
