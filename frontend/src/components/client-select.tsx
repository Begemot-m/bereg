"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Disclosure, Input } from "@/components/ui";
import { listClients } from "@/lib/clients";
import { select } from "@/lib/haptics";

// Компактный выбор клиента: одна строка + поиск, в приоритете — в терапии.
export function ClientSelect({ value, onChange }: { value: number | null; onChange: (id: number) => void }) {
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const sel = clients.find((c) => c.id === value);
  const sorted = [...clients].sort((a, b) => (a.status === "therapy" ? 0 : 1) - (b.status === "therapy" ? 0 : 1));
  const filtered = sorted.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));

  const Avatar = ({ name, therapy }: { name: string; therapy: boolean }) => (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] stroke text-[12px] font-extrabold" style={{ background: therapy ? "var(--green-soft)" : "var(--head-soft)" }}>{name.charAt(0)}</span>
  );

  return (
    <div>
      <button onClick={() => { select(); setOpen(!open); }} className="flex w-full items-center gap-2 rounded-[12px] px-2.5 py-2 stroke" style={{ background: "#fff" }}>
        {sel ? <Avatar name={sel.name} therapy={sel.status === "therapy"} /> : <span className="flex h-7 w-7 items-center justify-center rounded-[9px] stroke" style={{ background: "var(--head-soft)" }}>?</span>}
        <span className={`flex-1 text-left text-[13px] font-bold ${sel ? "" : "text-[var(--muted)]"}`}>{sel ? sel.name : "Выберите клиента"}</span>
        <span className="text-[11px] text-[var(--muted-2)]" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
      </button>
      <Disclosure open={open}>
        <div className="mt-1.5 rounded-[12px] p-2 stroke" style={{ background: "#fff" }}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени" autoFocus />
          <div className="no-scrollbar mt-1.5 flex max-h-44 flex-col gap-0.5 overflow-y-auto">
            {filtered.map((c) => (
              <button key={c.id} onClick={() => { select(); onChange(c.id); setOpen(false); setQ(""); }} className="flex items-center gap-2 rounded-[9px] px-2 py-1.5 text-left active:scale-[0.99]">
                <Avatar name={c.name} therapy={c.status === "therapy"} />
                <span className="flex-1 text-[13px] font-bold">{c.name}</span>
                {c.status === "therapy" && <span className="text-[9px] font-extrabold uppercase" style={{ color: "var(--green-edge)" }}>терапия</span>}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-2 py-2 text-[12px] font-semibold text-[var(--muted-2)]">Не найдено</p>}
          </div>
        </div>
      </Disclosure>
    </div>
  );
}
