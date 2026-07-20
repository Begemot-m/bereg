export type Tone = "green" | "amber" | "purple" | "coral" | "salmon" | "sky";
export type PsyFormat = "online" | "offline" | "both";
export type Gender = "woman" | "man";
export type TimeOfDay = "morning" | "day" | "evening";

export type Psy = {
  id: number;
  name: string;
  portrait: string;
  tone: Tone;
  verified: boolean;
  rating: number;
  reviews: number;
  method: string;
  methods: string[];
  topics: string[];
  price: number;
  minutes: number;
  format: PsyFormat;
  city: string;
  gender: Gender;
  languages: string[];
  years: number;
  sessions: number;
  clients: number;
  responseHrs: number;
  nextDays: number;
  availableTimes: TimeOfDay[];
  exposure: number;
  newcomer: boolean;
  tg: string;
  about: string;
  education: string[];
};

export type CatalogPrefs = {
  topics: string[];
  format: "any" | PsyFormat;
  city: string;
  budget: number | null;
  days: ("weekdays" | "weekends")[];
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

export const TOPICS = ["тревога", "выгорание", "отношения", "самооценка", "травма", "утрата", "стресс", "сон", "прокрастинация", "одиночество"];
export const METHODS = ["КПТ", "ACT", "EMDR", "Схема-терапия", "Гештальт", "DBT", "Психоанализ"];

export const PSYS: Psy[] = [
  { id: 1, name: "Ирина Верещагина", portrait: "/catalog/irina.webp", tone: "green", verified: true, rating: 4.9, reviews: 128, method: "КПТ", methods: ["КПТ", "EMDR"], topics: ["тревога", "границы", "панические атаки"], price: 3500, minutes: 50, format: "both", city: "Москва", gender: "woman", languages: ["русский", "английский"], years: 8, sessions: 1240, clients: 210, responseHrs: 2, nextDays: 1, availableTimes: ["day", "evening"], exposure: 72, newcomer: false, tg: "irina_v", about: "Помогаю справляться с тревогой и вернуть опору. Работаю бережно, в темпе клиента, с опорой на доказательные методы.", education: ["МГУ, факультет психологии", "Сертификация по КПТ, АКБТ", "EMDR Europe, базовый курс"] },
  { id: 2, name: "Сергей Домбровский", portrait: "/catalog/sergey.webp", tone: "amber", verified: true, rating: 4.8, reviews: 94, method: "ACT", methods: ["ACT", "DBT"], topics: ["выгорание", "самооценка", "стресс"], price: 4000, minutes: 60, format: "online", city: "Санкт-Петербург", gender: "man", languages: ["русский"], years: 11, sessions: 1980, clients: 340, responseHrs: 3, nextDays: 4, availableTimes: ["morning", "day"], exposure: 84, newcomer: false, tg: "sergey_act", about: "Работаю с выгоранием и самооценкой. Помогаю находить ценности и действовать вопреки тревоге и прокрастинации.", education: ["СПбГУ, клиническая психология", "ACT — Ассоциация контекстно-поведенческой науки"] },
  { id: 3, name: "Наталья Юсупова", portrait: "/catalog/natalia.webp", tone: "purple", verified: true, rating: 4.7, reviews: 51, method: "Гештальт", methods: ["Гештальт"], topics: ["отношения", "утрата", "одиночество"], price: 3000, minutes: 60, format: "both", city: "Казань", gender: "woman", languages: ["русский", "татарский"], years: 6, sessions: 640, clients: 120, responseHrs: 6, nextDays: 2, availableTimes: ["day", "evening"], exposure: 48, newcomer: false, tg: "natalia_gestalt", about: "Про отношения, потерю и поиск себя. В центре — живой контакт и то, что происходит здесь и сейчас.", education: ["МИП, гештальт-терапия", "Программа работы с утратой"] },
  { id: 4, name: "Артём Белов", portrait: "/catalog/artem.webp", tone: "coral", verified: true, rating: 4.9, reviews: 173, method: "Схема-терапия", methods: ["Схема-терапия", "КПТ"], topics: ["травма", "тревога", "самооценка"], price: 4500, minutes: 50, format: "offline", city: "Москва", gender: "man", languages: ["русский"], years: 13, sessions: 2450, clients: 410, responseHrs: 4, nextDays: 8, availableTimes: ["evening"], exposure: 96, newcomer: false, tg: "artem_schema", about: "Схема-терапия при последствиях травмы и устойчивых сложностях в отношениях с собой и другими.", education: ["РНИМУ им. Пирогова", "Международное общество схема-терапии (ISST)"] },
  { id: 5, name: "Елена Маркова", portrait: "/catalog/elena.webp", tone: "amber", verified: true, rating: 4.8, reviews: 37, method: "КПТ", methods: ["КПТ", "DBT"], topics: ["эмоции", "отношения", "границы"], price: 3200, minutes: 50, format: "online", city: "Екатеринбург", gender: "woman", languages: ["русский"], years: 9, sessions: 780, clients: 145, responseHrs: 3, nextDays: 3, availableTimes: ["morning", "evening"], exposure: 41, newcomer: false, tg: "elena_markova", about: "Помогаю выдерживать сложные эмоции, строить границы и делать отношения безопаснее.", education: ["УрФУ, психология", "DBT Intensive, базовый курс"] },
  { id: 6, name: "Михаил Левин", portrait: "/catalog/mikhail.webp", tone: "green", verified: true, rating: 4.9, reviews: 62, method: "Психоанализ", methods: ["Психоанализ"], topics: ["отношения", "одиночество", "самооценка"], price: 5000, minutes: 50, format: "both", city: "Москва", gender: "man", languages: ["русский", "английский"], years: 17, sessions: 2210, clients: 290, responseHrs: 5, nextDays: 18, availableTimes: ["day"], exposure: 80, newcomer: false, tg: "mikhail_levin", about: "Исследуем повторяющиеся жизненные сценарии и то, как прошлый опыт влияет на близость и выборы сегодня.", education: ["МГУ, психология", "Институт психоанализа"] },
  { id: 7, name: "Анна Рыжова", portrait: "/catalog/anna.webp", tone: "salmon", verified: true, rating: 4.9, reviews: 12, method: "EMDR", methods: ["EMDR", "КПТ"], topics: ["травма", "тревога", "сон"], price: 3800, minutes: 50, format: "online", city: "Новосибирск", gender: "woman", languages: ["русский"], years: 5, sessions: 310, clients: 64, responseHrs: 2, nextDays: 2, availableTimes: ["day", "evening"], exposure: 18, newcomer: true, tg: "anna_emdr", about: "Работаю с последствиями травматического опыта и тревогой, возвращая чувство безопасности шаг за шагом.", education: ["НГУ, психология", "EMDR Europe, базовый курс"] },
  { id: 8, name: "Павел Корин", portrait: "/catalog/pavel.webp", tone: "sky", verified: true, rating: 4.6, reviews: 23, method: "КПТ", methods: ["КПТ"], topics: ["прокрастинация", "выгорание", "стресс"], price: 2800, minutes: 50, format: "online", city: "Пермь", gender: "man", languages: ["русский"], years: 4, sessions: 260, clients: 58, responseHrs: 1, nextDays: 1, availableTimes: ["morning", "day"], exposure: 24, newcomer: true, tg: "pavel_kpt", about: "Помогаю выйти из цикла откладывания, перегрузки и вины через понятные поведенческие шаги.", education: ["ПГНИУ, психология", "АКБТ, курс КПТ"] },
  { id: 9, name: "Майя Рид", portrait: "/catalog/maya.webp", tone: "green", verified: true, rating: 4.8, reviews: 46, method: "ACT", methods: ["ACT", "DBT"], topics: ["самооценка", "отношения", "стресс"], price: 4200, minutes: 60, format: "both", city: "Москва", gender: "woman", languages: ["русский", "английский"], years: 10, sessions: 1040, clients: 182, responseHrs: 4, nextDays: 6, availableTimes: ["evening"], exposure: 52, newcomer: false, tg: "maya_act", about: "Помогаю выстраивать жизнь вокруг ценностей, а не вокруг страха, самокритики и ожиданий окружающих.", education: ["НИУ ВШЭ, психология", "ACBS, ACT trainings"] },
  { id: 10, name: "Алексей Ким", portrait: "/catalog/alexey.webp", tone: "purple", verified: true, rating: 4.7, reviews: 31, method: "Гештальт", methods: ["Гештальт"], topics: ["отношения", "утрата", "одиночество"], price: 3300, minutes: 60, format: "online", city: "Владивосток", gender: "man", languages: ["русский"], years: 8, sessions: 730, clients: 132, responseHrs: 6, nextDays: 4, availableTimes: ["morning", "day"], exposure: 39, newcomer: false, tg: "alexey_kim", about: "Создаю спокойное пространство для переживания потерь, одиночества и сложностей в близких отношениях.", education: ["ДВФУ, психология", "МГИ, гештальт-терапия"] },
  { id: 11, name: "Вера Соколова", portrait: "/catalog/vera.webp", tone: "sky", verified: true, rating: 4.9, reviews: 88, method: "Схема-терапия", methods: ["Схема-терапия", "EMDR"], topics: ["травма", "границы", "самооценка"], price: 4700, minutes: 50, format: "both", city: "Санкт-Петербург", gender: "woman", languages: ["русский", "английский"], years: 18, sessions: 2690, clients: 365, responseHrs: 5, nextDays: 21, availableTimes: ["day"], exposure: 90, newcomer: false, tg: "vera_schema", about: "Помогаю менять устойчивые болезненные сценарии и формировать более поддерживающее отношение к себе.", education: ["СПбГУ, клиническая психология", "ISST Advanced Certification"] },
  { id: 12, name: "Денис Орлов", portrait: "/catalog/denis.webp", tone: "amber", verified: false, rating: 4.8, reviews: 5, method: "КПТ", methods: ["КПТ", "ACT"], topics: ["тревога", "стресс", "сон"], price: 2600, minutes: 50, format: "online", city: "Самара", gender: "man", languages: ["русский"], years: 3, sessions: 120, clients: 34, responseHrs: 2, nextDays: 5, availableTimes: ["evening"], exposure: 8, newcomer: true, tg: "denis_orlov", about: "Короткая структурированная работа с тревогой, стрессом и нарушениями сна.", education: ["Самарский университет, психология", "АКБТ, базовый курс"] },
];

const formatFits = (psy: Psy, format: CatalogPrefs["format"] | CatalogFilters["format"]) => format === "any" || psy.format === "both" || psy.format === format;
const overlap = (a: string[], b: string[]) => a.filter((value) => b.includes(value)).length;

export function matchScore(psy: Psy, prefs: CatalogPrefs): number {
  let score = 18;
  if (prefs.topics.length) score += Math.min(42, overlap(psy.topics, prefs.topics) * 25);
  else score += 16;
  if (formatFits(psy, prefs.format)) score += 16; else score -= 30;
  if (prefs.city && prefs.format !== "online" && psy.city.toLowerCase() === prefs.city.toLowerCase()) score += 8;
  if (prefs.budget != null) score += psy.price <= prefs.budget ? 12 : Math.max(-16, 12 - Math.ceil((psy.price - prefs.budget) / 250) * 3);
  if (prefs.times.length) score += overlap(psy.availableTimes, prefs.times) * 4;
  if (prefs.gender !== "any") score += psy.gender === prefs.gender ? 6 : -8;
  if (prefs.language !== "any") score += psy.languages.includes(prefs.language) ? 5 : -10;
  if (prefs.minYears) score += psy.years >= prefs.minYears ? 5 : -8;
  if (psy.nextDays <= 7) score += 10; else if (psy.nextDays <= 14) score += 4;
  if (psy.verified) score += 4;
  const bayesian = (psy.rating * psy.reviews + 4.7 * 12) / (psy.reviews + 12);
  score += Math.max(0, Math.min(8, (bayesian - 4.3) * 12));
  return Math.round(score);
}

export function reasonsFor(psy: Psy, prefs: CatalogPrefs): string[] {
  const reasons: string[] = [];
  const topic = prefs.topics.find((value) => psy.topics.includes(value));
  if (topic) reasons.push(`работает с запросом «${topic}»`);
  if (prefs.budget != null && psy.price <= prefs.budget) reasons.push("подходит по бюджету");
  if (psy.nextDays <= 2) reasons.push(psy.nextDays === 1 ? "есть окно завтра" : "есть окно послезавтра");
  else if (psy.nextDays <= 7) reasons.push("есть окно на этой неделе");
  if (psy.newcomer && reasons.length < 2) reasons.push("новый специалист");
  return reasons.slice(0, 2);
}

export function personalSelection(prefs: CatalogPrefs): Psy[] {
  const available = PSYS.filter((psy) => psy.nextDays <= 14).sort((a, b) => matchScore(b, prefs) - matchScore(a, prefs));
  const picked: Psy[] = available.slice(0, 3);
  const underexposed = available.filter((psy) => !picked.includes(psy)).sort((a, b) => a.exposure - b.exposure || matchScore(b, prefs) - matchScore(a, prefs));
  picked.push(...underexposed.slice(0, 2));
  const newcomer = available.find((psy) => psy.newcomer && !picked.includes(psy) && matchScore(psy, prefs) >= 35);
  if (newcomer) picked.push(newcomer);
  for (const psy of available) if (picked.length < 6 && !picked.includes(psy)) picked.push(psy);
  return picked.slice(0, 6);
}

export function filterCatalog(filters: CatalogFilters): Psy[] {
  const query = filters.query.trim().toLowerCase();
  return PSYS.filter((psy) => {
    if (query && ![psy.name, psy.method, ...psy.methods, ...psy.topics].some((value) => value.toLowerCase().includes(query))) return false;
    if (filters.topics.length && !overlap(psy.topics, filters.topics)) return false;
    if (filters.methods.length && !overlap(psy.methods, filters.methods)) return false;
    if (!formatFits(psy, filters.format)) return false;
    if (filters.city && psy.city.toLowerCase() !== filters.city.toLowerCase()) return false;
    if (filters.maxPrice != null && psy.price > filters.maxPrice) return false;
    if (filters.gender !== "any" && psy.gender !== filters.gender) return false;
    if (filters.language !== "any" && !psy.languages.includes(filters.language)) return false;
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
