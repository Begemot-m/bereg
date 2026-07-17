"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { PageHead } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { SlotPicker } from "@/components/slot-picker";
import { Badge, Button, Card, Disclosure } from "@/components/ui";
import { select, success } from "@/lib/haptics";
import { bookSlot } from "@/lib/mybookings";
import type { ApptFormat } from "@/lib/appointments";
import type { AcceptFormat } from "@/lib/profile";

type Psy = { id: number; name: string; method: string; topics: string[]; price: number; rating: number; pro: boolean; accept: AcceptFormat };

const PSYS: Psy[] = [
  { id: 1, name: "Ирина Верещагина", method: "КПТ", topics: ["тревога", "границы"], price: 3500, rating: 4.9, pro: true, accept: "both" },
  { id: 2, name: "Сергей Домбровский", method: "ACT", topics: ["выгорание", "самооценка"], price: 4000, rating: 4.8, pro: true, accept: "online" },
  { id: 3, name: "Наталья Юсупова", method: "Гештальт", topics: ["отношения", "утрата"], price: 3000, rating: 4.7, pro: false, accept: "offline" },
  { id: 4, name: "Артём Белов", method: "Схема-терапия", topics: ["травма", "тревога"], price: 4500, rating: 4.9, pro: false, accept: "both" },
];

function AcceptLabel({ accept }: { accept: AcceptFormat }) {
  if (accept === "both") return <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--muted)]"><Icon name="video" width={12} /><Icon name="pin" width={12} /> онлайн и очно</span>;
  return <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--muted)]"><Icon name={accept === "online" ? "video" : "pin"} width={12} /> {accept === "online" ? "только онлайн" : "только очно"}</span>;
}
const FILTERS = ["Все", "тревога", "выгорание", "отношения", "самооценка"];

export default function CatalogPage() {
  const [filter, setFilter] = useState("Все");
  const [openId, setOpenId] = useState<number | null>(null);
  const list = [...PSYS].filter((p) => filter === "Все" || p.topics.includes(filter)).sort((a, b) => Number(b.pro) - Number(a.pro) || b.rating - a.rating);

  return (
    <div>
      <Reveal><PageHead title="Каталог" sub="Специалисты платформы" /></Reveal>

      <Reveal delay={0.04}>
        <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => { select(); setFilter(f); }} className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors duration-200" style={{ background: filter === f ? "var(--ink)" : "var(--surface-2)", color: filter === f ? "var(--bg)" : "var(--muted)" }}>{f}</button>
          ))}
        </div>
      </Reveal>

      <Stagger className="space-y-3">
        {list.map((p) => (
          <StaggerItem key={p.id}>
            <Card>
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] text-lg font-extrabold stroke" style={{ background: "var(--salmon)" }}>{p.name.charAt(0)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><p className="truncate font-extrabold">{p.name}</p>{p.pro && <Badge tone="accent">TOP</Badge>}</div>
                  <p className="mt-0.5 text-[13px] font-semibold text-[var(--muted)]">{p.method} · ★ {p.rating}</p>
                  <div className="mt-1"><AcceptLabel accept={p.accept} /></div>
                  <div className="mt-2 flex flex-wrap gap-1">{p.topics.map((t) => <span key={t} className="rounded-full px-2 py-0.5 text-[11px] font-bold stroke" style={{ background: "#fff" }}>{t}</span>)}</div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="font-tight text-lg font-extrabold">{p.price.toLocaleString("ru-RU")} ₽<span className="text-[12px] font-normal text-[var(--muted)]"> / сессия</span></p>
                <Button size="sm" variant={openId === p.id ? "soft" : "primary"} onClick={() => setOpenId(openId === p.id ? null : p.id)} arrow={openId !== p.id}>
                  {openId === p.id ? "Свернуть" : "Записаться"}
                </Button>
              </div>
              <Disclosure open={openId === p.id}>
                <div className="pt-4"><BookFlow psyName={p.name} accept={p.accept} onDone={() => setOpenId(null)} /></div>
              </Disclosure>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

function BookFlow({ psyName, accept, onDone }: { psyName: string; accept: AcceptFormat; onDone: () => void }) {
  const qc = useQueryClient();
  const [done, setDone] = useState<{ at: string; format: string } | null>(null);
  const book = useMutation({
    mutationFn: ({ iso, format }: { iso: string; format: "online" | "offline" }) => bookSlot(psyName, iso, format),
    onSuccess: (b) => { success(); setDone({ at: b.startsAt, format: b.format }); qc.invalidateQueries({ queryKey: ["my-bookings"] }); qc.invalidateQueries({ queryKey: ["slots"] }); qc.invalidateQueries({ queryKey: ["month-avail"] }); },
  });

  if (done) {
    const d = new Date(done.at);
    return (
      <div className="chunk fill-green p-4 text-center">
        <p className="text-[14px] font-extrabold">Вы записаны к {psyName}</p>
        <p className="mt-0.5 text-[12px] font-semibold" style={{ color: "rgba(32,28,24,.68)" }}>{d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} в {d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} · {done.format === "online" ? "онлайн" : "очно"}</p>
        <div className="mt-3 flex justify-center gap-2">
          <Link href="/sessions"><Button size="sm" variant="soft">Мои сессии</Button></Link>
          <Button size="sm" variant="ghost" onClick={onDone}>Готово</Button>
        </div>
      </div>
    );
  }
  return (
    <>
      <p className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-[var(--muted)]">Формат, день и окно</p>
      <SlotPicker forClient variant="calendar" showAvail withFormat lockFormat={accept === "both" ? undefined : (accept as ApptFormat)} onPick={(iso, format) => book.mutate({ iso, format })} />
    </>
  );
}
