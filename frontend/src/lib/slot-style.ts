import type { IconName } from "@/components/icons";

// Раскраска окна по времени: утро (<13) светлее, день — жёлтый, вечер (>=18) — лавандовый.
// Иконка: солнце днём, луна вечером.
export function slotStyle(hour: number): { bg: string; bd: string; icon: IconName; ic: string } {
  if (hour >= 18) return { bg: "var(--purple)", bd: "var(--purple-edge)", icon: "moon", ic: "var(--purple-edge)" };
  const morning = hour < 13;
  return { bg: morning ? "var(--amber-soft)" : "var(--head)", bd: "var(--amber-edge)", icon: "sun", ic: "var(--amber-edge)" };
}
