"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { PageHead } from "@/components/blocks";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Badge, Button, Card, Input, SkeletonRow } from "@/components/ui";
import { createClient, listClients, STATUS_LABEL, type Client, type ClientStatus } from "@/lib/clients";
import { select } from "@/lib/haptics";

const FILTERS: { key: ClientStatus | "all"; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "therapy", label: "В терапии" },
  { key: "new", label: "Новые" },
  { key: "paused", label: "Пауза" },
];

const nextF = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Ранжирование: сначала в терапии и записанные, затем новые, затем пауза.
function rank(c: Client): number {
  if (c.status === "therapy") return 0;
  if (c.nextAt) return 1;
  if (c.status === "new") return 2;
  return 3;
}

export default function ClientsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<ClientStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  const { data: clients = [], isLoading } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const add = useMutation({
    mutationFn: () => createClient(name.trim(), ""),
    onSuccess: () => { setName(""); setOpen(false); qc.invalidateQueries({ queryKey: ["clients"] }); },
  });

  const list = clients
    .filter((c) => (filter === "all" ? true : c.status === filter))
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
          <Button size="sm" onClick={() => setOpen(!open)} aria-label="Добавить клиента">+</Button>
        </div>

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

      {open && (
        <Card className="mb-4 !p-4">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя нового клиента" autoFocus />
            <Button type="submit" size="sm" disabled={add.isPending}>OK</Button>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
      ) : list.length === 0 ? (
        <p className="px-1 text-sm text-[var(--muted-2)]">{search ? "Никого не нашли по этому имени." : "Нет клиентов в этом фильтре."}</p>
      ) : (
        <Stagger className="space-y-2.5">
          {list.map((c: Client) => (
            <StaggerItem key={c.id}>
              <Link href={`/clients/${c.id}`} className="group block">
                <Card interactive className="!p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold"
                      style={{ background: c.status === "therapy" ? "var(--good-tint)" : "var(--surface-2)", color: c.status === "therapy" ? "var(--good)" : "var(--ink)" }}
                    >
                      {c.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{c.name}</p>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                        {c.sessionsDone > 0 ? `${c.sessionsDone} встреч${plural(c.sessionsDone)}` : "встреч не было"}
                        {c.nextAt && ` · ближайшая ${nextF.format(new Date(c.nextAt))}`}
                      </p>
                    </div>
                    <span className="text-[var(--muted-2)] transition-transform duration-200 group-hover:translate-x-0.5">›</span>
                  </div>
                </Card>
              </Link>
            </StaggerItem>
          ))}
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

function StatusBadge({ status }: { status: ClientStatus }) {
  if (status === "therapy") return <Badge tone="active">{STATUS_LABEL.therapy}</Badge>;
  if (status === "new") return <Badge tone="planned">{STATUS_LABEL.new}</Badge>;
  return <Badge>{STATUS_LABEL.paused}</Badge>;
}
