import { apiFetch } from "@/lib/api";
import { availabilityFits, availabilityFromWorkHours, availabilityScore, EMPTY_AVAILABILITY, type Availability, type DayGroup, type ScheduleHours } from "@/lib/availability";
import type { PsyProfile } from "@/lib/profile";
import { publicRules, type PublicRule } from "@/lib/profile-rules";
import type { Subscription } from "@/lib/subscription";

export type Tone = "green" | "amber" | "purple" | "coral" | "salmon" | "sky";
export type PsyFormat = "online" | "offline" | "both";
export type Gender = "woman" | "man";
export type TimeOfDay = "morning" | "day" | "evening";

export type Psy = {
  id: number;
  name: string;
  portrait: string;
  photos?: string[];
  tone: Tone;
  verified: boolean;
  rating: number;
  reviews: number;
  method: string;
  methods: string[];
  specialistTypes?: string[]; // психолог / психотерапевт / коуч — можно несколько
  topics: string[];
  price: number;
  minutes: number;
  format: PsyFormat;
  city: string;
  district?: string;
  metro?: string;
  address?: string;
  publicExactAddress?: boolean;
  privateAddressAvailable?: boolean;
  gender: Gender | "unspecified";
  languages: string[];
  years: number;
  sessions: number;
  clients: number;
  responseHrs: number;
  nextDays: number;
  availableTimes: TimeOfDay[];
  /** Слепок рабочего графика: заполняется, когда расписание специалиста известно. */
  availability?: Availability;
  exposure: number;
  newcomer: boolean;
  tg: string;
  about: string;
  firstSession?: string;
  education: string[];
  /** Показывать ли в карточке счётчики платформы. Управляется в анкете. */
  showStats?: boolean;
  /** Правила работы, которые специалист отметил как публичные. */
  rules?: PublicRule[];
  style?: string;      // стиль работы: мягкий / структурный / активный …
  quote?: string;      // человеческий маркер — короткая цитата от первого лица
  helps?: string;      // «помогаю с…» одной живой строкой
  avoids?: string[];   // темы, с которыми специалист не работает
};

export type CatalogPrefs = {
  topics: string[];
  format: "any" | PsyFormat;
  city: string;
  budget: BudgetKey | null;
  days: DayGroup[];
  times: TimeOfDay[];
  gender: "any" | Gender;
  language: string;
  minYears: number;
};

export type CatalogFilters = {
  query: string;
  topics: string[];
  methods: string[];
  format: "any" | PsyFormat;
  city: string;
  maxPrice: number | null;
  gender: "any" | Gender;
  language: string;
  minYears: number;
  verifiedOnly: boolean;
  thisWeek: boolean;
};

export type SortMode = "recommended" | "soon" | "price-asc" | "price-desc" | "experience" | "rating" | "new";

export const EMPTY_PREFS: CatalogPrefs = { topics: [], format: "any", city: "", budget: null, days: [], times: [], gender: "any", language: "any", minYears: 0 };
export const EMPTY_FILTERS: CatalogFilters = { query: "", topics: [], methods: [], format: "any", city: "", maxPrice: null, gender: "any", language: "any", minYears: 0, verifiedOnly: false, thisWeek: false };

export const TOPICS = ["тревога", "выгорание", "отношения", "самооценка", "травма", "утрата", "стресс", "сон", "прокрастинация", "одиночество", "депрессия", "панические атаки", "границы", "эмоции", "работа и карьера", "семья", "родители", "дети", "расставание", "деньги", "зависимости", "пищевое поведение", "здоровье", "поиск себя", "сексуальность", "переезд"];
/** Тема-«всё остальное» в опросе: человек не обязан укладываться в список. */
export const TOPIC_OTHER = "другое";
export const SURVEY_TOPICS = [...TOPICS, TOPIC_OTHER];
export const METHODS = ["КПТ", "ACT", "DBT", "Схема-терапия", "EMDR", "Гештальт", "Психоанализ", "Психодрама", "Экзистенциальная", "Юнгианский анализ", "Системная семейная", "Транзактный анализ", "Нарративная", "Клиент-центрированная", "Телесно-ориентированная", "Арт-терапия", "КПТ третьей волны", "IFS (Внутренние семьи)", "Майндфулнес", "Гипнотерапия"];
export const LANGUAGES = ["русский", "английский", "татарский", "казахский", "армянский"];
/** В опросе языка три: два основных и «другой» — любой из остальных. */
export const LANGUAGE_OTHER = "другой";
export const SURVEY_LANGUAGES = ["русский", "английский", LANGUAGE_OTHER];
export const EXPERIENCE_OPTIONS = [0, 3, 7] as const;

