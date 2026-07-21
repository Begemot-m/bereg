// Палитра состояний — по семействам базовых эмоций (Плутчик / круг эмоций),
// чтобы отметка не сводилась к пятибалльной шкале.
export type EmotionFamily = { key: string; label: string; tone: string; items: string[] };

export const EMOTION_FAMILIES: EmotionFamily[] = [
  { key: "joy", label: "Радость и подъём", tone: "green", items: ["радость", "воодушевление", "интерес", "благодарность", "гордость", "нежность"] },
  { key: "calm", label: "Спокойствие", tone: "green", items: ["спокойствие", "опора", "облегчение", "принятие", "сосредоточенность"] },
  { key: "sad", label: "Грусть", tone: "purple", items: ["грусть", "тоска", "одиночество", "разочарование", "уязвимость", "апатия"] },
  { key: "fear", label: "Тревога и страх", tone: "amber", items: ["тревога", "страх", "напряжение", "растерянность", "стыд", "вина"] },
  { key: "anger", label: "Злость", tone: "coral", items: ["злость", "раздражение", "обида", "зависть", "бессилие"] },
  { key: "tired", label: "Усталость", tone: "salmon", items: ["усталость", "опустошение", "скука", "рассеянность"] },
];

const TONE_OF: Record<string, string> = Object.fromEntries(
  EMOTION_FAMILIES.flatMap((family) => family.items.map((item) => [item, family.tone])),
);

export const emotionTone = (name: string): string => TONE_OF[name] ?? "amber";

// Какие семьи эмоций предлагать под выбранной точкой шкалы.
const BY_LEVEL: Record<number, string[]> = {
  1: ["sad", "fear", "anger", "tired"],
  2: ["sad", "fear", "tired", "anger"],
  3: ["tired", "calm", "fear", "sad"],
  4: ["calm", "joy", "tired"],
  5: ["joy", "calm"],
};

export function suggestFamilies(mood: number): EmotionFamily[] {
  const keys = BY_LEVEL[Math.min(5, Math.max(1, Math.round(mood)))] ?? [];
  return keys.map((key) => EMOTION_FAMILIES.find((family) => family.key === key)!).filter(Boolean);
}
export const ALL_EMOTIONS = EMOTION_FAMILIES.flatMap((family) => family.items);
