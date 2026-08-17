import { apiFetch } from "@/lib/api";
import { availabilityFits, availabilityFromWorkHours, availabilityScore, EMPTY_AVAILABILITY, nextSlotDays, type Availability, type DayGroup, type ScheduleHours } from "@/lib/availability";
import { priceFitsScale, toCurrency, type Currency } from "@/lib/money";
import { helpsLine, languagePrepositional, yearsWord } from "@/lib/morph";
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
  /** Отмеченные звёздочкой запросы — до трёх, показываются первыми. */
  topTopics?: string[];
  price: number;
  /** Валюта цены: рубли по умолчанию, доллар или евро — у тех, кто вне России. */
  currency?: Currency;
  minutes: number;
  format: PsyFormat;
  city: string;
  /** Регион или страна специалиста — рядом с часовым поясом в карточке. */
  region?: string;
  /** Часовой пояс специалиста (IANA): по нему клиент понимает разницу. */
  timezone?: string;
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
  /** Сайт и соцсети из анкеты — то же, что специалист показывает у себя. */
  links?: { kind: string; url: string }[];
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
  /**
   * Принимает ли специалист новые заявки через платформу. false — свободных
   * мест нет: карточка открывается затенённой, запись выключена. Причину
   * (тариф специалиста) клиенту не показываем — она его не касается.
   */
  accepting?: boolean;
};

/** Единственная формулировка про закрытый приём — чтобы везде звучало одинаково. */
export const NOT_ACCEPTING_TEXT = "Специалист временно не принимает заявки через платформу";

export type CatalogPrefs = {
  topics: string[];
  format: "any" | PsyFormat;
  city: string;
  /** Валюта, в которой человек считает бюджет. */
  currency: Currency;
  /** Верхняя граница бюджета; null — «сколько угодно». */
  maxPrice: number | null;
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
  currency: Currency;
  maxPrice: number | null;
  gender: "any" | Gender;
  language: string;
  minYears: number;
  verifiedOnly: boolean;
  thisWeek: boolean;
};

export type SortMode = "recommended" | "soon" | "price-asc" | "price-desc" | "experience" | "rating" | "new";

export const EMPTY_PREFS: CatalogPrefs = { topics: [], format: "any", city: "", currency: "RUB", maxPrice: null, days: [], times: [], gender: "any", language: "any", minYears: 0 };
export const EMPTY_FILTERS: CatalogFilters = { query: "", topics: [], methods: [], format: "any", city: "", currency: "RUB", maxPrice: null, gender: "any", language: "any", minYears: 0, verifiedOnly: false, thisWeek: false };

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

/** Валюта карточки: анкеты без поля — рублёвые, других раньше не было. */
export const psyCurrency = (psy: Psy): Currency => toCurrency(psy.currency);

/**
 * Проходит ли карточка по шкале бюджета. Пока потолок не задан (null), шкала
 * ничего не отсекает: человек ещё не трогал ползунок, и валюта не повод
 * прятать специалиста.
 */
