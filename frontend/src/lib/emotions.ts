// Базовые эмоции по научным классификаторам: восемь первичных эмоций
// колеса Плутчика (Plutchik, 1980) с тремя уровнями интенсивности каждая.
// Шесть из них — базовые по Экману (радость, печаль, страх, гнев, отвращение, удивление).
export type EmotionFamily = { key: string; label: string; tone: string; basic: string; items: string[] };

export const EMOTION_FAMILIES: EmotionFamily[] = [
  { key: "joy", label: "Радость", tone: "amber", basic: "радость", items: ["безмятежность", "радость", "восторг"] },
  { key: "trust", label: "Доверие", tone: "green", basic: "доверие", items: ["принятие", "доверие", "восхищение"] },
  { key: "fear", label: "Страх", tone: "purple", basic: "страх", items: ["опасение", "страх", "ужас"] },
  { key: "surprise", label: "Удивление", tone: "salmon", basic: "удивление", items: ["растерянность", "удивление", "изумление"] },
  { key: "sadness", label: "Печаль", tone: "purple", basic: "печаль", items: ["задумчивость", "печаль", "скорбь"] },
  { key: "disgust", label: "Отвращение", tone: "coral", basic: "отвращение", items: ["скука", "неприязнь", "отвращение"] },
  { key: "anger", label: "Гнев", tone: "coral", basic: "гнев", items: ["досада", "гнев", "ярость"] },
  { key: "anticipation", label: "Предвкушение", tone: "green", basic: "предвкушение", items: ["интерес", "предвкушение", "готовность"] },
];

const TONE_OF: Record<string, string> = Object.fromEntries(
  EMOTION_FAMILIES.flatMap((family) => family.items.map((item) => [item, family.tone])),
);

export const emotionTone = (name: string): string => TONE_OF[name] ?? "amber";
export const ALL_EMOTIONS = EMOTION_FAMILIES.flatMap((family) => family.items);

// Какие семьи предлагать под выбранной точкой шкалы: по валентности эмоции.
const BY_LEVEL: Record<number, string[]> = {
  1: ["sadness", "fear", "anger", "disgust"],
  2: ["sadness", "fear", "disgust", "anger"],
  3: ["surprise", "anticipation", "sadness", "trust"],
  4: ["trust", "anticipation", "joy", "surprise"],
  5: ["joy", "trust", "anticipation"],
};

export function suggestFamilies(mood: number): EmotionFamily[] {
  const keys = BY_LEVEL[Math.min(5, Math.max(1, Math.round(mood)))] ?? [];
  return keys.map((key) => EMOTION_FAMILIES.find((family) => family.key === key)!).filter(Boolean);
}

const SUGGESTIONS_BY_LEVEL: Record<number, string[]> = {
  1: ["скорбь", "ужас", "ярость", "отвращение", "печаль", "страх", "гнев", "неприязнь"],
  2: ["печаль", "страх", "досада", "скука", "задумчивость", "опасение", "неприязнь", "гнев"],
  3: ["растерянность", "удивление", "интерес", "задумчивость", "принятие", "досада", "готовность", "скука"],
  4: ["радость", "доверие", "интерес", "предвкушение", "принятие", "удивление", "готовность", "безмятежность"],
  5: ["восторг", "радость", "восхищение", "доверие", "предвкушение", "безмятежность", "готовность", "интерес"],
};

export function suggestEmotions(mood: number): string[] {
  return SUGGESTIONS_BY_LEVEL[Math.min(5, Math.max(1, Math.round(mood)))] ?? [];
}
