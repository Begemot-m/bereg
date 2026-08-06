"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import { PageHead } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/motion";
import type { TechKey } from "@/components/techniques";

// Практика запускается по нажатию — до этого её код не нужен.
const TechniqueRunner = dynamic(() => import("@/components/techniques").then((m) => m.TechniqueRunner));
import { asset } from "@/lib/asset";
import { tap } from "@/lib/haptics";
// Интерактивные клиентские практики.
const CLIENT_PRACTICES: { tech: TechKey; title: string; desc: string; time: string; image: string; bg: string; edge: string; soon?: boolean }[] = [
  { tech: "breathing", title: "Спокойное дыхание", desc: "Снизить напряжение здесь и сейчас", time: "1–5 мин", image: "/practices/breathing-practice.webp", bg: "#d9edf3", edge: "#5f95ab" },
  { tech: "thought", title: "Дневник мыслей", desc: "Отслеживать негативные убеждения и переформулировать их по методу КПТ", time: "2–7 мин", image: "/practices/automatic-thoughts.webp", bg: "var(--purple-soft)", edge: "var(--purple-edge)", soon: true },
];

export default function ToolsPage() {
  // Инструменты у психолога и клиента одинаковые — общий набор практик.
  return <ClientTools />;
}

function ClientTools() {
  const [tech, setTech] = useState<TechKey | null>(null);

  return (
    <div>
      <PageHead title="Инструменты" sub="Короткая помощь в нужный момент" icon="tools" />

      <Reveal y={10}>
        <div className="-mx-4 min-h-[64vh] rounded-t-[27px] px-4 pb-8 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)" }}>
          <section className="overflow-hidden rounded-[20px] bg-[var(--ink)] text-white">
            <div className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="chip uppercase" style={{ background: "rgba(255,255,255,.16)", color: "#fff" }}>Скоро в Хронике</span>
                </div>
                <h2 className="font-tight text-[22px] font-black leading-[1.05]">Больше опоры между встречами</h2>
                <p className="mt-1 max-w-[270px] text-[12px] font-semibold leading-snug text-white/75">Тесты для самодиагностики, AI-ассистент, база знаний и новые практики уже в работе.</p>
              </div>
              <span className="ico h-14 w-14 shrink-0" style={{ background: "rgba(255,255,255,.14)" }}><Icon name="compass" width={28} weight="bold" color="#fff" /></span>
            </div>
          </section>

          <div className="mb-2 mt-6 flex items-end justify-between">
            <p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Практики</p>
            <span className="chip" style={{ background: "var(--green-soft)", color: "var(--green-edge)" }}><Icon name="check" width={11} weight="bold" color="var(--green-edge)" /> Бесплатно</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {CLIENT_PRACTICES.map((t, i) => (
              <Reveal key={t.tech} delay={0.03 + i * 0.04}>
                <button
                  onClick={() => { if (t.soon) return; tap(); setTech(t.tech); }}
                  disabled={t.soon}
                  aria-disabled={t.soon}
                  className="group relative flex min-h-[210px] w-full flex-col overflow-hidden rounded-[19px] text-left transition-transform duration-200 active:scale-[.98] disabled:active:scale-100"
                  style={{ background: t.bg, border: `2px solid ${t.edge}` }}
                >
                  <div className="relative flex h-[118px] items-center justify-center overflow-hidden">
                    <img src={asset(t.image)} alt="" loading="lazy" decoding="async" className="h-[118px] w-[118px] object-contain transition-transform duration-300 group-hover:scale-[1.04]" style={t.soon ? { filter: "grayscale(.55)", opacity: .5 } : undefined} />
                    {/* Длительность — часики на самой картинке, без цветных статусов */}
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-black" style={{ color: t.edge }}>
                      <Icon name="clock" width={11} weight="bold" color={t.edge} />{t.time}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col bg-white p-3">
                    <h3 className="font-tight text-[15px] font-black leading-tight">{t.title}</h3>
                    <p className="mt-1 text-[11px] font-semibold leading-snug text-[var(--muted)]">{t.desc}</p>
                    {t.soon && <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-[.06em]" style={{ background: "var(--head-soft)", color: "var(--muted)" }}>в разработке</span>}
                  </div>
                  {t.soon && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[17px]" style={{ background: "rgba(32,28,24,.14)" }} />}
                </button>
              </Reveal>
            ))}
          </div>

          <div className="mb-2 mt-6 flex items-end justify-between">
            <p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Улучшить терапию</p>
            <span className="chip" style={{ background: "var(--green-soft)", color: "var(--green-edge)" }}><Icon name="check" width={11} weight="bold" color="var(--green-edge)" /> Бесплатно</span>
          </div>
          <div className="grid grid-cols-2 items-stretch gap-2.5">
            <Link href="/therapy" onClick={() => tap()} className="card-soft flex h-full min-h-[124px] flex-col p-3" style={{ background: "var(--green-soft)" }}><span className="ico h-9 w-9 shrink-0" style={{ background: "#fff" }}><Icon name="mood" width={19} weight="bold" color="var(--green)" /></span><span className="mt-auto block pt-2 text-[13px] font-black leading-tight">Отметить настроение</span><span className="block text-[10px] font-semibold text-[var(--muted)]">быстрый чек-ин</span></Link>
            <Link href="/therapy" onClick={() => tap()} className="card-soft flex h-full min-h-[124px] flex-col p-3" style={{ background: "var(--purple-soft)" }}><span className="ico h-9 w-9 shrink-0" style={{ background: "#fff" }}><Icon name="balance" width={19} weight="bold" color="var(--purple)" /></span><span className="mt-auto block pt-2 text-[13px] font-black leading-tight">Колесо баланса</span><span className="block text-[10px] font-semibold text-[var(--muted)]">сферы жизни</span></Link>
          </div>


          <p className="mt-4 text-center text-[10px] font-semibold leading-relaxed text-[var(--muted-2)]">Инструменты не заменяют медицинскую помощь. Результаты остаются на этом устройстве и не отправляются терапевту автоматически.</p>
        </div>
      </Reveal>

      {tech && <TechniqueRunner tech={tech} onClose={() => setTech(null)} />}
    </div>
  );
}
