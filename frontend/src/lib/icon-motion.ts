import type { IconName } from "@/components/icons";

/**
 * Живой цикл иконки раздела: у каждого свой характер, и он не заканчивается.
 * Кадры замкнуты — первый равен последнему, поэтому петля идёт без рывка, а
 * повторы базового значения в хвосте дают паузу внутри цикла: иконка дышит,
 * а не дёргается без остановки.
 *
 * Только transform — ни фильтров, ни теней: вебвью Telegram пересчитывает их
 * на каждом кадре и проседает.
 */
export type IconTrick = Record<string, number[]>;

export type IconLoop = { animate: IconTrick; duration: number };

const LOOPS: Partial<Record<IconName, IconLoop>> = {
  // Дом дышит на месте. Прыжок с приседанием отсюда убран: на главной он
  // дёргался в глаза при каждом заходе.
  home: {
    animate: { scale: [1, 1.09, 1, 1, 1, 1] },
    duration: 3.2,
  },
  // Люди перекликаются: качнулись друг к другу и обратно.
  users: {
    animate: {
      rotate: [0, -17, 13, -7, 0, 0, 0, 0],
      scale: [1, 1.14, 0.96, 1.05, 1, 1, 1, 1],
    },
    duration: 3.6,
  },
  // Календарь перелистывает страницу — оборот вокруг вертикали.
  calendar: {
    animate: {
      rotateY: [0, 180, 360, 360, 360, 360],
      scale: [1, 1.1, 1, 1, 1, 1],
    },
    duration: 4.2,
  },
  // Квадраты инструментов проворачиваются по четверти с остановками.
  tools: {
    animate: {
      rotate: [0, 90, 90, 180, 180, 270, 270, 360],
      scale: [1, 0.88, 1.06, 0.88, 1.06, 0.88, 1.06, 1],
    },
    duration: 5.4,
  },
  // Стрелка компаса ищет направление и уходит на полный круг.
  compass: {
    animate: {
      rotate: [0, -32, 18, -12, 360, 360, 360, 360],
      scale: [1, 1.08, 0.98, 1.06, 1, 1, 1, 1],
    },
    duration: 4.8,
  },
  // Лотос раскрывается и снова собирается — медленное дыхание.
  therapy: {
    animate: {
      scale: [1, 0.74, 1.26, 0.96, 1.08, 1, 1, 1],
      rotate: [0, -22, 14, -6, 0, 0, 0, 0],
    },
    duration: 4,
  },
  // Сердце бьётся дважды и отдыхает — как настоящий пульс.
  heart: {
    animate: { scale: [1, 1.3, 0.96, 1.18, 1, 1, 1, 1] },
    duration: 2.6,
  },
};

const FALLBACK: IconLoop = {
  animate: {
    scale: [1, 1.2, 0.93, 1.08, 1, 1, 1, 1],
    rotate: [0, -11, 8, -4, 0, 0, 0, 0],
  },
  duration: 3.6,
};

export function iconLoop(name: IconName): IconLoop {
  return LOOPS[name] ?? FALLBACK;
}

export function iconTrick(name: IconName): IconTrick {
  return iconLoop(name).animate;
}