export function priceFitsBudget(psy: Psy, maxPrice: number | null, currency: Currency): boolean {
  if (maxPrice == null) return true;
  return priceFitsScale(psy.price, psyCurrency(psy), maxPrice, currency);
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

// В боевом режиме витринных анкет нет: каталог наполняется только реальными
// специалистами, прошедшими проверку. В демо каталог с нуля выглядит поломкой,
// поэтому там живут две бутафорские карточки — и только там.
const DEMO_CATALOG = process.env.NEXT_PUBLIC_DEMO === "1";

const DEMO_PSYS: Psy[] = [
  { id: 1, name: "Ирина Верещагина", portrait: "/catalog/irina.webp", tone: "green", verified: true, rating: 4.9, reviews: 128, method: "КПТ", methods: ["КПТ", "EMDR"], topics: ["тревога", "границы", "панические атаки"], price: 3500, currency: "RUB", region: "Москва · Россия", timezone: "Europe/Moscow", minutes: 50, format: "both", city: "Москва", district: "Хамовники", metro: "Фрунзенская", address: "Комсомольский проспект, 28", publicExactAddress: false, gender: "woman", languages: ["русский", "английский"], years: 8, sessions: 1240, clients: 210, responseHrs: 2, nextDays: 1, availableTimes: ["day", "evening"], exposure: 72, newcomer: false, tg: "irina_v", about: "Помогаю справляться с тревогой и вернуть опору. Работаю бережно, в темпе клиента, с опорой на доказательные методы.", firstSession: "На первой встрече уточним, что происходит сейчас, сформулируем реалистичную цель и договоримся о комфортном темпе работы.", education: ["МГУ, факультет психологии", "Сертификация по КПТ, АКБТ", "EMDR Europe, базовый курс"], style: "мягкий, в темпе клиента", quote: "Тревога — не приговор. Разберём её по шагам.", helps: "тревогой, паническими атаками и границами", avoids: ["зависимости", "расстройства пищевого поведения"] },
  { id: 2, name: "Сергей Домбровский", portrait: "/catalog/sergey.webp", tone: "amber", verified: true, rating: 4.8, reviews: 94, method: "ACT", methods: ["ACT", "DBT"], topics: ["выгорание", "самооценка", "стресс"], price: 4000, currency: "RUB", minutes: 60, format: "online", city: "Санкт-Петербург", gender: "man", languages: ["русский"], years: 11, sessions: 1980, clients: 340, responseHrs: 3, nextDays: 4, availableTimes: ["morning", "day"], exposure: 84, newcomer: false, tg: "sergey_act", about: "Работаю с выгоранием и самооценкой. Помогаю находить ценности и действовать вопреки тревоге и прокрастинации.", education: ["СПбГУ, клиническая психология", "ACT — Ассоциация контекстно-поведенческой науки"], style: "структурный, через ценности", quote: "Помогу двигаться к важному, даже когда страшно.", helps: "выгоранием, самооценкой и стрессом", avoids: ["работа с парами", "детская терапия"], region: "Санкт-Петербург · Россия", timezone: "Europe/Moscow" },
  // Специалист вне России: оплата в евро и свой часовой пояс — ради него в
  // каталоге и появились валюта со шкалой.
  { id: 3, name: "Марина Штерн", portrait: "/catalog/irina.webp", tone: "purple", verified: true, rating: 4.9, reviews: 41, method: "Схема-терапия", methods: ["Схема-терапия", "КПТ"], topics: ["переезд", "одиночество", "отношения"], price: 60, currency: "EUR", minutes: 50, format: "online", city: "", region: "Лиссабон · Португалия", timezone: "Europe/Lisbon", gender: "woman", languages: ["русский", "английский"], years: 9, sessions: 860, clients: 120, responseHrs: 5, nextDays: 2, availableTimes: ["day", "evening"], exposure: 40, newcomer: false, tg: "marina_schema", about: "Работаю с теми, кто переехал: адаптация, одиночество, отношения на расстоянии. Оплата в евро, встречи только онлайн.", education: ["СПбГУ, клиническая психология", "ISST, схема-терапия"], style: "неспешный, глубинный", quote: "Переезд меняет не только адрес — с этим можно бережно разобраться.", helps: "переездом, одиночеством и отношениями", avoids: ["зависимости"] },
];

export const PSYS: Psy[] = DEMO_CATALOG ? DEMO_PSYS : [];

const PUBLIC_PSYS: Psy[] = PSYS.map((psy) => ({
  ...psy,
  privateAddressAvailable: !psy.publicExactAddress && Boolean(psy.address),
  address: psy.publicExactAddress ? psy.address : undefined,
}));

/** Своя анкета в каталоге: по этому id ведёт ссылка-приглашение на запись. */
export const OWN_PROFILE_ID = 100_001;

// Карточка стоит в каталоге, если есть PRO либо ещё идут бесплатные 14 дней
// после одобрения анкеты.
export function hasCatalogPlacement(subscription: Subscription | null | undefined, now = Date.now()): boolean {
  if (!subscription) return false;
  if (subscription.pro) return true;
  return Boolean(subscription.catalogUntil && new Date(subscription.catalogUntil).getTime() > now);
}

/**
 * Чего не хватает анкете, чтобы стать карточкой каталога. Список нужен не
 * только проверке: специалисту показываем ровно те пункты, которые держат его
 * вне выдачи, — «анкета не прошла валидацию» без причин бесполезно.
 */
export function catalogProfileGaps(profile: PsyProfile | null | undefined): string[] {
  if (!profile) return ["анкета не заполнена"];
  const gaps: string[] = [];
  if (!profile.name.trim()) gaps.push("имя");
  if (!profile.photos.length) gaps.push("фотография");
  if (!profile.primaryMethod.trim() || !profile.methods.length) gaps.push("основной подход");
  if (!profile.topics.length) gaps.push("запросы, с которыми работаете");
  if (!profile.languages.length) gaps.push("языки консультаций");
  if (!Number.isFinite(profile.sessionPrice) || profile.sessionPrice <= 0) gaps.push("стоимость встречи");
  if (profile.sessionMinutes < 30) gaps.push("длительность встречи от 30 минут");
  if (profile.experienceYears === "" || Number(profile.experienceYears) < 0) gaps.push("стаж");
  if (profile.format !== "online" && !profile.location.city.trim()) gaps.push("город для очных встреч");
  if (profile.location.publicExactAddress && !profile.location.address.trim()) gaps.push("адрес приёма");
  return gaps;
}

export function isCatalogProfileReady(profile: PsyProfile | null | undefined): profile is PsyProfile {
  if (!profile || profile.status !== "approved") return false;
  return catalogProfileGaps(profile).length === 0;
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
    topTopics: (profile.topTopics ?? []).filter((topic) => profile.topics.includes(topic)).slice(0, 3),
    price: profile.sessionPrice,
    currency: toCurrency(profile.currency),
    minutes: profile.sessionMinutes,
    region: profile.location.region?.trim() || undefined,
    timezone: profile.timezone?.trim() || undefined,
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
    nextDays: nextSlotDays(work),
    availableTimes: availability.times.length ? availability.times : ["day"],
    availability: availability.slots ? availability : undefined,
    exposure: 0,
    newcomer: true,
    tg: profile.tg.trim().replace(/^@/, ""),
    links: profile.links.filter((link) => link.url.trim()),
    about: profile.about.trim(),
    firstSession: profile.firstSession.trim() || undefined,
    education: profile.education.map((item) => item.trim()).filter(Boolean),
    showStats: profile.showStats === true,
    rules: publicRules(profile.rules),
    style: profile.style?.trim() || undefined,
    quote: profile.quote?.trim() || undefined,
    helps: profile.topics.filter(Boolean).length ? helpsLine(profile.topics) : undefined,
    avoids: (profile.avoids ?? []).map((t) => t.trim()).filter(Boolean),
  };
}

