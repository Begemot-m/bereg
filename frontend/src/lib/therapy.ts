import type { IconName } from "@/components/icons";
import { apiFetch } from "@/lib/api";
import type { Mood } from "@/lib/clients";

// Колесо баланса. Собрано по методикам, а не на глаз:
// — сферы и форма круга — Wheel of Life (P. Meyer);
// — вопрос об удовлетворённости и подсчёт индекса — Personal Wellbeing Index
//   (International Wellbeing Group, Cummins et al.): шкала 0–10, индекс = средняя
//   по сферам × 10, нормативный диапазон 70–80 из 100;
// — вопрос о важности — Valued Living Questionnaire (Wilson et al.);
// — что брать в работу первым: важность × нехватка (importance-performance
//   analysis, Martilla & James) — низкая сфера, которая человеку не важна,
//   вытягивания не требует.
// 10 сфер × 2 вопроса = 20, каждый 0–10.
export type WheelQuestion = { text: string; kind: "satisfaction" | "importance"; low: string; high: string };
export type WheelDomain = { key: string; label: string; short: string; icon: IconName; color: string; edge: string; questions: WheelQuestion[] };

const sat = (text: string): WheelQuestion => ({ text, kind: "satisfaction", low: "совсем не доволен(льна)", high: "полностью доволен(льна)" });
const imp = (text: string): WheelQuestion => ({ text, kind: "importance", low: "сейчас не важно", high: "очень важно" });

export const WHEEL: WheelDomain[] = [
  { key: "health", label: "Здоровье и тело", short: "Здоровье", icon: "pulse", color: "var(--green)", edge: "var(--green-edge)", questions: [
    sat("Насколько вы довольны своим здоровьем, сном и запасом сил?"),
    imp("Насколько вам сейчас важно заняться телом и здоровьем?"),
  ] },
  { key: "emotions", label: "Эмоции и психика", short: "Эмоции", icon: "mood", color: "var(--purple)", edge: "var(--purple-edge)", questions: [
    sat("Насколько вы довольны своим состоянием в последние две недели?"),
    imp("Насколько вам сейчас важно, чтобы состояние стало ровнее?"),
  ] },
  { key: "relationships", label: "Любовь и близость", short: "Любовь", icon: "heart", color: "var(--coral)", edge: "var(--coral-edge)", questions: [
    sat("Насколько вы довольны своими близкими, любовными отношениями?"),
    imp("Насколько вам сейчас важна близость с любимым человеком?"),
  ] },
  { key: "family", label: "Семья и дом", short: "Семья", icon: "home", color: "var(--amber)", edge: "var(--amber-edge)", questions: [
    sat("Насколько вы довольны отношениями в семье и жизнью дома?"),
    imp("Насколько вам сейчас важны семья и дом?"),
  ] },
  { key: "social", label: "Друзья и общество", short: "Друзья", icon: "users", color: "var(--sky)", edge: "#5f95ab", questions: [
    sat("Насколько вы довольны дружбой и своим кругом общения?"),
    imp("Насколько вам сейчас важны друзья и живое общение?"),
  ] },
  { key: "work", label: "Работа и дело", short: "Работа", icon: "spark", color: "var(--salmon)", edge: "var(--salmon-edge)", questions: [
    sat("Насколько вы довольны работой или учёбой и тем, чего в них добиваетесь?"),
    imp("Насколько вам сейчас важно продвинуться в работе или учёбе?"),
  ] },
  { key: "finance", label: "Финансы и стабильность", short: "Финансы", icon: "chart", color: "var(--mood-4)", edge: "#8a9a4e", questions: [
    sat("Насколько вы довольны своим материальным положением?"),
    imp("Насколько вам сейчас важна финансовая устойчивость?"),
  ] },
  { key: "growth", label: "Рост и смысл", short: "Рост", icon: "book", color: "var(--pink)", edge: "#cf7a6f", questions: [
    sat("Насколько вы довольны тем, как растёте, и смыслом своей жизни?"),
    imp("Насколько вам сейчас важны развитие и смысл?"),
  ] },
  { key: "leisure", label: "Отдых и радость", short: "Отдых", icon: "sun", color: "var(--mood-3)", edge: "#caa64a", questions: [
    sat("Насколько вы довольны отдыхом и тем, сколько в жизни радости?"),
    imp("Насколько вам сейчас важно время на отдых и любимые занятия?"),
  ] },
  { key: "environment", label: "Среда и порядок", short: "Среда", icon: "compass", color: "var(--mood-5)", edge: "var(--green-edge)", questions: [
    sat("Насколько вы довольны своей безопасностью и тем, как устроен ваш день?"),
    imp("Насколько вам сейчас важно навести порядок в среде и режиме?"),
  ] },
];

