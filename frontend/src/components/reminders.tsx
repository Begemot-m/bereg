"use client";

import { useEffect, useState } from "react";

import { select } from "@/lib/haptics";

const KEY = "bereg_reminders_v1";

// Смещения напоминаний (в минутах до сессии).
const CLIENT_OFFSETS = [1440, 120, 15] as const;
const offsetLabel = (m: number) => (m >= 60 ? (m % 60 === 0 ? `за ${m / 60} ${plural(m / 60, "час", "часа", "часов")}` : `за ${Math.floor(m / 60)} ч ${m % 60} м`) : `за ${m} минут`);

type Config = { client: number[] };

const DEFAULT: Config = { client: [1440, 120] };

function load(): Config {
  if (typeof window === "undefined") return DEFAULT;
  try { const raw = localStorage.getItem(KEY); if (raw) return { ...DEFAULT, ...JSON.parse(raw) }; } catch { /* ignore */ }
  return DEFAULT;
}

// Когда напомнить клиенту о сессии. Живёт в одном блоке с запретом отмены —
// это два правила приёма, а не две разные настройки.
export function RemindersModule() {
  const [cfg, setCfg] = useState<Config>(DEFAULT);
  useEffect(() => { setCfg(load()); }, []);
  const save = (next: Config) => { setCfg(next); localStorage.setItem(KEY, JSON.stringify(next)); };
  const toggle = (v: number) => save({ client: cfg.client.includes(v) ? cfg.client.filter((x) => x !== v) : [...cfg.client, v].sort((a, b) => b - a) });

  return (
    <div>
      <p className="text-[13px] font-black">Напоминание клиенту</p>
      <p className="t-cap mt-0.5">За сколько предупредить о сессии</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {CLIENT_OFFSETS.map((m) => {
          const on = cfg.client.includes(m);
          return (
            <button
              key={m}
              onClick={() => { select(); toggle(m); }}
              className={`btn px-3 py-1.5 text-[12px] ${on ? "btn-accent" : "btn-white"}`}
            >
              {offsetLabel(m)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
