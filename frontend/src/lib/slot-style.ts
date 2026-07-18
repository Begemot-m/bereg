import type { IconName } from "@/components/icons";

// Раскраска окна по времени (абсолютные цвета, не зависят от раздела):
// утро (<13) — желтее, день — амбер (как в настройках), вечер (>=18) — лавандовый.
// Иконка: солнце днём, луна вечером.
export function slotStyle(hour: number): { bg: string; bd: string; icon: IconName; ic: string } {
  if (hour >= 18) return { bg: "var(--purple)", bd: "var(--purple-edge)", icon: "moon", ic: "var(--purple-edge)" };
  const morning = hour < 13;
  return { bg: morning ? "#f4d64f" : "var(--amber)", bd: "var(--amber-edge)", icon: "sun", ic: "var(--amber-edge)" };
}
