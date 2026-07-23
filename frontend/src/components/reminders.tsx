"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { select } from "@/lib/haptics";

const KEY = "bereg_reminders_v1";

// Смещения напоминаний (в минутах до сессии).
const CLIENT_OFFSETS = [1440, 120, 15] as const;
const SELF_OFFSETS = [60, 15] as const;
const offsetLabel = (m: number) => (m >= 60 ? (m % 60 === 0 ? `за ${m / 60} ${plural(m / 60, "час", "часа", "часов")}` : `за ${Math.floor(m / 60)} ч ${m % 60} м`) : `за ${m} минут`);

type Config = {
  client: number[]; // включённые смещения для клиента
  self: number[];   // для психолога
  channel: boolean; // напоминания через Telegram-бот
};

const DEFAULT: Config = { client: [1440, 120], self: [60], channel: true };

function load(): Config {
  if (typeof window === "undefined") return DEFAULT;
  try { const raw = localStorage.getItem(KEY); if (raw) return { ...DEFAULT, ...JSON.parse(raw) }; } catch { /* ignore */ }
  return DEFAULT;
}

export function RemindersModule() {
  const [cfg, setCfg] = useState<Config>(DEFAULT);
  useEffect(() => { setCfg(load()); }, []);
  const save = (next: Config) => { setCfg(next); localStorage.setItem(KEY, JSON.stringify(next)); };
  const toggle = (list: number[], v: number) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort((a, b) => b - a));

  return (
    <div className="space-y-4">
      {/* Единые правила — всем клиентам */}
      <Panel icon="users" title="Всем клиентам" hint="Напоминание клиенту перед сессией">
        <ChipRow options={CLIENT_OFFSETS} active={cfg.client} onToggle={(v) => save({ ...cfg, client: toggle(cfg.client, v) })} />
      </Panel>

      {/* Себе */}
      <Panel icon="user" title="Мне" hint="Чтобы не пропустить приём">
        <ChipRow options={SELF_OFFSETS} active={cfg.self} onToggle={(v) => save({ ...cfg, self: toggle(cfg.self, v) })} />
      </Panel>

      {/* Канал доставки — Telegram-бот */}
      <button onClick={() => { select(); save({ ...cfg, channel: !cfg.channel }); }} className="flex w-full items-center gap-2.5 rounded-[14px] bg-white p-3 text-left" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ background: "var(--head-soft)" }}><Icon name="telegram" width={16} weight="fill" /></span>
        <span className="flex-1"><span className="block text-[13px] font-black">Через Telegram-бот</span><span className="block text-[11px] font-semibold text-[var(--muted)]">Бот пишет клиенту и вам в личку</span></span>
        <Switch on={cfg.channel} />
      </button>
    </div>
  );
}

function Panel({ icon, title, hint, children }: { icon: "users" | "user"; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] bg-[var(--surface-2)] p-3" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white" style={{ border: "var(--bw) solid var(--edge-neutral)" }}><Icon name={icon} width={15} /></span>
        <div><p className="text-[13px] font-black leading-none">{title}</p><p className="mt-0.5 text-[10px] font-semibold text-[var(--muted)]">{hint}</p></div>
      </div>
      {children}
    </div>
  );
}

function ChipRow({ options, active, onToggle }: { options: readonly number[]; active: number[]; onToggle: (v: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((m) => {
        const on = active.includes(m);
        return <button key={m} onClick={() => { select(); onToggle(m); }} className="rounded-full px-3 py-1.5 text-[12px] font-black transition-colors" style={on ? { background: "var(--ink)", color: "#fff" } : { background: "#fff", color: "var(--muted)", border: "var(--bw) solid var(--edge-neutral)" }}>{offsetLabel(m)}</button>;
      })}
    </div>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span className="flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors" style={{ background: on ? "var(--green)" : "#e2e0d8", border: `var(--bw) solid ${on ? "var(--green-edge)" : "var(--edge-neutral)"}` }}>
      <span className="h-4 w-4 rounded-full bg-white transition-transform" style={{ transform: on ? "translateX(16px)" : "none" }} />
    </span>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
