"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CatalogFiltersSheet, CatalogSurvey } from "@/components/catalog-controls";
import { Icon } from "@/components/icons";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { SlotPicker } from "@/components/slot-picker";
import { Button, Input } from "@/components/ui";
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
      <header className="bg-[var(--olive)] px-4 pb-14 pt-8 @md:px-9" style={{ borderBottom: "var(--bw-lg) solid var(--olive-edge)" }}>
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.14em]">Психологи платформы</p><h1 className="font-tight mt-1 text-[31px] font-black leading-none">Каталог</h1><p className="mt-2 max-w-[250px] text-[12px] font-bold leading-snug text-[var(--muted)]">Не рейтинг лучших, а специалисты, которые подходят именно вам.</p></div>
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

        {visible.length ? <Stagger className="space-y-3">{visible.map((psy) => <StaggerItem key={psy.id}><PsyCard psy={psy} prefs={prefs} showReason={mode !== "all" || sort === "recommended"} onOpen={() => { tap(); setSelected(psy); }} /></StaggerItem>)}</Stagger> : <CatalogEmpty filters={filters} onRelax={() => { setFilters({ ...filters, maxPrice: null, thisWeek: false }); setPage(0); }} />}

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

function PsyCard({ psy, prefs, showReason, onOpen }: { psy: Psy; prefs: CatalogPrefs; showReason: boolean; onOpen: () => void }) {
  const reasons = reasonsFor(psy, prefs);
  const place = catalogLocation(psy);
  const portrait = asset(psy.portrait);
  const topics = topicsForCard(psy, prefs);
  return <button onClick={onOpen} className="w-full overflow-hidden rounded-[24px] bg-white text-left transition-transform active:scale-[.99] stroke-lg">
    <div className="flex gap-3 p-3">
      <div className="relative h-[128px] w-[104px] shrink-0 overflow-hidden rounded-[18px]" style={{ border: "var(--bw-lg) solid var(--olive-edge)", background: "var(--olive-soft)" }}><Image src={portrait} alt={`Портрет: ${psy.name}`} fill sizes="104px" className="object-cover" priority={psy.id <= 3} unoptimized={isInlineImage(portrait)} /></div>
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <div className="flex items-start gap-1">
          <h3 className="min-w-0 flex-1 text-[16px] font-black leading-[1.05]">{psy.name}</h3>
          {psy.verified && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--green-soft)]" style={{ border: "1.5px solid var(--green-edge)" }}><Icon name="check" width={12} weight="fill" color="var(--green-edge)" /></span>}
        </div>
        <div className="mt-1 flex items-center gap-2">
          {psy.reviews >= 3
            ? <span className="inline-flex items-center gap-1"><Icon name="star" width={13} weight="fill" color="var(--amber-edge)" /><span className="tnum text-[12px] font-black">{psy.rating}</span><span className="text-[10px] font-bold text-[var(--muted-2)]">({psy.reviews})</span></span>
            : <span className="rounded-full bg-[var(--olive-soft)] px-2 py-0.5 text-[9px] font-black" style={{ border: "1.5px solid var(--olive-edge)" }}>новый специалист</span>}
        </div>
        <p className="mt-1.5 text-[11px] font-black">{psy.method} · {psy.years} {yearsWord(psy.years)} практики</p>
        <div className="mt-1.5 flex flex-wrap gap-1">{topics.map((topic) => <span key={topic} className="rounded-full px-2 py-0.5 text-[9px] font-black" style={{ background: "var(--olive-soft)", border: "1.5px solid var(--olive-edge)" }}>{topic}</span>)}</div>
        {/* Единая инфо-строка: цена, формат/место, ближайшее окно — без повторов */}
        <div className="mt-auto space-y-1 pt-2">
          <p className="text-[13px] font-black">{psy.price.toLocaleString("ru-RU")} ₽ <span className="text-[11px] font-bold text-[var(--muted)]">/ {psy.minutes} мин</span></p>
          <p className="flex items-center gap-1 truncate text-[10px] font-bold text-[var(--muted)]"><Icon name={psy.format === "online" ? "video" : "pin"} width={12} /> {place}</p>
          <p className="flex items-center gap-1 text-[10px] font-black" style={{ color: "var(--olive-edge)" }}><Icon name="calendar" width={12} weight="bold" /> {nextSlotLabel(psy.nextDays)}</p>
        </div>
      </div>
    </div>
    {showReason && reasons.length > 0 && <div className="mx-3 flex flex-wrap gap-1.5 border-t pt-2.5" style={{ borderColor: "var(--edge-neutral)" }}>{reasons.map((reason) => <span key={reason} className="inline-flex items-center gap-1 rounded-full bg-[var(--green-soft)] px-2 py-1 text-[9px] font-black" style={{ border: "1.5px solid var(--green-edge)" }}><Icon name="check" width={10} weight="bold" /> {reason}</span>)}</div>}
    <div className="mt-2.5 px-3 pb-3"><span className="flex w-full items-center justify-center gap-1 rounded-full bg-[var(--ink)] py-2.5 text-[12px] font-black text-white">Открыть профиль →</span></div>
  </button>;
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
    <button onClick={add} disabled={attached} className="flex w-full items-center justify-center gap-2 rounded-[16px] py-3.5 text-[14px] font-black transition-transform active:scale-[0.99] disabled:active:scale-100" style={attached ? { background: "var(--green-soft)", border: "var(--bw-lg) solid var(--green-edge)" } : { background: "var(--olive)", border: "var(--bw-lg) solid var(--olive-edge)" }}>
      {attached ? <><Icon name="check" width={17} weight="bold" color="var(--green-edge)" /> В вашей терапии</> : <><Icon name="plus" width={17} weight="bold" /> Добавить в мою терапию</>}
    </button>
  );
}

