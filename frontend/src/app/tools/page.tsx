"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageHead } from "@/components/blocks";
import { Icon, type IconName } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { TechniqueRunner, type TechKey } from "@/components/techniques";
import { asset } from "@/lib/asset";
import { tap } from "@/lib/haptics";
import { getSubscription, startSubscription } from "@/lib/subscription";

// Что открывает Клубок+ (по подписке).
const PREMIUM: { title: string; desc: string; icon: IconName }[] = [
  { title: "Детальное колесо баланса", desc: "Радар по 10 сферам и история", icon: "balance" },
  { title: "Дневник эмоций", desc: "Отмечать состояния по дням", icon: "heart" },
  { title: "Медитации и практики", desc: "Короткие аудио на каждый день", icon: "therapy" },
];

// Инструменты клиента: часть бесплатна, часть — по подписке «Клубок+». Интерактивные — с tech.
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
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  const buy = useMutation({ mutationFn: () => startSubscription("client"), onSuccess: (r) => { if (r.confirmation_url) window.location.href = r.confirmation_url; } });
  const pro = !!sub?.clientPro;

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem("bereg-practice-history-v1") || "[]")); } catch { setHistory([]); }
    setDrafts((["breathing", "thought"] as TechKey[]).filter((key) => Boolean(localStorage.getItem(`bereg-practice-draft-v1:${key}`))));
  }, [tech]);

  const weekly = useMemo(() => {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return history.filter((x) => new Date(x.completedAt).getTime() >= since).length;
  }, [history]);
  const recommended = useMemo(() => {
    if (drafts.length) return drafts[0];
    if (!history.length) return "breathing";
    const order: TechKey[] = ["breathing", "thought"];
    const last = history[0]?.tech;
    return order[(Math.max(0, order.indexOf(last as TechKey)) + 1) % order.length];
  }, [drafts, history]);
  const recommendation = CLIENT_PRACTICES.find((x) => x.tech === recommended) ?? CLIENT_PRACTICES[0];

  return (
    <div>
      <PageHead title="Инструменты" sub="Короткая помощь в нужный момент" icon="tools" />

      <Reveal y={10}>
        <div className="-mx-4 min-h-[64vh] rounded-t-[30px] px-4 pb-8 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)", borderTop: "var(--bw-lg) solid var(--edge-neutral)" }}>
          <section className="overflow-hidden rounded-[23px] bg-[var(--peach-soft)]" style={{ border: "var(--bw-lg) solid var(--peach-edge)" }}>
            <div className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[.07em]" style={{ border: "var(--bw) solid var(--peach-edge)" }}>Что поможет сейчас</span>
                  <span className="rounded-full bg-[var(--green-soft)] px-2 py-0.5 text-[10px] font-black" style={{ border: "var(--bw) solid var(--green-edge)", color: "var(--green-edge)" }}>бесплатно</span>
                </div>
                <h2 className="font-tight text-[22px] font-black leading-[1.05]">{recommendation.title}</h2>
                <p className="mt-1 max-w-[230px] text-[12px] font-semibold leading-snug text-[var(--muted)]">{drafts.includes(recommendation.tech) ? "Черновик сохранён — можно спокойно продолжить с того же шага." : history.length ? "Предлагаем сменить фокус после прошлой практики." : "Начните с мягкого способа вернуть спокойный ритм."}</p>
              </div>
              <img src={asset(recommendation.image)} alt="" className="h-[92px] w-[92px] shrink-0 object-contain" />
            </div>
            <div className="flex items-center gap-2 border-t px-4 py-3" style={{ borderColor: "var(--peach-edge)" }}>
              <button onClick={() => { tap(); setTech(recommendation.tech); }} className="flex-1 rounded-[14px] bg-[var(--ink)] py-2.5 text-[13px] font-black text-white transition-transform active:scale-[.98]">Начать · {recommendation.time}</button>
              <span className="rounded-full bg-white px-3 py-2 text-[11px] font-black" style={{ border: "var(--bw) solid var(--peach-edge)" }}>{weekly ? `${weekly} за неделю` : "без спешки"}</span>
            </div>
          </section>

          <div className="mb-2 mt-6 flex items-end justify-between">
            <div><p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Практики</p><p className="mt-0.5 text-[11px] font-semibold text-[var(--muted-2)]">Выбирайте по состоянию, не ради серии</p></div>
            <span className="flex items-center gap-1 rounded-full bg-[var(--green-soft)] px-2.5 py-1 text-[10px] font-black" style={{ border: "var(--bw) solid var(--green-edge)", color: "var(--green-edge)" }}><Icon name="check" width={11} weight="bold" color="var(--green-edge)" /> Бесплатно</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {CLIENT_PRACTICES.map((t, i) => {
              const last = history.find((x) => x.tech === t.tech);
              const hasDraft = drafts.includes(t.tech);
              return <Reveal key={t.tech} delay={0.03 + i * 0.04}>
                <button onClick={() => { tap(); setTech(t.tech); }} className="group flex min-h-[226px] w-full flex-col overflow-hidden rounded-[21px] text-left transition-transform duration-200 active:scale-[.98]" style={{ background: t.bg, border: `var(--bw-lg) solid ${t.edge}` }}>
                  <div className="relative flex h-[118px] items-center justify-center overflow-hidden">
                    <img src={asset(t.image)} alt="" className="h-[118px] w-[118px] object-contain transition-transform duration-300 group-hover:scale-[1.04]" />
                    <span className="absolute right-2 top-2 rounded-full bg-[#fffdf7] px-2 py-1 text-[10px] font-black" style={{ border: `var(--bw) solid ${t.edge}` }}>{t.time}</span>
                  </div>
                  <div className="flex flex-1 flex-col border-t bg-[#fffdf7] p-3" style={{ borderColor: t.edge }}>
                    <h3 className="font-tight text-[15px] font-black leading-tight">{t.title}</h3>
                    <p className="mt-1 text-[11px] font-semibold leading-snug text-[var(--muted)]">{t.desc}</p>
                    <span className="mt-auto pt-2 text-[10px] font-black uppercase tracking-[.05em]" style={{ color: t.edge }}>{hasDraft ? "продолжить черновик" : last ? "можно повторить" : "попробовать"} →</span>
                  </div>
                </button>
              </Reveal>;
            })}
          </div>

          {history.some((x) => typeof x.before === "number" && typeof x.after === "number") && <section className="mt-5 rounded-[19px] bg-white p-4" style={{ border: "var(--bw-lg) solid var(--edge-neutral)" }}>
            <p className="text-[10px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Личное наблюдение</p>
            <p className="mt-1 font-tight text-[17px] font-black">Практики уже помогают замечать изменения</p>
            <p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">Это не оценка и не диагноз — только ваша сохранённая динамика до и после.</p>
          </section>}

          <div className="mb-2 mt-6 flex items-end justify-between">
            <p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Ещё для себя</p>
            <span className="flex items-center gap-1 rounded-full bg-[var(--green-soft)] px-2.5 py-1 text-[10px] font-black" style={{ border: "var(--bw) solid var(--green-edge)", color: "var(--green-edge)" }}><Icon name="check" width={11} weight="bold" color="var(--green-edge)" /> Бесплатно</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Link href="/therapy" onClick={() => tap()} className="rounded-[18px] bg-white p-3" style={{ border: "var(--bw) solid var(--green-edge)" }}><Icon name="mood" width={20} weight="bold" /><span className="mt-2 block text-[13px] font-black">Отметить настроение</span><span className="block text-[10px] font-semibold text-[var(--muted)]">быстрый чек-ин</span></Link>
            <Link href="/therapy" onClick={() => tap()} className="rounded-[18px] bg-white p-3" style={{ border: "var(--bw) solid var(--purple-edge)" }}><Icon name="balance" width={20} weight="bold" /><span className="mt-2 block text-[13px] font-black">Колесо баланса</span><span className="block text-[10px] font-semibold text-[var(--muted)]">сферы жизни</span></Link>
          </div>

          {/* Клубок+ — что открывает подписка */}
          <section className="mt-6 overflow-hidden rounded-[21px]" style={{ background: "var(--purple-soft)", border: "var(--bw-lg) solid var(--purple-edge)" }}>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-2.5 py-1 text-[10px] font-black text-white"><Icon name="therapy" width={12} weight="fill" /> КЛУБОК+</span>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)", color: pro ? "var(--green-edge)" : undefined }}>{pro ? "подключено" : "390 ₽/мес"}</span>
              </div>
              <p className="mt-2.5 font-tight text-[16px] font-black">{pro ? "Всё открыто — спасибо!" : "Больше инструментов для себя"}</p>
              <div className="mt-2.5 space-y-1.5">
                {PREMIUM.map((p) => (
                  <div key={p.title} className="flex items-center gap-2.5 rounded-[13px] bg-[#fffdf7] p-2.5" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--purple-soft)]" style={{ border: "var(--bw) solid var(--purple-edge)" }}><Icon name={p.icon} width={16} weight="bold" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-[12.5px] font-black leading-tight">{p.title}</span><span className="block text-[10px] font-semibold text-[var(--muted)]">{p.desc}</span></span>
                    <Icon name={pro ? "check" : "lock"} width={15} weight="bold" color={pro ? "var(--green-edge)" : "var(--muted-2)"} />
                  </div>
                ))}
              </div>
              {!pro && <button onClick={() => { tap(); buy.mutate(); }} disabled={buy.isPending} className="mt-3 w-full rounded-[14px] bg-[var(--ink)] py-2.5 text-[13px] font-black text-white transition-transform active:scale-[0.98] disabled:opacity-50">{buy.isPending ? "Готовим оплату…" : "Открыть Клубок+ · 390 ₽/мес"}</button>}
            </div>
          </section>

          <p className="mt-4 text-center text-[10px] font-semibold leading-relaxed text-[var(--muted-2)]">Инструменты не заменяют медицинскую помощь. Результаты остаются на этом устройстве и не отправляются терапевту автоматически.</p>
        </div>
      </Reveal>

      {tech && <TechniqueRunner tech={tech} onClose={() => setTech(null)} />}
    </div>
  );
}
