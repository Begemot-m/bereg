"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";

import { PageHead } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/motion";
import type { TechKey } from "@/components/techniques";

// Практика запускается по нажатию — до этого её код не нужен.
const TechniqueRunner = dynamic(() => import("@/components/techniques").then((m) => m.TechniqueRunner));
import { asset } from "@/lib/asset";
import { tap } from "@/lib/haptics";
// Интерактивные клиентские практики.
const CLIENT_PRACTICES: { tech: TechKey; title: string; desc: string; time: string; image: string; bg: string; edge: string }[] = [
  { tech: "breathing", title: "Спокойное дыхание", desc: "Снизить напряжение здесь и сейчас", time: "1–5 мин", image: "/practices/breathing-practice.png", bg: "#d9edf3", edge: "#5f95ab" },
  { tech: "thought", title: "Дневник мыслей", desc: "Разобрать мысль без самокритики и вести историю", time: "2–7 мин", image: "/practices/automatic-thoughts.png", bg: "var(--purple-soft)", edge: "var(--purple-edge)" },
];

type PracticeHistory = { tech: TechKey; completedAt: string; before?: number; after?: number }[];

export default function ToolsPage() {
  // Инструменты у психолога и клиента одинаковые — общий набор практик.
  return <ClientTools />;
}

function ClientTools() {
  const [tech, setTech] = useState<TechKey | null>(null);
  const [history, setHistory] = useState<PracticeHistory>([]);
  const [drafts, setDrafts] = useState<TechKey[]>([]);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem("bereg-practice-history-v1") || "[]")); } catch { setHistory([]); }
    setDrafts((["breathing", "thought"] as TechKey[]).filter((key) => Boolean(localStorage.getItem(`bereg-practice-draft-v1:${key}`))));
  }, [tech]);

  return (
    <div>
      <PageHead title="Инструменты" sub="Короткая помощь в нужный момент" icon="tools" />

      <Reveal y={10}>
        <div className="-mx-4 min-h-[64vh] rounded-t-[27px] px-4 pb-8 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)" }}>
          <section className="overflow-hidden rounded-[20px] bg-[var(--ink)] text-white">
            <div className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="chip uppercase" style={{ background: "var(--edge)", color: "var(--ink)" }}>Скоро в Методике</span>
                </div>
                <h2 className="font-tight text-[22px] font-black leading-[1.05]">Больше опоры между встречами</h2>
                <p className="mt-1 max-w-[270px] text-[12px] font-semibold leading-snug text-white/75">Тесты для самодиагностики, AI-ассистент, база знаний и новые практики уже в работе.</p>
              </div>
              <span className="ico ico-accent h-14 w-14 shrink-0"><Icon name="compass" width={28} weight="bold" color="var(--ink)" /></span>
            </div>
          </section>

          <div className="mb-2 mt-6 flex items-end justify-between">
            <div><p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Практики</p><p className="mt-0.5 text-[11px] font-semibold text-[var(--muted-2)]">Выбирайте по состоянию, не ради серии</p></div>
            <span className="chip" style={{ background: "var(--green-soft)" }}><Icon name="check" width={11} weight="bold" color="var(--green-edge)" /> Бесплатно</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {CLIENT_PRACTICES.map((t, i) => {
              const last = history.find((x) => x.tech === t.tech);
              const hasDraft = drafts.includes(t.tech);
              return <Reveal key={t.tech} delay={0.03 + i * 0.04}>
                <button onClick={() => { tap(); setTech(t.tech); }} className="group flex min-h-[226px] w-full flex-col overflow-hidden rounded-[19px] text-left transition-transform duration-200 active:scale-[.98]" style={{ background: t.bg, border: `2px solid ${t.edge}` }}>
                  <div className="relative flex h-[118px] items-center justify-center overflow-hidden">
                    <img src={asset(t.image)} alt="" className="h-[118px] w-[118px] object-contain transition-transform duration-300 group-hover:scale-[1.04]" />
                    <span className="chip absolute right-2 top-2 bg-white">{t.time}</span>
                  </div>
                  <div className="flex flex-1 flex-col bg-white p-3">
                    <h3 className="font-tight text-[15px] font-black leading-tight">{t.title}</h3>
                    <p className="mt-1 text-[11px] font-semibold leading-snug text-[var(--muted)]">{t.desc}</p>
                    <span className="mt-auto pt-2 text-[10px] font-black uppercase tracking-[.05em]" style={{ color: t.edge }}>{hasDraft ? "продолжить черновик" : last ? "можно повторить" : "попробовать"}</span>
                  </div>
                </button>
              </Reveal>;
            })}
          </div>

          <div className="mb-2 mt-6 flex items-end justify-between">
            <p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Ещё для себя</p>
            <span className="chip" style={{ background: "var(--green-soft)" }}><Icon name="check" width={11} weight="bold" color="var(--green-edge)" /> Бесплатно</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Link href="/therapy" onClick={() => tap()} className="card-soft p-3" style={{ background: "var(--green-soft)" }}><span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--green-edge)]"><Icon name="mood" width={19} weight="bold" color="#fff" /></span><span className="mt-2 block text-[13px] font-black">Отметить настроение</span><span className="block text-[10px] font-semibold text-[var(--muted)]">быстрый чек-ин</span></Link>
            <Link href="/therapy" onClick={() => tap()} className="card-soft p-3" style={{ background: "var(--purple-soft)" }}><span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--purple-edge)]"><Icon name="balance" width={19} weight="bold" color="#fff" /></span><span className="mt-2 block text-[13px] font-black">Колесо баланса</span><span className="block text-[10px] font-semibold text-[var(--muted)]">сферы жизни</span></Link>
          </div>


          <p className="mt-4 text-center text-[10px] font-semibold leading-relaxed text-[var(--muted-2)]">Инструменты не заменяют медицинскую помощь. Результаты остаются на этом устройстве и не отправляются терапевту автоматически.</p>
        </div>
      </Reveal>

      {tech && <TechniqueRunner tech={tech} onClose={() => setTech(null)} />}
    </div>
  );
}
