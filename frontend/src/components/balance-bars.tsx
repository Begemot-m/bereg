import { BALANCE_KEYS, BALANCE_META, type BalanceResult } from "@/lib/therapy";

export function BalanceBars({ balance, compact = false }: { balance: BalanceResult; compact?: boolean }) {
  return (
    <div className={compact ? "space-y-2.5" : "space-y-3"}>
      {BALANCE_KEYS.map((key) => {
        const value = balance.scores[key];
        const meta = BALANCE_META[key];
        return (
          <div key={key}>
            <div className="mb-1 flex items-end justify-between gap-2">
              <span className={`${compact ? "text-[10px]" : "text-[11px]"} font-extrabold uppercase tracking-[.035em]`}>{meta.label}</span>
              <span className="tnum text-[12px] font-black">{value}<span className="text-[9px] text-[var(--muted)]">/10</span></span>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }, (_, index) => (
                <span
                  key={index}
                  className={`${compact ? "h-2.5" : "h-3.5"} rounded-full border border-[rgba(32,28,24,.42)]`}
                  style={{ background: index < value ? meta.color : "#fffdf7" }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
