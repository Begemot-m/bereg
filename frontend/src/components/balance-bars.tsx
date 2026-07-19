import type { Who5Result } from "@/lib/therapy";

const SHORT = ["Настроение", "Спокойствие", "Энергия", "Сон и отдых", "Интерес к жизни"];
const TONE = ["var(--amber)", "var(--purple)", "var(--green)", "var(--coral)", "var(--sky)"];
const EDGE = ["var(--amber-edge)", "var(--purple-edge)", "var(--green-edge)", "var(--coral-edge)", "#5f95ab"];

// Разбивка WHO-5 по пяти пунктам (каждый 0–5). Обводка дорожки — в цвет её заливки.
export function Who5Bars({ who5, compact = false }: { who5: Who5Result; compact?: boolean }) {
  return (
    <div className={compact ? "space-y-1.5" : "space-y-2.5"}>
      {who5.answers.map((value, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <span className={`shrink-0 ${compact ? "w-[74px] text-[10px]" : "w-24 text-[11px]"} font-bold text-[var(--muted)]`}>{SHORT[i]}</span>
          <div className={`relative flex-1 overflow-hidden rounded-full ${compact ? "h-3" : "h-4"}`} style={{ background: "#fff", border: `var(--bw) solid ${EDGE[i]}` }}>
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(value / 5) * 100}%`, background: TONE[i], transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)" }} />
          </div>
          <span className={`shrink-0 tnum font-black ${compact ? "text-[11px]" : "text-[12px]"}`}>{value}<span className="text-[var(--muted-2)]">/5</span></span>
        </div>
      ))}
    </div>
  );
}