/** Города для очных встреч: два базовых плюс всё, что есть в каталоге. */
export const BASE_CITIES = ["Москва", "Санкт-Петербург"];
export function catalogCities(catalog: Psy[] = PUBLIC_PSYS): string[] {
  const rank = (city: string) => { const index = BASE_CITIES.indexOf(city); return index === -1 ? BASE_CITIES.length : index; };
  const cities = new Set([...BASE_CITIES, ...catalog.map((psy) => psy.city.trim()).filter(Boolean)]);
  return [...cities].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "ru"));
}

/** Бюджет за одну встречу — вилками, а не одним потолком. */
export type BudgetKey = "to3000" | "from3000" | "from5000" | "from9000";
export const BUDGET_BANDS: { key: BudgetKey; label: string; min: number; max: number }[] = [
  { key: "to3000", label: "до 3000 ₽", min: 0, max: 3000 },
  { key: "from3000", label: "от 3000 ₽", min: 3000, max: Number.POSITIVE_INFINITY },
  { key: "from5000", label: "от 5000 ₽", min: 5000, max: Number.POSITIVE_INFINITY },
  { key: "from9000", label: "от 9000 ₽", min: 9000, max: Number.POSITIVE_INFINITY },
];
export const budgetBand = (key: BudgetKey | null) => BUDGET_BANDS.find((band) => band.key === key) ?? null;
export function priceFitsBudget(price: number, key: BudgetKey | null): boolean {
  const band = budgetBand(key);
  return !band || (price >= band.min && price <= band.max);
}

/** «Другой» язык — любой, кроме русского и английского. */
export function speaksLanguage(psy: Psy, language: string): boolean {
  if (language === "any") return true;
  if (language === LANGUAGE_OTHER) return psy.languages.some((item) => item !== "русский" && item !== "английский");
  return psy.languages.includes(language);
}
export const METHOD_DESCRIPTIONS: Record<string, string> = {
  "КПТ": "Исследует связь мыслей, эмоций и действий и помогает пробовать новые способы реагирования.",
  "ACT": "Помогает действовать в соответствии с ценностями, даже когда рядом остаются сложные чувства.",
  "EMDR": "Структурированная работа с последствиями травматического опыта и тяжёлыми воспоминаниями.",
  "Схема-терапия": "Работа с устойчивыми жизненными сценариями и важными эмоциональными потребностями.",
  "Гештальт": "Внимание к переживаниям, отношениям и тому, что происходит в контакте здесь и сейчас.",
  "DBT": "Практические навыки регуляции эмоций, устойчивости к стрессу и общения.",
  "Психоанализ": "Исследование повторяющихся отношений, внутренних конфликтов и влияния прошлого опыта.",
};

// Витринных анкет в проекте нет: каталог наполняется только реальными
// специалистами. Пока никто не прошёл верификацию, он пуст — кроме
// собственной карточки психолога, если у неё есть размещение.
export const PSYS: Psy[] = [];

const PUBLIC_PSYS: Psy[] = PSYS;

/** Своя анкета в каталоге: по этому id ведёт ссылка-приглашение на запись. */
export const OWN_PROFILE_ID = 100_001;

// Карточка стоит в каталоге, если есть PRO либо ещё идут бесплатные 14 дней
// после одобрения анкеты.
export function hasCatalogPlacement(subscription: Subscription | null | undefined, now = Date.now()): boolean {
  if (!subscription) return false;
  if (subscription.pro) return true;
  return Boolean(subscription.catalogUntil && new Date(subscription.catalogUntil).getTime() > now);
}

export function isCatalogProfileReady(profile: PsyProfile | null | undefined): profile is PsyProfile {
  if (!profile || profile.status !== "approved") return false;
  if (!profile.name.trim() || !profile.photos.length || !profile.primaryMethod.trim()) return false;
  if (!profile.methods.length || !profile.topics.length || !profile.languages.length) return false;
  if (!Number.isFinite(profile.sessionPrice) || profile.sessionPrice <= 0 || profile.sessionMinutes < 30) return false;
  if (profile.experienceYears === "" || Number(profile.experienceYears) < 0) return false;
  if (profile.format !== "online" && !profile.location.city.trim()) return false;
  if (profile.location.publicExactAddress && !profile.location.address.trim()) return false;
  return true;
}