/**
 * Боевой каталог: анкеты из базы, прошедшие проверку и с действующим
 * размещением (PRO либо первые 14 дней после одобрения) — решает сервер.
 * В демо базы нет, там каталог собирается из локальных данных.
 */
export async function listCatalog(): Promise<Psy[]> {
  if (DEMO_CATALOG) return [];
  const rows = await apiFetch<CatalogApiPsy[]>("/catalog");
  return rows.map(apiPsyToCatalogPsy);
}

/** Одна анкета с сервера по id — карточка для ссылки-приглашения. */
export async function getCatalogPsy(id: number): Promise<Psy | null> {
  const rows = await apiFetch<CatalogApiPsy[]>(`/catalog?id=${id}`);
  return rows[0] ? apiPsyToCatalogPsy(rows[0]) : null;
}

/** Анкета из /api/catalog в карточку каталога. Публичных полей меньше, чем в
 *  своей анкете, — остальное заполняем нейтральными значениями. */
export type CatalogApiPsy = Partial<Record<keyof Psy, unknown>> & { id: number; name: string };
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
    // Галочку ставит сервер: закреплённый специалист может ещё проходить
    // верификацию, и карточка не должна обещать лишнего.
    verified: row.verified !== false,
    rating: Number(row.rating) || 0,
    reviews: Number(row.reviews) || 0,
    method: text(row.method),
    methods: list(row.methods),
    specialistTypes: list(row.specialistTypes),
    topics: list(row.topics),
    topTopics: list(row.topTopics).slice(0, 3),
    price: Number(row.price) || 0,
    currency: toCurrency(row.currency),
    minutes: Number(row.minutes) || 50,
    format: (row.format as Psy["format"]) ?? "online",
    city: text(row.city),
    region: text(row.region) || undefined,
    timezone: text(row.timezone) || undefined,
    district: text(row.district) || undefined,
    metro: text(row.metro) || undefined,
    address: text(row.address) || undefined,
    publicExactAddress: Boolean(row.publicExactAddress),
    privateAddressAvailable: Boolean(row.privateAddressAvailable),
    gender: (row.gender === "woman" || row.gender === "man" ? row.gender : "unspecified"),
    languages: list(row.languages),
    years: Number(row.years) || 0,
    sessions: Number(row.sessions) || 0,
    clients: 0,
    responseHrs: 24,
    nextDays: Number(row.nextDays) || 14,
    availableTimes: (list(row.availableTimes) as TimeOfDay[]).length ? (list(row.availableTimes) as TimeOfDay[]) : ["day"],
    availability: (row.availability as Availability | undefined) ?? undefined,
    exposure: 0,
    // Новичок — тот, у кого ещё нет ни одной оценки. Раньше пометка стояла
    // у всех боевых карточек, включая работающих не первый год.
    newcomer: (Number(row.reviews) || 0) === 0,
    // Контакт для связи приходит с сервера: без него кнопка «Написать в
    // Telegram» в бою была видна только на собственной карточке.
    tg: text(row.tg).replace(/^@/, ""),
    links: Array.isArray(row.links) ? (row.links as Psy["links"]) : undefined,
    about: text(row.about),
    firstSession: text(row.firstSession) || undefined,
    education: list(row.education),
    showStats: row.showStats === true,
    rules: Array.isArray(row.rules) ? (row.rules as PublicRule[]) : publicRules(row.rules),
    style: text(row.style) || undefined,
    quote: text(row.quote) || undefined,
    avoids: list(row.avoids),
    // Молчание сервера читаем как «принимает»: старые ответы без поля не
    // должны затенять живые карточки.
    accepting: row.accepting !== false,
  };
}