export const WHEEL_QUESTION_COUNT = WHEEL.reduce((n, d) => n + d.questions.length, 0); // 20
const SAT = 0, IMP = 1;
export type WheelAnswers = Record<string, number[]>; // key -> [удовлетворённость, важность], 0..10
export type WheelResult = { answers: WheelAnswers; completedAt: string };
/** Практика позитивного замечания: одна строка в день о том, что хорошего он принёс. */
export type GoodNote = { date: string; text: string };
export type SessionReflection = {
  appointmentId: number;
  startsAt: string;
  status: string;
  therapistName: string;
  preparation: string;
  takeaway: string;
  feeling: number | null;
  updatedAt: string;
};
export type ReflectionPatch = {
  appointmentId: number;
  preparation?: string;
  takeaway?: string;
  feeling?: number | null;
};
export type NotesModuleState = { enabled: boolean; shared: boolean; psychologistEnabled: boolean };
export type TherapyState = { moods: Mood[]; notes: GoodNote[]; board: string; wheel: WheelResult | null; tutorialSeen: boolean; reflections: SessionReflection[]; notesModule: NotesModuleState };

/** Удовлетворённость сферой, 0–10 — это и есть ось колеса.
 *  Колёса, пройденные по старой схеме (три утверждения согласия), считаются
 *  как раньше — средней, иначе у клиента с историей поехали бы прошлые замеры. */
export function domainScore(result: WheelResult | null, key: string): number {
  const arr = result?.answers[key];
  if (!arr || arr.length === 0) return 0;
  if (arr.length !== WHEEL[0].questions.length) return arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr[SAT];
}
/** Важность сферы, 0–10. У старых колёс её не спрашивали — там null. */
export function domainImportance(result: WheelResult | null, key: string): number | null {
  const arr = result?.answers[key];
  return arr && arr.length === WHEEL[0].questions.length ? arr[IMP] : null;
}
/** Что брать в работу первым: важно человеку и при этом не хватает. 0–10. */
export function domainFocus(result: WheelResult | null, key: string): number | null {
  const importance = domainImportance(result, key);
  if (importance === null) return null;
  return (importance * (10 - domainScore(result, key))) / 10;
}
/**
 * Индекс колеса, 0–100. `keys` — считать только по этим сферам: пока колесо
 * заполняют, непройденные сферы лежат на середине шкалы, и средним по всем
 * восьми число тянуло к 50 % независимо от ответов.
 */
export function wheelPercent(result: WheelResult | null, keys?: string[]): number {
  if (!result) return 0;
  const list = keys ?? WHEEL.map((d) => d.key);
  if (list.length === 0) return 0;
  const mean = list.reduce((s, key) => s + domainScore(result, key), 0) / list.length;
  return Math.round(mean * 10); // 0..100
}
export function wheelLowest(result: WheelResult | null, n = 2): WheelDomain[] {
  if (!result) return [];
  return [...WHEEL].sort((a, b) => domainScore(result, a.key) - domainScore(result, b.key)).slice(0, n);
}
/** Сферы, с которых стоит начать: важные и проседающие. Если важность не
 *  спрашивали (старое колесо) — просто самые низкие. */
export function wheelFocus(result: WheelResult | null, n = 2): WheelDomain[] {
  if (!result) return [];
  if (domainFocus(result, WHEEL[0].key) === null) return wheelLowest(result, n);
  return [...WHEEL].sort((a, b) => (domainFocus(result, b.key) ?? 0) - (domainFocus(result, a.key) ?? 0)).slice(0, n);
}

// Полосы — по нормам Personal Wellbeing Index: у населения индекс держится в
// диапазоне 70–80 из 100, ниже 50 внутренние опоры перестают справляться.
export type WheelBand = { key: string; label: string; hint: string; tone: "salmon" | "amber" | "green" };
export function wheelBand(pct: number): WheelBand {
  if (pct < 50) return { key: "low", label: "ниже нормы", hint: "По методике PWI это уровень, на котором привычные опоры уже не держат: у большинства людей индекс между 70 и 80. Хороший повод разобрать с терапевтом, что тянет вниз.", tone: "salmon" };
  if (pct < 70) return { key: "mid", label: "ниже среднего", hint: "До нормативных 70–80 не хватает: часть сфер держит, часть проседает. Смотрите, где важное совпало с нехваткой.", tone: "amber" };
  if (pct <= 80) return { key: "ok", label: "в норме", hint: "Столько же, сколько у большинства людей: 70–80 — нормативный диапазон индекса благополучия.", tone: "green" };
  return { key: "high", label: "выше нормы", hint: "Удовлетворённость выше обычного диапазона — есть на что опереться в трудный период.", tone: "green" };
}

export const getMyTherapy = () => apiFetch<TherapyState>("/my/therapy");
export const updateMyTherapy = (patch: { mood?: number; emotions?: string[]; good?: string; board?: string; wheel?: WheelAnswers; tutorialSeen?: boolean; reflection?: ReflectionPatch; notesModule?: { enabled?: boolean; shared?: boolean } }) =>
  apiFetch<TherapyState>("/my/therapy", { method: "PATCH", body: JSON.stringify(patch) });
export const getClientTherapy = (clientId: number) => apiFetch<TherapyState>(`/clients/${clientId}/therapy`);
export const setClientNotesModule = (clientId: number, enabled: boolean) =>
  apiFetch<TherapyState>(`/clients/${clientId}/therapy`, { method: "PATCH", body: JSON.stringify({ notesModuleEnabled: enabled }) });
