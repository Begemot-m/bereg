import type { IconName } from "@/components/icons";

// Раскраска окна по времени (абсолютные цвета, не зависят от раздела):
// утро (<13) — желтее, день — амбер (как в настройках), вечер (>=18) — лавандовый.
// Иконка: солнце днём, луна вечером.
export function slotStyle(hour: number): { bg: string; bd: string; icon: IconName; ic: string } {
  if (hour >= 18) return { bg: "var(--purple)", bd: "var(--purple-edge)", icon: "moon", ic: "var(--purple-edge)" };
  if (hour < 13) return { bg: "var(--slot-morn)", bd: "var(--slot-morn-e)", icon: "sun", ic: "var(--slot-morn-e)" };
  return { bg: "var(--slot-day)", bd: "var(--slot-day-e)", icon: "sun", ic: "var(--slot-day-e)" };
}