/**
 * Что видит человек в каталоге. В бою список приходит с сервера — там же
 * проверены и статус анкеты, и оплата, поэтому своя карточка попадает в него
 * тем же путём, что и чужие. В демо сервера нет: каталог собирается из
 * бутафорских анкет плюс своя, если размещение действует.
 */
export function publishedCatalog(
  profile: PsyProfile | null | undefined,
  subscription: Subscription | null | undefined,
  work?: ScheduleHours | null,
  server: Psy[] = [],
  // Свободные места на тарифе. false — приём закрыт, и в демо-каталоге своей
  // карточки нет: в бою то же самое делает сервер.
  accepting = true,
): Psy[] {
  if (!DEMO_CATALOG) return server;
  if (!hasCatalogPlacement(subscription) || !isCatalogProfileReady(profile) || !accepting) return PUBLIC_PSYS;
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
  if (prefs.maxPrice != null) score += priceFitsBudget(psy, prefs.maxPrice, prefs.currency) ? 12 : -12;
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
  if (prefs.maxPrice != null && priceFitsBudget(psy, prefs.maxPrice, prefs.currency)) reasons.push("подходит по бюджету");
  if (prefs.language !== "any" && speaksLanguage(psy, prefs.language)) reasons.push(prefs.language === LANGUAGE_OTHER ? "консультирует не только на русском" : `консультирует на ${languagePrepositional(prefs.language)}`);
  if (prefs.city && prefs.format !== "online" && psy.city.toLowerCase() === prefs.city.toLowerCase()) reasons.push(`принимает в городе ${psy.city}`);
  if (prefs.minYears > 0 && psy.years >= prefs.minYears) reasons.push(`${psy.years} ${yearsWord(psy.years)} практики`);
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
    if (!priceFitsBudget(psy, prefs.maxPrice, prefs.currency)) return false;
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
  const language = typeof saved.language === "string" && saved.language ? saved.language : "any";
  // Раньше бюджет хранился ключом вилки («from3000»); шкала считает числом.
  const maxPrice = typeof saved.maxPrice === "number" && saved.maxPrice > 0 ? saved.maxPrice : null;
  return { ...EMPTY_PREFS, ...saved, currency: toCurrency(saved.currency), maxPrice, language };
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
    if (!priceFitsBudget(psy, filters.maxPrice, filters.currency)) return false;
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
