import type { IconName } from "@/components/icons";
import { apiFetch } from "@/lib/api";
import type { Mood } from "@/lib/clients";

// Колесо баланса — расширенная методика на основе Wheel of Life (P. Meyer),
// Personal Wellbeing Index, WHO-5 и Valued Living Questionnaire.
// 10 сфер × 3 утверждения = 30 вопросов, каждое 0–10. Средняя по сфере строит колесо.
export type WheelDomain = { key: string; label: string; short: string; icon: IconName; color: string; edge: string; questions: string[] };

export const WHEEL: WheelDomain[] = [
  { key: "health", label: "Здоровье и тело", short: "Здоровье", icon: "pulse", color: "var(--green)", edge: "var(--green-edge)", questions: [
    "Мне хватает сил и энергии на день",
    "Я доволен(льна) своим сном и режимом",
    "Я забочусь о теле: движение, питание, отдых",
  ] },
  { key: "emotions", label: "Эмоции и психика", short: "Эмоции", icon: "mood", color: "var(--purple)", edge: "var(--purple-edge)", questions: [
    "Моё настроение в целом устойчиво",
    "Я справляюсь со стрессом и тревогой",
    "Я умею замечать и выражать свои чувства",
  ] },
  { key: "relationships", label: "Близкие отношения", short: "Отношения", icon: "heart", color: "var(--coral)", edge: "var(--coral-edge)", questions: [
    "В близких отношениях есть тепло и поддержка",
    "Меня понимают и принимают таким(ой), как есть",
    "Мне хватает близости и доверия",
  ] },
  { key: "family", label: "Семья и дом", short: "Семья", icon: "home", color: "var(--amber)", edge: "var(--amber-edge)", questions: [
    "Дома я чувствую себя спокойно и в безопасности",
    "Отношения с семьёй меня скорее радуют",
    "Быт и домашние дела под контролем",
  ] },
  { key: "social", label: "Друзья и общество", short: "Друзья", icon: "users", color: "var(--sky)", edge: "#5f95ab", questions: [
    "Есть люди, на которых можно опереться",
    "Я чувствую себя частью сообщества",
    "Мне хватает живого общения",
  ] },
  { key: "work", label: "Работа и дело", short: "Работа", icon: "spark", color: "var(--salmon)", edge: "var(--salmon-edge)", questions: [
    "Моя работа или учёба имеет для меня смысл",
    "Я справляюсь с нагрузкой без выгорания",
    "Я вижу развитие и признание усилий",
  ] },
  { key: "finance", label: "Финансы и стабильность", short: "Финансы", icon: "chart", color: "var(--mood-4)", edge: "#8a9a4e", questions: [
    "Мне хватает денег на нужное без сильной тревоги",
    "Я чувствую финансовую устойчивость",
    "Я спокоен(йна) за своё будущее",
  ] },
  { key: "growth", label: "Рост и смысл", short: "Рост", icon: "book", color: "var(--pink)", edge: "#cf7a6f", questions: [
    "Я развиваюсь и учусь новому",
    "Моя жизнь наполнена смыслом",
    "Я живу в согласии со своими ценностями",
  ] },
  { key: "leisure", label: "Отдых и радость", short: "Отдых", icon: "sun", color: "var(--mood-3)", edge: "#caa64a", questions: [
    "У меня есть время на любимые занятия",
    "Я умею отдыхать и восстанавливаться",
    "В моей жизни достаточно радости и игры",
  ] },
  { key: "environment", label: "Среда и порядок", short: "Среда", icon: "compass", color: "var(--mood-5)", edge: "#5a9d6b", questions: [
    "Пространство вокруг удобно и приятно",
    "Мой день организован так, как мне подходит",
    "Меня окружает то, что даёт ресурс",
  ] },
];

export const WHEEL_QUESTION_COUNT = WHEEL.reduce((n, d) => n + d.questions.length, 0); // 30
export type WheelAnswers = Record<string, number[]>; // key -> [0..10] × questions
export type WheelResult = { answers: WheelAnswers; completedAt: string };
export type TherapyState = { moods: Mood[]; wheel: WheelResult | null; tutorialSeen: boolean };

export function domainScore(result: WheelResult | null, key: string): number {
  const arr = result?.answers[key];
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length; // 0..10
}
export function wheelPercent(result: WheelResult | null): number {
  if (!result) return 0;
  const mean = WHEEL.reduce((s, d) => s + domainScore(result, d.key), 0) / WHEEL.length;
  return Math.round(mean * 10); // 0..100
}
export function wheelLowest(result: WheelResult | null, n = 2): WheelDomain[] {
  if (!result) return [];
  return [...WHEEL].sort((a, b) => domainScore(result, a.key) - domainScore(result, b.key)).slice(0, n);
}

export type WheelBand = { key: string; label: string; hint: string; tone: "salmon" | "amber" | "green" };
export function wheelBand(pct: number): WheelBand {
  if (pct < 40) return { key: "low", label: "разбалансировано", hint: "Несколько сфер сильно проседают — хороший повод обсудить приоритеты с терапевтом.", tone: "salmon" };
  if (pct < 60) return { key: "mid", label: "неровно", hint: "Баланс неравномерный: где-то ресурс, где-то нехватка. Посмотрите, что проседает.", tone: "amber" };
  if (pct < 80) return { key: "ok", label: "в целом ровно", hint: "Сферы жизни в целом сбалансированы, есть на что опереться.", tone: "green" };
  return { key: "high", label: "гармонично", hint: "Высокая удовлетворённость по большинству сфер жизни.", tone: "green" };
}

export const getMyTherapy = () => apiFetch<TherapyState>("/my/therapy");
export const updateMyTherapy = (patch: { mood?: number; emotions?: string[]; wheel?: WheelAnswers; tutorialSeen?: boolean }) =>
  apiFetch<TherapyState>("/my/therapy", { method: "PATCH", body: JSON.stringify(patch) });
export const getClientTherapy = (clientId: number) => apiFetch<TherapyState>(`/clients/${clientId}/therapy`);