function PsyDetailView({ psy, prefs, onBack }: { psy: Psy; prefs: CatalogPrefs; onBack: () => void }) {
  const tone = T[psy.tone];
  const { data: bookings = [] } = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings });
  const wasInTherapy = bookings.some((booking) => booking.psyName === psy.name);
  const reasons = reasonsFor(psy, prefs);
  const details = detailLocation(psy);
  return <div>
    <div className="-mx-4 -mt-2 px-4 pb-16 pt-2 @md:-mx-9 @md:px-9" style={{ background: tone.soft }}>
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-[13px] font-bold text-[var(--muted)]">← Каталог</button>
      <div className="flex items-center gap-3"><Portrait psy={psy} size={98} /><div className="min-w-0 flex-1"><div className="flex items-start gap-1.5"><h1 className="font-tight text-[21px] font-black leading-[1.02]">{psy.name}</h1>{psy.verified && <Icon name="check" width={18} weight="fill" color="var(--green-edge)" />}</div><div className="mt-2 flex items-center gap-1"><Icon name="star" width={15} weight="fill" color="var(--amber-edge)" /><span className="text-[13px] font-black">{psy.reviews >= 3 ? psy.rating : "Новый"}</span><span className="text-[10px] font-bold text-[var(--muted)]">· {psy.reviews} оценок</span></div><p className="mt-1 text-[11px] font-black">{psy.method} · {psy.years} {yearsWord(psy.years)} практики</p></div></div>
    </div>
    <div className="-mx-4 -mt-9 space-y-5 rounded-t-[30px] bg-[#fffaf0] px-4 pb-10 pt-5 @md:-mx-9 @md:px-9" style={{ borderTop: "var(--bw-lg) solid var(--edge-neutral)" }}>
      <AttachTherapistButton name={psy.name} />
      <div className="grid grid-cols-3 gap-2"><Stat value={`${psy.price.toLocaleString("ru-RU")} ₽`} label="одна встреча" tone="var(--amber-soft)" /><Stat value={`${psy.minutes} мин`} label="длительность" tone="var(--green-soft)" /><Stat value={nextSlotLabel(psy.nextDays)} label="ближайшее окно" tone="var(--purple-soft)" /></div>
      {(psy.photos?.length ?? 0) > 1 && <PhotoGallery psy={psy} />}
      {reasons.length > 0 && <Section title="Почему подходит вам"><div className="flex flex-wrap gap-1.5">{reasons.map((reason) => <span key={reason} className="inline-flex items-center gap-1 rounded-full bg-[var(--green-soft)] px-2.5 py-1.5 text-[10px] font-black" style={{ border: "1.5px solid var(--green-edge)" }}><Icon name="check" width={11} weight="bold" />{reason}</span>)}</div></Section>}
      <Section title="С чем помогает"><div className="flex flex-wrap gap-1.5">{psy.topics.map((topic) => <span key={topic} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black" style={{ border: `var(--bw) solid ${tone.edge}` }}>{topic}</span>)}</div></Section>
      <Section title="Методы работы"><div className="space-y-2">{psy.methods.map((method) => <div key={method} className="rounded-[17px] bg-white p-3 stroke"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-[9px] stroke" style={{ background: tone.soft, borderColor: tone.edge }}><Icon name="therapy" width={14} weight="bold" /></span><p className="text-[13px] font-black">{method}{method === psy.method ? " · основной" : ""}</p></div><p className="mt-2 text-[11px] font-semibold leading-relaxed text-[var(--muted)]">{METHOD_DESCRIPTIONS[method] ?? "Метод подбирается под запрос и задачи клиента."}</p></div>)}</div></Section>
      <Section title="Формат и место"><div className="rounded-[18px] bg-white p-4 stroke-lg"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--head-soft)] stroke"><Icon name={psy.format === "online" ? "video" : "pin"} width={19} weight="bold" /></span><div><p className="text-[13px] font-black">{details}</p><p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">Языки: {psy.languages.join(", ")}</p>{psy.format !== "online" && psy.privateAddressAvailable && <p className="mt-1 text-[10px] font-semibold text-[var(--muted-2)]">Точный адрес станет доступен после подтверждения очной записи.</p>}</div></div></div></Section>
      {psy.about && <Section title="О специалисте"><p className="text-[13px] font-semibold leading-relaxed">{psy.about}</p></Section>}
      {psy.firstSession && <Section title="Как проходит первая встреча"><div className="rounded-[18px] bg-[var(--purple-soft)] p-4 stroke-lg" style={{ borderColor: "var(--purple-edge)" }}><p className="text-[13px] font-semibold leading-relaxed">{psy.firstSession}</p></div></Section>}
      {psy.education.length > 0 && <Section title="Образование"><ul className="space-y-1.5">{psy.education.map((item) => <li key={item} className="flex gap-2 text-[12px] font-semibold"><Icon name="check" width={15} weight="bold" color="var(--green-edge)" className="mt-0.5 shrink-0" />{item}</li>)}</ul></Section>}
      <RatingBlock psy={psy} canRate={wasInTherapy} />
      <Section title="Записаться · ближайшие окна"><div className="rounded-[18px] bg-white p-4 stroke-lg"><BookFlow psyName={psy.name} onDone={onBack} /></div></Section>
      <a href={`https://t.me/${psy.tg}?text=${encodeURIComponent("Здравствуйте! Пишу из платформы «Вдох» — хочу записаться на консультацию.")}`} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[var(--ink)] py-3.5 text-[14px] font-black text-white"><Icon name="spark" width={16} weight="fill" /> Написать специалисту</a>
    </div>
  </div>;
}

function PhotoGallery({ psy }: { psy: Psy }) {
  return <Section title="Фотографии"><div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">{psy.photos!.map((photo, index) => { const src = asset(photo); return <div key={`${photo.slice(0, 24)}-${index}`} className="relative h-[174px] w-[132px] shrink-0 snap-start overflow-hidden rounded-[18px] bg-white stroke-lg"><Image src={src} alt={`${psy.name}, фотография ${index + 1}`} fill sizes="132px" className="object-cover" unoptimized={isInlineImage(src)} /></div>; })}</div></Section>;
}

function topicsForCard(psy: Psy, prefs: CatalogPrefs) {
  const matching = prefs.topics.filter((topic) => psy.topics.includes(topic));
  return [...new Set([...matching, ...psy.topics])].slice(0, 2);
}

function isInlineImage(src: string) { return /^(data:|blob:)/i.test(src); }

function catalogLocation(psy: Psy) {
  if (psy.format === "online") return "Онлайн";
  const place = [psy.city, psy.metro ? `м. ${psy.metro.replace(/^м\.\s*/i, "")}` : psy.district].filter(Boolean).join(" · ");
  return [formatLabel(psy.format), place].filter(Boolean).join(" · ");
}

function detailLocation(psy: Psy) {
  if (psy.format === "online") return "Онлайн — можно подключиться из любой точки";
  const place = [psy.city, psy.district, psy.metro ? `м. ${psy.metro.replace(/^м\.\s*/i, "")}` : ""].filter(Boolean).join(" · ");
  const exact = psy.publicExactAddress ? psy.address : "";
  return [formatLabel(psy.format), place, exact].filter(Boolean).join(" · ");
}

function Stat({ value, label, tone }: { value: string; label: string; tone: string }) { return <div className="rounded-[15px] p-2.5 text-center stroke" style={{ background: tone }}><p className="font-tight tnum text-[18px] font-black leading-none">{value}</p><p className="mt-1 text-[8px] font-black uppercase tracking-[.04em] text-[var(--muted)]">{label}</p></div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section><p className="mb-2 text-[10px] font-black uppercase tracking-[.07em] text-[var(--muted)]">{title}</p>{children}</section>; }

const RATING_KEY = "bereg_ratings";
function RatingBlock({ psy, canRate }: { psy: Psy; canRate: boolean }) {
  const [mine, setMine] = useState(0);
  useEffect(() => { try { const ratings = JSON.parse(localStorage.getItem(RATING_KEY) || "{}"); setMine(ratings[psy.id] ?? 0); } catch { /* ignore */ } }, [psy.id]);
  const rate = (value: number) => { success(); setMine(value); try { const ratings = JSON.parse(localStorage.getItem(RATING_KEY) || "{}"); ratings[psy.id] = value; localStorage.setItem(RATING_KEY, JSON.stringify(ratings)); } catch { /* ignore */ } };
  return <Section title="Ваша оценка">{canRate ? <div className="rounded-[18px] bg-[var(--amber-soft)] p-4 stroke-lg" style={{ borderColor: "var(--amber-edge)" }}><div className="flex justify-center gap-2">{[1,2,3,4,5].map((value) => <motion.button key={value} whileTap={{ scale: .82 }} onClick={() => rate(value)} className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white stroke" aria-label={`Оценка ${value}`}><Icon name="star" width={21} weight={mine >= value ? "fill" : "regular"} color="var(--amber-edge)" /></motion.button>)}</div>{mine > 0 && <p className="mt-2 text-center text-[11px] font-black">Спасибо — оценку можно изменить</p>}</div> : <div className="rounded-[16px] bg-white p-3 text-[11px] font-semibold text-[var(--muted)] stroke">Оценку могут оставить клиенты после состоявшейся сессии.</div>}</Section>;
}

function BookFlow({ psyName, onDone }: { psyName: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [done, setDone] = useState<{ at: string; format: string } | null>(null);
  const book = useMutation({ mutationFn: ({ iso, format }: { iso: string; format: "online" | "offline" }) => bookSlot(psyName, iso, format), onSuccess: (booking) => { success(); setDone({ at: booking.startsAt, format: booking.format }); qc.invalidateQueries({ queryKey: ["my-bookings"] }); qc.invalidateQueries({ queryKey: ["slots"] }); qc.invalidateQueries({ queryKey: ["month-avail"] }); } });
  if (done) { const date = new Date(done.at); return <div className="text-center"><p className="text-[14px] font-black">Вы записаны к {psyName}</p><p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">{date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} в {date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} · {done.format === "online" ? "онлайн" : "очно"}</p><div className="mt-3 flex justify-center gap-2"><Link href="/sessions"><Button size="sm" variant="soft">Мои сессии</Button></Link><Button size="sm" variant="ghost" onClick={onDone}>Готово</Button></div></div>; }
  return <><p className="mb-2 text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">День и окно</p><SlotPicker forClient variant="calendar" showAvail onPick={(iso, format) => book.mutate({ iso, format })} /></>;
}
