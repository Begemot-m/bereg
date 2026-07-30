// Семейства Geneva Emotion Wheel (Scherer, Shuman, Fontaine & Soriano, 2013).
// Модель раскладывает 20 часто изучаемых эмоций по приятности и ощущению
// контроля. Здесь они сгруппированы только для цвета и удобного выбора.
export type EmotionFamily = { key: string; label: string; tone: string; basic: string; items: string[] };

export const EMOTION_FAMILIES: EmotionFamily[] = [
  { key: "positive-high", label: "Энергия и радость", tone: "amber", basic: "радость", items: ["интерес", "веселье", "гордость", "радость", "удовольствие"] },
  { key: "positive-low", label: "Тепло и опора", tone: "green", basic: "облегчение", items: ["любовь", "восхищение", "облегчение", "сочувствие"] },
  { key: "negative-low", label: "Уязвимость", tone: "purple", basic: "печаль", items: ["печаль", "вина", "сожаление", "стыд", "разочарование"] },
  { key: "negative-high", label: "Защита и напряжение", tone: "coral", basic: "страх", items: ["страх", "отвращение", "презрение", "ненависть", "гнев", "напряжение"] },
];

const TONE_OF: Record<string, string> = Object.fromEntries(
  EMOTION_FAMILIES.flatMap((family) => family.items.map((item) => [item, family.tone])),
);

export const emotionTone = (name: string): string => TONE_OF[name] ?? "amber";
export const ALL_EMOTIONS = EMOTION_FAMILIES.flatMap((family) => family.items);

// Какие семьи предлагать под выбранной точкой шкалы: по валентности эмоции.
const BY_LEVEL: Record<number, string[]> = {
  1: ["negative-low", "negative-high"],
  2: ["negative-low", "negative-high"],
  3: ["negative-low", "positive-low", "negative-high", "positive-high"],
  4: ["positive-low", "positive-high"],
  5: ["positive-high", "positive-low"],
};

export function suggestFamilies(mood: number): EmotionFamily[] {
  const keys = BY_LEVEL[Math.min(5, Math.max(1, Math.round(mood)))] ?? [];
  return keys.map((key) => EMOTION_FAMILIES.find((family) => family.key === key)!).filter(Boolean);
}

const SUGGESTIONS_BY_LEVEL: Record<number, string[]> = {
  1: ["печаль", "разочарование", "страх", "стыд", "вина", "сожаление", "напряжение", "гнев"],
  2: ["печаль", "сожаление", "разочарование", "страх", "напряжение", "отвращение", "гнев", "вина"],
  3: ["интерес", "сочувствие", "облегчение", "напряжение", "сожаление", "разочарование", "удовольствие", "гордость"],
  4: ["интерес", "облегчение", "удовольствие", "радость", "любовь", "гордость", "восхищение", "веселье"],
  5: ["радость", "веселье", "удовольствие", "гордость", "любовь", "восхищение", "облегчение", "интерес"],
};

export function suggestEmotions(mood: number): string[] {
  return SUGGESTIONS_BY_LEVEL[Math.min(5, Math.max(1, Math.round(mood)))] ?? [];
}
