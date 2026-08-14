"use client";

import { useState } from "react";

import { ClientAvatar } from "@/components/client-avatar";
import { Icon } from "@/components/icons";
import { tap } from "@/lib/haptics";

// Выбор клиента с быстрым поиском; недавние в терапии — сверху.
// onCreateClient — если задан, показываем «+ Новый клиент» рядом с поиском.
export function ClientPicker({ clients, onPick, compact = true, onCreateClient, startAdding = false }: { clients: { id: number; name: string; status: string; contact?: string | null; photo?: string | null }[]; onPick: (id: number) => void; compact?: boolean; onCreateClient?: (name: string, contact: string) => void; startAdding?: boolean }) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(startAdding);
  const [newName, setNewName] = useState("");
  const [newContact, setNewContact] = useState("");
  const query = q.trim().toLowerCase();
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query) || (c.contact ?? "").toLowerCase().includes(query));
  const inTherapy = filtered.filter((c) => c.status === "therapy");
  const others = filtered.filter((c) => c.status !== "therapy");
  const row = (c: { id: number; name: string; status: string; photo?: string | null }) => (
    <button key={c.id} onClick={() => onPick(c.id)} className="flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-left transition-colors hover:bg-[var(--head-soft)] active:scale-[0.99]">
      <ClientAvatar name={c.name} photo={c.photo} className="h-7 w-7 rounded-[8px] text-[12px] font-extrabold" style={{ background: c.status === "therapy" ? "var(--olive-soft)" : "var(--head-soft)" }} />
      <span className="font-tight min-w-0 flex-1 break-words text-[13px] font-bold leading-tight">{c.name}</span>
      {c.status === "therapy" && <span className="rounded-full px-1.5 text-[9px] font-extrabold uppercase text-[var(--olive-edge)]">терапия</span>}
    </button>
  );
  return (
    <div className={`${compact ? "mt-1.5" : ""} rounded-[11px] p-2.5 stroke`} style={{ background: "#fff" }}>
      <div className="mb-1.5 flex items-center gap-2 rounded-[9px] bg-[var(--surface-2)] px-2.5 py-1.5" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-[var(--muted-2)]"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.8-3.8" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск клиента" className="w-full bg-transparent text-[13px] font-semibold outline-none" />
      </div>
      {onCreateClient && (adding ? (
        <form onSubmit={(e) => { e.preventDefault(); const n = newName.trim(); if (n) { onCreateClient(n, newContact.trim()); setNewName(""); setNewContact(""); setAdding(false); } }} className="mb-1.5 space-y-1.5">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus placeholder="Имя и фамилия" className="w-full rounded-[9px] bg-white px-2.5 py-1.5 text-[13px] font-semibold outline-none [caret-color:var(--ink)]" style={{ border: "var(--bw) solid var(--olive-edge)" }} />
          <input value={newContact} onChange={(e) => setNewContact(e.target.value)} placeholder="Телефон или Telegram" className="w-full rounded-[9px] bg-white px-2.5 py-1.5 text-[13px] font-semibold outline-none [caret-color:var(--ink)]" style={{ border: "var(--bw) solid var(--olive-edge)" }} />
          <div className="flex gap-1.5">
            <button type="button" onClick={() => { setAdding(false); setNewName(""); setNewContact(""); }} className="btn btn-white flex-1 py-1.5 text-[11px]">Отмена</button>
            <button type="submit" disabled={!newName.trim()} className="btn flex-1 py-1.5 text-[11px] disabled:opacity-40">Создать</button>
          </div>
        </form>
      ) : (
        <button onClick={() => { tap(); setAdding(true); }} className="mb-1.5 flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-left transition-colors active:scale-[0.99]" style={{ background: "var(--olive-soft)", border: "var(--bw) solid var(--olive-edge)" }}>
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white" style={{ border: "var(--bw) solid var(--olive-edge)" }}><Icon name="plus" width={14} weight="bold" color="var(--olive-edge)" /></span>
          <span className="flex-1 text-[13px] font-black text-[var(--olive-edge)]">Новый клиент</span>
        </button>
      ))}
      <div className="no-scrollbar flex max-h-52 flex-col gap-0.5 overflow-y-auto">
        {inTherapy.length > 0 && <p className="px-1 pt-1 text-[9px] font-black uppercase tracking-[.08em] text-[var(--muted-2)]">Недавно в терапии</p>}
        {inTherapy.map(row)}
        {others.length > 0 && inTherapy.length > 0 && <p className="px-1 pt-1.5 text-[9px] font-black uppercase tracking-[.08em] text-[var(--muted-2)]">Остальные</p>}
        {others.map(row)}
        {filtered.length === 0 && <p className="px-1 py-2 text-[12px] font-semibold text-[var(--muted-2)]">Никого не нашли.</p>}
      </div>
    </div>
  );
}
