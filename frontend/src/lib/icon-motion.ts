import type { IconName } from "@/components/icons";

/**
 * Кадры «трюка» иконки: у каждого раздела свой характер движения, а не общее
 * покачивание. Только transform — ни фильтров, ни теней: вебвью Telegram
 * пересчитывает их на каждом кадре и проседает.
 */
export type IconTrick = Record<string, number[]>;

const TRICKS: Partial<Record<IconName, IconTrick>> = {
  // Дом подпрыгивает и приземляется с приседанием.
  home: { y: [0, -11, 0, -4, 0], scaleY: [1, 0.76, 1.16, 0.92, 1], scaleX: [1, 1.18, 0.9, 1.05, 1] },
  // Люди перекликаются: качнулись друг к другу и обратно.
  users: { rotate: [0, -18, 14, -7, 0], scale: [1, 1.16, 0.95, 1.06, 1] },
  // Календарь перелистывает страницу.
  calendar: { rotateY: [0, 180, 360], scale: [1, 1.12, 0.96, 1] },
  // Квадраты инструментов проворачиваются на четверть оборота.
  tools: { rotate: [0, 95, 88, 90], scale: [1, 0.82, 1.1, 1] },
  // Стрелка компаса ищет направление и делает полный круг.
  compass: { rotate: [0, -34, 372, 360], scale: [1, 1.1, 0.97, 1] },
  // Лотос раскрывается.
  therapy: { scale: [1, 0.68, 1.3, 0.94, 1], rotate: [0, -24, 16, 0] },
  // Сердце бьётся дважды.
  heart: { scale: [1, 1.32, 0.94, 1.2, 1] },
};

const FALLBACK: IconTrick = { scale: [1, 1.26, 0.9, 1.1, 1], rotate: [0, -12, 9, 0] };

export function iconTrick(name: IconName): IconTrick {
  return TRICKS[name] ?? FALLBACK;
}
