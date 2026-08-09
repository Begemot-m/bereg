import type { IconName } from "@/components/icons";

// Окна графика красятся по времени суток сплошным градиентом: утро
// светло-зелёное, вечер лавандовый. День читается как переход сверху вниз, и по
// цвету блока видно, к какой части дня он относится, без чтения цифр.
const MORNING = { fill: [230, 240, 220], edge: [91, 128, 66] };
const EVENING = { fill: [214, 203, 236], edge: [144, 119, 189] };
const rgb = (c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const mix = (from: number[], to: number[], k: number) => from.map((v, i) => Math.round(v + (to[i] - v) * k));

export function dayTint(hour: number) {
  const k = Math.min(1, Math.max(0, (hour - 7) / 14)); // 07:00 — утро, 21:00 — вечер
  return { fill: rgb(mix(MORNING.fill, EVENING.fill, k)), edge: rgb(mix(MORNING.edge, EVENING.edge, k)) };
}

export const DAY_TINT_ENDS = {
  morning: { bg: rgb(MORNING.fill), bd: rgb(MORNING.edge) },
  evening: { bg: rgb(EVENING.fill), bd: rgb(EVENING.edge) },
};

// Иконка: солнце днём, луна вечером.
export function slotStyle(hour: number): { bg: string; bd: string; icon: IconName; ic: string } {
  const tint = dayTint(hour);
  return { bg: tint.fill, bd: tint.edge, icon: hour >= 18 ? "moon" : "sun", ic: tint.edge };
}