export function profileToCatalogPsy(profile: PsyProfile, work?: ScheduleHours | null): Psy {
  const photos = profile.photos.filter(Boolean).slice(0, 3);
  const availability = availabilityFromWorkHours(work);
  return {
    id: OWN_PROFILE_ID,
    name: profile.name.trim(),
    portrait: photos[0],
    photos,
    tone: "purple",
    verified: profile.status === "approved",
    rating: 0,
    reviews: 0,
    method: profile.primaryMethod.trim(),
    methods: [...new Set([profile.primaryMethod, ...profile.methods].filter(Boolean))],
    specialistTypes: (profile.specialistTypes?.length ? profile.specialistTypes : [profile.specialistType].filter(Boolean) as string[]),
    topics: profile.topics.filter(Boolean),
    price: profile.sessionPrice,
    minutes: profile.sessionMinutes,
    // В каталог карточка попадает только заполненной, но формат в анкете может
    // быть ещё не выбран — тогда считаем встречи онлайн.
    format: profile.format || "online",
    city: profile.location.city.trim(),
    district: profile.location.district.trim() || undefined,
    metro: profile.location.metro.trim() || undefined,
    address: profile.location.publicExactAddress ? profile.location.address.trim() || undefined : undefined,
    publicExactAddress: profile.location.publicExactAddress,
    privateAddressAvailable: !profile.location.publicExactAddress && Boolean(profile.location.address.trim()),
    gender: profile.gender,
    languages: profile.languages.filter(Boolean),
    years: Number(profile.experienceYears) || 0,
    sessions: 0,
    clients: 0,
    responseHrs: 24,
    nextDays: 7,
    availableTimes: availability.times.length ? availability.times : ["day"],
    availability: availability.slots ? availability : undefined,
    exposure: 0,
    newcomer: true,
    tg: profile.tg.trim().replace(/^@/, ""),
    about: profile.about.trim(),
    firstSession: profile.firstSession.trim() || undefined,
    education: profile.education.map((item) => item.trim()).filter(Boolean),
    showStats: profile.showStats !== false,
    rules: publicRules(profile.rules),
    style: profile.style?.trim() || undefined,
    quote: profile.quote?.trim() || undefined,
    helps: profile.topics.filter(Boolean).slice(0, 3).join(", ") || undefined,
    avoids: (profile.avoids ?? []).map((t) => t.trim()).filter(Boolean),
  };
}

/** Одна анкета с сервера по id — карточка для ссылки-приглашения. */
export async function getCatalogPsy(id: number): Promise<Psy | null> {
  const rows = await apiFetch<CatalogApiPsy[]>(`/catalog?id=${id}`);
  return rows[0] ? apiPsyToCatalogPsy(rows[0]) : null;
}

/** Анкета из /api/catalog в карточку каталога. Публичных полей меньше, чем в
 *  своей анкете, — остальное заполняем нейтральными значениями. */
type CatalogApiPsy = Partial<Record<keyof Psy, unknown>> & { id: number; name: string };
export function apiPsyToCatalogPsy(row: CatalogApiPsy): Psy {
  const list = (v: unknown) => (Array.isArray(v) ? (v as string[]).filter(Boolean) : []);
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const photos = list(row.photos).slice(0, 3);
  return {
    id: row.id,
    name: text(row.name),
    portrait: text(row.portrait) || photos[0] || "",
    photos,
    tone: "purple",
    verified: true,
    rating: 0,
    reviews: 0,
    method: text(row.method),
    methods: list(row.methods),
    specialistTypes: list(row.specialistTypes),
    topics: list(row.topics),
    price: Number(row.price) || 0,
    minutes: Number(row.minutes) || 50,
    format: (row.format as Psy["format"]) ?? "online",
    city: text(row.city),
    district: text(row.district) || undefined,
    metro: text(row.metro) || undefined,
    gender: "unspecified",
    languages: list(row.languages),
    years: Number(row.years) || 0,
    sessions: 0,
    clients: 0,
    responseHrs: 24,
    nextDays: 7,
    availableTimes: (list(row.availableTimes) as TimeOfDay[]).length ? (list(row.availableTimes) as TimeOfDay[]) : ["day"],
    availability: (row.availability as Availability | undefined) ?? undefined,
    exposure: 0,
    newcomer: true,
    tg: "",
    about: text(row.about),
    firstSession: text(row.firstSession) || undefined,
    education: list(row.education),
    showStats: row.showStats !== false,
    rules: Array.isArray(row.rules) ? (row.rules as PublicRule[]) : publicRules(row.rules),
    style: text(row.style) || undefined,
    quote: text(row.quote) || undefined,
    avoids: list(row.avoids),
  };
}

