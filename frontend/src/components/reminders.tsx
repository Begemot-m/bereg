"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Disclosure } from "@/components/ui";
import { listClients } from "@/lib/clients";
import { select, tap } from "@/lib/haptics";

const KEY = "bereg_reminders_v1";

// Смещения напоминаний (в минутах до сессии).
const CLIENT_OFFSETS = [1440, 120, 15] as const;
const SELF_OFFSETS = [60, 15] as const;
const offsetLabel = (m: number) => (m >= 60 ? (m % 60 === 0 ? `за ${m / 60} ${plural(m / 60, "час", "часа", "часов")}` : `за ${Math.floor(m / 60)} ч ${m % 60} м`) : `за ${m} минут`);

type ClientMode = "default" | "off" | "custom";
type Config = {
  client: number[]; // включённые смещения для клиента
  self: number[];   // для психолога
  channel: boolean; // напоминания через Telegram-бот
  overrides: Record<number, { mode: ClientMode; offsets: number[] }>;
};

const DEFAULT: Config = { client: [1440, 120], self: [60], channel: true, overrides: {} };

function load(): Config {
  if (typeof window === "undefined") return DEFAULT;
  try { const raw = localStorage.getItem(KEY); if (raw) return { ...DEFAULT, ...JSON.parse(raw) }; } catch { /* ignore */ }
  return DEFAULT;
}

export function RemindersModule() {
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [cfg, setCfg] = useState<Config>(DEFAULT);
  const [openClient, setOpenClient] = useState<number | null>(null);
  useEffect(() => { setCfg(load()); }, []);
  const save = (next: Config) => { setCfg(next); localStorage.setItem(KEY, JSON.stringify(next)); };

  const toggle = (list: number[], v: number) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort((a, b) => b - a));
  const setOverride = (id: number, patch: Partial<{ mode: ClientMode; offsets: number[] }>) => {
    const cur = cfg.overrides[id] ?? { mode: "default" as ClientMode, offsets: cfg.client };
    save({ ...cfg, overrides: { ...cfg.overrides, [id]: { ...cur, ...patch } } });
  };

  return (
    <div className="space-y-4">
      {/* Унифицированно — всем клиентам */}
      <Panel icon="users" title="Всем клиентам" hint="Напоминание клиенту перед сессией">
        <ChipRow options={CLIENT_OFFSETS} active={cfg.client} onToggle={(v) => save({ ...cfg, client: toggle(cfg.client, v) })} />
      </Panel>

      {/* Себе */}
      <Panel icon="user" title="Мне" hint="Чтобы не пропустить приём">
        <ChipRow options={SELF_OFFSETS} active={cfg.self} onToggle={(v) => save({ ...cfg, self: toggle(cfg.self, v) })} />
      </Panel>

      {/* Канал */}
      <button onClick={() => { select(); save({ ...cfg, channel: !cfg.channel }); }} className="flex w-full items-center gap-2.5 rounded-[14px] bg-white p-3 text-left" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ background: "var(--head-soft)" }}><Icon name="bell" width={16} /></span>
        <span className="flex-1"><span className="block text-[13px] font-black">Через Telegram-бот</span><span className="block text-[11px] font-semibold text-[var(--muted)]">Бот пишет клиенту и вам в личку</span></span>
        <Switch on={cfg.channel} />
      </button>

      {/* Индивидуально по клиентам */}
      <div>
        <p className="mb-2 text-[12px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Отдельные клиенты</p>
        <div className="space-y-1.5">
          {clients.map((c) => {
            const ov = cfg.overrides[c.id] ?? { mode: "default" as ClientMode, offsets: cfg.client };
            const open = openClient === c.id;
            return (
              <div key={c.id} className="rounded-[14px] bg-white" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
                <button onClick={() => { tap(); setOpenClient(open ? null : c.id); }} className="flex w-full items-center gap-2.5 p-2.5 text-left">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[12px] font-black" style={{ background: c.status === "therapy" ? "var(--green-soft)" : "var(--head-soft)", border: "var(--bw) solid var(--edge-neutral)" }}>{c.name.charAt(0)}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-black">{c.name}</span>
                  <span className="text-[11px] font-bold text-[var(--muted)]">{ov.mode === "off" ? "выкл" : ov.mode === "custom" ? "свои" : "как у всех"}</span>
                  <span className="text-[var(--muted-2)] transition-transform" style={{ transform: open ? "rotate(90deg)" : "none" }}>›</span>
                </button>
                <Disclosure open={open}>
                  <div className="border-t px-3 pb-3 pt-2.5" style={{ borderColor: "var(--edge-neutral)" }}>
                    <div className="flex gap-1.5">
                      {(["default", "custom", "off"] as ClientMode[]).map((m) => (
                        <button key={m} onClick={() => { select(); setOverride(c.id, { mode: m, offsets: m === "custom" ? ov.offsets : cfg.client }); }} className="flex-1 rounded-full py-1.5 text-[11px] font-black transition-colors" style={ov.mode === m ? { background: "var(--ink)", color: "#fff" } : { background: "#fff", color: "var(--muted)", border: "var(--bw) solid var(--edge-neutral)" }}>{m === "default" ? "как у всех" : m === "custom" ? "свои" : "выкл"}</button>
                      ))}
                    </div>
                    {ov.mode === "custom" && <div className="mt-2.5"><ChipRow options={CLIENT_OFFSETS} active={ov.offsets} onToggle={(v) => setOverride(c.id, { offsets: toggle(ov.offsets, v) })} /></div>}
                  </div>
                </Disclosure>
              </div>
            );
          })}
        </div>
      </div>
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
