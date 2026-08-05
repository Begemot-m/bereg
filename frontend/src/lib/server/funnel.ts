export type FunnelStep = { key: string; label: string; n: number };

export type FunnelRow = FunnelStep & {
  /** Доля от первой ступени, в процентах. */
  ofFirst: number;
  /** Доля от предыдущей ступени — здесь и видно, где именно теряем. */
  ofPrev: number;
};

/**
 * Проценты для ступеней воронки.
 *
 * Считаем обе доли: от начала и от предыдущего шага. Только от начала — и
 * провал размазывается по всей цепочке: 40 % на четвёртом шаге не говорит,
 * потеряли мы людей на нём или ещё на втором.
 *
 * Пустая первая ступень не должна превращаться в NaN или в «100 %»: на
 * пустой базе честный ответ — ноль.
 */
export function buildFunnel(steps: FunnelStep[]): FunnelRow[] {
  const first = steps[0]?.n ?? 0;

  return steps.map((s, i) => {
    const prev = i === 0 ? first : steps[i - 1].n;
    return {
      ...s,
      ofFirst: first > 0 ? Math.round((s.n / first) * 100) : 0,
      ofPrev: prev > 0 ? Math.round((s.n / prev) * 100) : 0,
    };
  });
}