export function publishedCatalog(profile: PsyProfile | null | undefined, subscription: Subscription | null | undefined, work?: ScheduleHours | null): Psy[] {
  if (!hasCatalogPlacement(subscription) || !isCatalogProfileReady(profile)) return PUBLIC_PSYS;
  return [profileToCatalogPsy(profile, work), ...PUBLIC_PSYS];
}

const formatFits = (psy: Psy, format: CatalogPrefs["format"] | CatalogFilters["format"]) => format === "any" || psy.format === "both" || psy.format === format;
const overlap = (a: string[], b: string[]) => a.filter((value) => b.includes(value)).length;

/** Окна специалиста: из графика, если он заполнен, иначе — из анкеты. */
export function psyAvailability(psy: Psy): Availability {
  if (psy.availability) return psy.availability;
  if (!psy.availableTimes.length) return EMPTY_AVAILABILITY;
  return { days: [], times: psy.availableTimes, slots: psy.availableTimes.length };
}

export function matchScore(psy: Psy, prefs: CatalogPrefs): number {
  let score = 18;
  const topics = prefs.topics.filter((topic) => topic !== TOPIC_OTHER);
  if (topics.length) score += Math.min(42, overlap(psy.topics, topics) * 25);
  else score += 16;
  if (formatFits(psy, prefs.format)) score += 16; else score -= 30;
  if (prefs.city && prefs.format !== "online" && psy.city.toLowerCase() === prefs.city.toLowerCase()) score += 8;
  if (prefs.budget) score += priceFitsBudget(psy.price, prefs.budget) ? 12 : -12;
  if (prefs.times.length || prefs.days.length) score += availabilityScore(psyAvailability(psy), prefs.days, prefs.times) * 4;
  if (prefs.gender !== "any") score += psy.gender === prefs.gender ? 6 : -8;
  if (prefs.language !== "any") score += speaksLanguage(psy, prefs.language) ? 5 : -10;
  if (prefs.minYears) score += psy.years >= prefs.minYears ? 5 : -8;
  if (psy.nextDays <= 7) score += 10; else if (psy.nextDays <= 14) score += 4;
  if (psy.verified) score += 4;
  const bayesian = (psy.rating * psy.reviews + 4.7 * 12) / (psy.reviews + 12);
  score += Math.max(0, Math.min(8, (bayesian - 4.3) * 12));
  return Math.round(score);
}

export function reasonsFor(psy: Psy, prefs: CatalogPrefs): string[] {
  const reasons: string[] = [];
  const topic = prefs.topics.find((value) => value !== TOPIC_OTHER && psy.topics.includes(value));
  if (topic) reasons.push(`работает с запросом «${topic}»`);
  if (reasons.length < 3) reasons.push(`основной подход — ${psy.method}`);
  if (prefs.budget && priceFitsBudget(psy.price, prefs.budget)) reasons.push("подходит по бюджету");
  if (prefs.language !== "any" && speaksLanguage(psy, prefs.language)) reasons.push(prefs.language === LANGUAGE_OTHER ? "консультирует не только на русском" : `консультирует на ${prefs.language}`);
  if (prefs.city && prefs.format !== "online" && psy.city.toLowerCase() === prefs.city.toLowerCase()) reasons.push(`принимает в городе ${psy.city}`);
  if (prefs.minYears > 0 && psy.years >= prefs.minYears) reasons.push(`${psy.years} лет практики`);
  if (prefs.gender !== "any" && psy.gender === prefs.gender) reasons.push("соответствует выбору специалиста");
  return reasons.slice(0, 3);
}

/**
 * Специалисты, которые проходят по всем ответам опроса — без натяжек.
 * Их число показываем на последнем шаге: пусто — значит покажем похожих.
 */
