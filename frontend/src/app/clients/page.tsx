"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHead } from "@/components/blocks";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Icon } from "@/components/icons";
import { Disclosure, Input, SkeletonRow } from "@/components/ui";
import { createClient, derivedStatus, listClients, STATUS_LABEL, type Client, type ClientStatus } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";

const STATUS_TONE: Record<ClientStatus, string> = { therapy: "green", new: "purple", paused: "amber" };

const FILTERS: { key: ClientStatus | "all"; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "therapy", label: "В терапии" },
  { key: "new", label: "Новые" },
  { key: "paused", label: "Пауза" },
];

const nextF = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Ранжирование: сначала в терапии и записанные, затем новые, затем пауза.
function rank(c: Client): number {
  const s = derivedStatus(c);
  if (s === "therapy") return 0;
  if (c.nextAt) return 1;
  if (s === "new") return 2;
  return 3;
}

export default function ClientsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [filter, setFilter] = useState<ClientStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [open, setOpen] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
    // Пока кого-то пригласили — тихо подтягиваем список, чтобы поймать подключение.
    refetchInterval: (q) => (q.state.data?.some((c) => c.link === "invited") ? 2500 : false),
  });
  const add = useMutation({
    mutationFn: () => createClient(`${first.trim()} ${last.trim()}`.trim(), ""),
    onSuccess: (c) => { success(); setFirst(""); setLast(""); setOpen(false); qc.invalidateQueries({ queryKey: ["clients"] }); router.push(`/clients/${c.id}`); },
  });

  const list = clients
    .filter((c) => (filter === "all" ? true : derivedStatus(c) === filter))
    .filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "ru"));

  return (
    <div>
      <PageHead title="Клиенты" sub={`${clients.length} всего`} />

      <Reveal delay={0.04}>
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-2)]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.8-3.8" />
              </svg>
            </span>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по имени" className="!pl-9" />
          </div>
          <motion.button
            onClick={() => { tap(); setOpen((v) => !v); }}
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.06 }}
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 14 }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]"
            style={{ background: open ? "var(--olive)" : "var(--olive-soft)", border: "var(--bw-lg) solid var(--olive-edge)", boxShadow: "0 8px 18px -8px var(--olive-edge)" }}
            aria-label="Добавить клиента"
            aria-expanded={open}
          >
            <Icon name="plus" width={22} weight="bold" color="var(--olive-edge)" />
          </motion.button>
        </div>

        <QuickAddClient
          open={open}
          first={first}
          last={last}
          setFirst={setFirst}
          setLast={setLast}
          pending={add.isPending}
          onCreate={() => { if (first.trim()) add.mutate(); }}
        />

        <div className="mb-4 flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { select(); setFilter(f.key); }}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors duration-200 ${filter === f.key ? "bg-[var(--ink)] text-[var(--bg)]" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Reveal>

      {isLoading ? (
        <div className="space-y-3"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
      ) : list.length === 0 ? (
        <p className="px-1 text-sm text-[var(--muted-2)]">{search ? "Никого не нашли по этому имени." : "Нет клиентов в этом фильтре."}</p>
      ) : (
        <Stagger className="space-y-2.5">
          {list.map((c: Client) => {
            const s = derivedStatus(c);
            const tone = STATUS_TONE[s];
            return (
              <StaggerItem key={c.id}>
                <Link href={`/clients/${c.id}`} className="group block">
                  <div className="relative flex items-stretch gap-3 overflow-hidden rounded-[20px] bg-white p-3 transition-transform active:scale-[0.99]" style={{ border: `var(--bw-lg) solid var(--${tone}-edge)`, boxShadow: `0 12px 24px -20px var(--${tone}-edge)` }}>
                    {/* Цветной акцент слева */}
                    <span aria-hidden className="w-1.5 shrink-0 rounded-full" style={{ background: `var(--${tone})` }} />
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[17px] text-[19px] font-black" style={{ background: `var(--${tone}-soft)`, border: `var(--bw-lg) solid var(--${tone}-edge)` }}>
                      {c.name.charAt(0)}
                      {c.nextAt && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--peach)]" style={{ border: "var(--bw) solid var(--peach-edge)" }}><Icon name="calendar" width={8} weight="bold" /></span>}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15.5px] font-black">{c.name}</p>
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-black" style={{ background: `var(--${tone}-soft)`, border: `var(--bw) solid var(--${tone}-edge)`, color: `var(--${tone}-edge)` }}>{STATUS_LABEL[s]}</span>
                        {c.link === "invited" && <span className="shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-black" style={{ background: "var(--amber-soft)", border: "var(--bw) solid var(--amber-edge)", color: "var(--amber-edge)" }}>Приглашён</span>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10.5px] font-black text-[var(--muted)]" style={{ border: "var(--bw) solid var(--edge-neutral)" }}><Icon name="check" width={10} weight="bold" color={`var(--${tone}-edge)`} /> {c.sessionsDone > 0 ? `${c.sessionsDone} встреч${plural(c.sessionsDone)}` : "новый"}{c.hoursDone > 0 ? ` · ${c.hoursDone} ч` : ""}</span>
                        {c.nextAt && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-black" style={{ background: "var(--peach-soft)", border: "var(--bw) solid var(--peach-edge)", color: "var(--peach-edge)" }}><Icon name="calendar" width={10} weight="bold" /> {nextF.format(new Date(c.nextAt))}</span>}
                      </div>
                    </div>
                    <span className="flex items-center text-[18px] font-black text-[var(--muted-2)] transition-transform duration-200 group-hover:translate-x-0.5">›</span>
                  </div>
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}

function plural(n: number) {
  const d = n % 10, dd = n % 100;
  if (d === 1 && dd !== 11) return "а";
  if (d >= 2 && d <= 4 && (dd < 10 || dd >= 20)) return "и";
  return "";
}

// Быстрое добавление: имя + фамилия → создаём карточку и открываем её.
function QuickAddClient({ open, first, last, setFirst, setLast, pending, onCreate }: { open: boolean; first: string; last: string; setFirst: (v: string) => void; setLast: (v: string) => void; pending: boolean; onCreate: () => void }) {
  return (
    <Disclosure open={open} autoScroll={false}>
      <div className="mb-4 rounded-[18px] bg-white p-3.5" style={{ border: "var(--bw-lg) solid var(--olive-edge)" }}>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ background: "var(--olive-soft)", border: "var(--bw) solid var(--olive-edge)" }}><Icon name="user" width={16} weight="bold" /></span>
          <div><p className="text-[13px] font-black leading-none">Новый клиент</p><p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">Имя и фамилия — карточка откроется сразу</p></div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onCreate(); }}>
          <div className="flex gap-2">
            <Input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Имя" autoFocus />
            <Input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Фамилия" />
          </div>
          <button type="submit" disabled={pending || !first.trim()} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[14px] bg-[var(--ink)] py-2.5 text-[13px] font-black text-white transition-transform active:scale-[0.98] disabled:opacity-40">
            <Icon name="plus" width={15} weight="bold" color="#fff" /> Создать карточку
          </button>
          <p className="mt-2 text-center text-[11px] font-semibold text-[var(--muted-2)]">Дальше добавите телефон или Telegram и пригласите клиента подключиться.</p>
        </form>
      </div>
    </Disclosure>
  );
}