export function exactMatches(prefs: CatalogPrefs, catalog: Psy[] = PUBLIC_PSYS): Psy[] {
  const topics = prefs.topics.filter((topic) => topic !== TOPIC_OTHER);
  return catalog.filter((psy) => {
    if (!formatFits(psy, prefs.format)) return false;
    if (prefs.city && prefs.format !== "online" && psy.city.toLowerCase() !== prefs.city.toLowerCase()) return false;
    if (prefs.budget && !priceFitsBudget(psy.price, prefs.budget)) return false;
    if (prefs.gender !== "any" && psy.gender !== prefs.gender) return false;
    if (prefs.language !== "any" && !speaksLanguage(psy, prefs.language)) return false;
    if (topics.length && !overlap(psy.topics, topics)) return false;
    if (!availabilityFits(psyAvailability(psy), prefs.days, prefs.times)) return false;
    return true;
  });
}

/** Настройки из localStorage могли остаться от прежней версии опроса. */
export function normalizePrefs(raw: unknown): CatalogPrefs {
  const saved = (raw && typeof raw === "object" ? raw : {}) as Partial<CatalogPrefs>;
  const budget = typeof saved.budget === "string" && BUDGET_BANDS.some((band) => band.key === saved.budget) ? saved.budget : null;
  const language = typeof saved.language === "string" && saved.language ? saved.language : "any";
  return { ...EMPTY_PREFS, ...saved, budget, language };
}

export function personalSelection(prefs: CatalogPrefs, catalog: Psy[] = PUBLIC_PSYS): Psy[] {
  const available = catalog.filter((psy) => psy.nextDays <= 14).sort((a, b) => matchScore(b, prefs) - matchScore(a, prefs));
  const picked: Psy[] = available.slice(0, 3);
  const underexposed = available.filter((psy) => !picked.includes(psy)).sort((a, b) => a.exposure - b.exposure || matchScore(b, prefs) - matchScore(a, prefs));
  picked.push(...underexposed.slice(0, 2));
  const newcomer = available.find((psy) => psy.newcomer && !picked.includes(psy) && matchScore(psy, prefs) >= 35);
  if (newcomer) picked.push(newcomer);
  for (const psy of available) if (picked.length < 6 && !picked.includes(psy)) picked.push(psy);
  return picked.slice(0, 6);
}

export function filterCatalog(filters: CatalogFilters, catalog: Psy[] = PUBLIC_PSYS): Psy[] {
  const query = filters.query.trim().toLowerCase();
  return catalog.filter((psy) => {
    if (query && ![psy.name, psy.method, ...psy.methods, ...psy.topics].some((value) => value.toLowerCase().includes(query))) return false;
    if (filters.topics.length && !overlap(psy.topics, filters.topics)) return false;
    if (filters.methods.length && !overlap(psy.methods, filters.methods)) return false;
    if (!formatFits(psy, filters.format)) return false;
    if (filters.city && psy.city.toLowerCase() !== filters.city.toLowerCase()) return false;
    if (filters.maxPrice != null && psy.price > filters.maxPrice) return false;
    if (filters.gender !== "any" && psy.gender !== filters.gender) return false;
    if (filters.language !== "any" && !speaksLanguage(psy, filters.language)) return false;
    if (psy.years < filters.minYears) return false;
    if (filters.verifiedOnly && !psy.verified) return false;
    if (filters.thisWeek && psy.nextDays > 7) return false;
    return true;
  });
}

export function sortCatalog(list: Psy[], sort: SortMode, prefs: CatalogPrefs): Psy[] {
  return [...list].sort((a, b) => {
    if (sort === "soon") return a.nextDays - b.nextDays;
    if (sort === "price-asc") return a.price - b.price;
    if (sort === "price-desc") return b.price - a.price;
    if (sort === "experience") return b.years - a.years;
    if (sort === "rating") return b.rating - a.rating || b.reviews - a.reviews;
    if (sort === "new") return Number(b.newcomer) - Number(a.newcomer) || a.exposure - b.exposure;
    return matchScore(b, prefs) - matchScore(a, prefs) || a.exposure - b.exposure;
  });
}

export const nextSlotLabel = (days: number) => days === 1 ? "завтра" : days === 2 ? "послезавтра" : days <= 7 ? `через ${days} дн.` : days <= 14 ? "на следующей неделе" : `через ${days} дн.`;
export const formatLabel = (format: PsyFormat) => format === "both" ? "онлайн · очно" : format === "online" ? "онлайн" : "очно";
