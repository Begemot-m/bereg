"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { PageHead } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { SlotPicker } from "@/components/slot-picker";
import { Button } from "@/components/ui";
import { listMyBookings } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";
import { bookSlot } from "@/lib/mybookings";

type Psy = {
  id: number; name: string; tone: keyof typeof T; verified: boolean; rating: number; reviews: number;
  method: string; methods: string[]; topics: string[]; price: number; format: "online" | "offline" | "both";
  years: number; sessions: number; clients: number; responseHrs: number; about: string; education: string[];
};

const T: Record<string, { bg: string; soft: string; edge: string }> = {
  green: { bg: "var(--green)", soft: "var(--green-soft)", edge: "var(--green-edge)" },
  amber: { bg: "var(--amber)", soft: "var(--amber-soft)", edge: "var(--amber-edge)" },
  purple: { bg: "var(--purple)", soft: "var(--purple-soft)", edge: "var(--purple-edge)" },
  coral: { bg: "var(--coral)", soft: "var(--coral-soft)", edge: "var(--coral-edge)" },
  salmon: { bg: "var(--salmon)", soft: "var(--salmon-soft)", edge: "var(--salmon-edge)" },
  sky: { bg: "var(--sky)", soft: "#d5e8ef", edge: "#5f95ab" },
};

// Мини-иконки для запросов (эмодзи как компактные подписи).
const TOPIC_ICON: Record<string, string> = {
  тревога: "😰", "панические атаки": "💥", депрессия: "🌧", выгорание: "🔥", отношения: "💞",
  самооценка: "🌟", границы: "🚧", травма: "🩹", утрата: "🕯", стресс: "⚡", сон: "😴",
  зависимости: "⛓", одиночество: "🌫", прокрастинация: "⏳",
};
const topicIcon = (t: string) => TOPIC_ICON[t] ?? "🔹";
// Мини-иконки для техник (аббревиатуры + значок).
const METHOD_ICON: Record<string, string> = { "КПТ": "🧠", "ACT": "🎯", "EMDR": "👁", "Схема-терапия": "🧩", "Гештальт": "🌀", "DBT": "⚖", "Психоанализ": "🛋", "КПТ-3": "🧠" };
const methodIcon = (m: string) => METHOD_ICON[m] ?? "✦";

const PSYS: Psy[] = [
  { id: 1, name: "Ирина Верещагина", tone: "green", verified: true, rating: 4.9, reviews: 128, method: "КПТ", methods: ["КПТ", "EMDR"], topics: ["тревога", "границы", "панические атаки"], price: 3500, format: "both", years: 8, sessions: 1240, clients: 210, responseHrs: 2, about: "Помогаю справляться с тревогой и вернуть опору. Работаю бережно, в темпе клиента, с опорой на доказательные методы.", education: ["МГУ, факультет психологии", "Сертификация по КПТ, АКБТ", "EMDR Europe, базовый курс"] },
  { id: 2, name: "Сергей Домбровский", tone: "amber", verified: true, rating: 4.8, reviews: 94, method: "ACT", methods: ["ACT", "DBT"], topics: ["выгорание", "самооценка", "стресс"], price: 4000, format: "online", years: 11, sessions: 1980, clients: 340, responseHrs: 3, about: "Работаю с выгоранием и самооценкой. Помогаю находить ценности и действовать вопреки тревоге и прокрастинации.", education: ["СПбГУ, клиническая психология", "ACT — Ассоциация контекстно-поведенческой науки"] },
  { id: 3, name: "Наталья Юсупова", tone: "purple", verified: false, rating: 4.7, reviews: 51, method: "Гештальт", methods: ["Гештальт"], topics: ["отношения", "утрата", "одиночество"], price: 3000, format: "both", years: 6, sessions: 640, clients: 120, responseHrs: 6, about: "Про отношения, потерю и поиск себя. В центре — живой контакт и то, что происходит здесь и сейчас.", education: ["МИП, гештальт-терапия", "Программа работы с утратой"] },
  { id: 4, name: "Артём Белов", tone: "coral", verified: true, rating: 4.9, reviews: 173, method: "Схема-терапия", methods: ["Схема-терапия", "КПТ"], topics: ["травма", "тревога", "самооценка"], price: 4500, format: "offline", years: 13, sessions: 2450, clients: 410, responseHrs: 4, about: "Схема-терапия при последствиях травмы и устойчивых сложностях в отношениях с собой и другими.", education: ["РНИМУ им. Пирогова", "Международное общество схема-терапии (ISST)"] },
];

const FILTERS = ["Все", "тревога", "выгорание", "отношения", "самооценка", "травма"];
const fmtLabel = (f: Psy["format"]) => (f === "both" ? "онлайн · очно" : f === "online" ? "онлайн" : "очно");

export default function CatalogPage() {
  const [filter, setFilter] = useState("Все");
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<Psy | null>(null);
  const nq = query.trim().toLowerCase();
  const list = [...PSYS]
    .filter((p) => (filter === "Все" || p.topics.includes(filter)) && (!nq || p.name.toLowerCase().includes(nq) || p.method.toLowerCase().includes(nq) || p.topics.some((t) => t.includes(nq))))
    .sort((a, b) => Number(b.verified) - Number(a.verified) || b.rating - a.rating);

  return (
    <div>
      <PageHead title="Каталог" sub="Специалисты платформы" />

      <Reveal delay={0.03}>
        <label className="mb-3 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 stroke">
          <Icon name="compass" width={16} color="var(--muted)" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск: имя, подход, запрос…" className="w-full bg-transparent text-[14px] font-semibold outline-none placeholder:font-normal placeholder:text-[var(--muted-2)]" />
          {query && <button onClick={() => setQuery("")} className="text-[16px] font-black text-[var(--muted-2)]" aria-label="Очистить">×</button>}
        </label>
      </Reveal>

      <Reveal delay={0.04}>
        <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => { select(); setFilter(f); }} className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors duration-200" style={{ background: filter === f ? "var(--ink)" : "var(--surface-2)", color: filter === f ? "var(--bg)" : "var(--muted)" }}>{f}</button>
          ))}
        </div>
      </Reveal>

      {list.length === 0 && <p className="py-10 text-center text-[13px] font-semibold text-[var(--muted-2)]">Никого не нашли. Попробуйте другой запрос.</p>}

      <Stagger className="space-y-3">
        {list.map((p) => <StaggerItem key={p.id}><PsyCard psy={p} onOpen={() => { tap(); setSel(p); }} /></StaggerItem>)}
      </Stagger>

      <AnimatePresence>{sel && <PsyDetail psy={sel} onClose={() => setSel(null)} />}</AnimatePresence>
    </div>
  );
}

function Avatar({ name, tone, size }: { name: string; tone: keyof typeof T; size: number }) {
  const c = T[tone];
  return (
    <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-[18px] font-black" style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(145deg, ${c.bg}, ${c.soft})`, border: `var(--bw-lg) solid ${c.edge}` }}>
      {name.charAt(0)}
    </div>
  );
}

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - i));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <span className="absolute inset-0 text-[var(--edge-neutral)]" style={{ fontSize: size, lineHeight: `${size}px` }}>★</span>
            <span className="absolute inset-0 overflow-hidden text-[var(--amber-edge)]" style={{ width: `${fill * 100}%`, fontSize: size, lineHeight: `${size}px` }}>★</span>
          </span>
        );
      })}
    </span>
  );
}

function VerifiedBadge({ small }: { small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${small ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"} font-black`} style={{ background: "var(--green-soft)", border: "var(--bw) solid var(--green-edge)", color: "var(--green-edge)" }}>
      <Icon name="check" width={small ? 10 : 12} weight="fill" color="var(--green-edge)" /> {small ? "" : "проверен"}
    </span>
  );
}

// Карточка каталога — крупнее фото, рейтинг, значок, чипы-запросы.
function PsyCard({ psy, onOpen }: { psy: Psy; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="w-full rounded-[22px] bg-white p-3 text-left transition-transform active:scale-[0.99]" style={{ border: "var(--bw-lg) solid var(--edge-neutral)" }}>
      <div className="flex gap-3">
        <Avatar name={psy.name} tone={psy.tone} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><p className="truncate text-[15px] font-black">{psy.name}</p>{psy.verified && <VerifiedBadge small />}</div>
          <div className="mt-0.5 flex items-center gap-1.5"><Stars rating={psy.rating} /><span className="text-[12px] font-black">{psy.rating}</span><span className="text-[11px] font-semibold text-[var(--muted-2)]">· {psy.reviews} отзывов</span></div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Chip>{methodIcon(psy.method)} {psy.method}</Chip>
            {psy.topics.slice(0, 2).map((t) => <Chip key={t}>{topicIcon(t)} {t}</Chip>)}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t pt-2.5" style={{ borderColor: "var(--edge-neutral)" }}>
        <p className="font-tight text-[16px] font-black">{psy.price.toLocaleString("ru-RU")} ₽<span className="text-[11px] font-semibold text-[var(--muted)]"> / сессия · {fmtLabel(psy.format)}</span></p>
        <span className="flex items-center gap-1 text-[12px] font-black text-[var(--muted)]">Профиль <span>›</span></span>
      </div>
    </button>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-bold" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>{children}</span>;
}

function CountUp({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now(); const dur = 700;
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / dur); setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target]);
  return <>{v.toLocaleString("ru-RU")}{suffix}</>;
}

// Детальный профиль — игровой, с анимациями и статистикой.
function PsyDetail({ psy, onClose }: { psy: Psy; onClose: () => void }) {
  const c = T[psy.tone];
  const { data: bookings = [] } = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings });
  const wasInTherapy = bookings.some((b) => b.psyName === psy.name);
  const [booking, setBooking] = useState(false);
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = o; }; }, []);

  const stats: { label: string; value: React.ReactNode; tone: keyof typeof T; icon: Parameters<typeof Icon>[0]["name"] }[] = [
    { label: "сессий в «Вдох»", value: <CountUp target={psy.sessions} />, tone: "green", icon: "calendar" },
    { label: "клиентов", value: <CountUp target={psy.clients} />, tone: "purple", icon: "users" },
    { label: "лет практики", value: <CountUp target={psy.years} />, tone: "amber", icon: "spark" },
    { label: "ответ в среднем", value: <>~{psy.responseHrs} ч</>, tone: "sky", icon: "clock" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-end justify-center @md:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-[rgba(32,28,24,.42)] backdrop-blur-[2px]" />
      <motion.section initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }} onClick={(e) => e.stopPropagation()} className="relative max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-[30px] bg-[#fffaf0] pb-[calc(env(safe-area-inset-bottom)+16px)] @md:rounded-[30px]">
        {/* Герой */}
        <div className="relative px-5 pb-5 pt-5" style={{ background: `linear-gradient(160deg, ${c.bg}, ${c.soft})`, borderBottom: `var(--bw-lg) solid ${c.edge}` }}>
          <button onClick={onClose} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[15px] font-black stroke" aria-label="Закрыть">×</button>
          <div className="flex items-center gap-3">
            <Avatar name={psy.name} tone={psy.tone} size={84} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5"><h2 className="text-[19px] font-black leading-tight">{psy.name}</h2>{psy.verified && <VerifiedBadge />}</div>
              <div className="mt-1 flex items-center gap-1.5"><Stars rating={psy.rating} size={15} /><span className="text-[13px] font-black">{psy.rating}</span><span className="text-[11px] font-semibold text-[var(--muted)]">· {psy.reviews} отзывов</span></div>
              <p className="mt-1 text-[12px] font-bold text-[var(--muted)]">{methodIcon(psy.method)} {psy.method} · {psy.price.toLocaleString("ru-RU")} ₽ · {fmtLabel(psy.format)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {/* Статистика — бенто */}
          <div className="grid grid-cols-2 gap-2.5">
            {stats.map((s, i) => {
              const t = T[s.tone];
              return (
                <motion.div key={s.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.08 + i * 0.06, type: "spring", stiffness: 260, damping: 18 }}
                  className="rounded-[16px] p-3" style={{ background: t.soft, border: `var(--bw) solid ${t.edge}` }}>
                  <Icon name={s.icon} width={16} weight="bold" />
                  <p className="mt-1.5 font-tight tnum text-[24px] font-black leading-none">{s.value}</p>
                  <p className="mt-0.5 text-[10px] font-black uppercase tracking-[.03em] text-[var(--muted)]">{s.label}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Запросы */}
          <Section title="С чем помогает">
            <div className="flex flex-wrap gap-1.5">
              {psy.topics.map((t) => <span key={t} className="rounded-full bg-white px-2.5 py-1 text-[12px] font-bold" style={{ border: `var(--bw) solid ${c.edge}` }}>{topicIcon(t)} {t}</span>)}
            </div>
          </Section>

          {/* Техники */}
          <Section title="Методы и техники">
            <div className="flex flex-wrap gap-1.5">
              {psy.methods.map((m) => <span key={m} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[12px] font-black" style={{ border: "var(--bw) solid var(--edge-neutral)" }}><span className="text-[13px]">{methodIcon(m)}</span> {m}</span>)}
            </div>
          </Section>

          {/* О специалисте */}
          <Section title="О специалисте"><p className="text-[13px] leading-relaxed">{psy.about}</p></Section>

          {/* Образование */}
          <Section title="Образование">
            <ul className="space-y-1.5">{psy.education.map((e, i) => <li key={i} className="flex gap-2 text-[13px]"><Icon name="check" width={15} weight="bold" color="var(--green-edge)" className="mt-0.5 shrink-0" />{e}</li>)}</ul>
          </Section>

          {/* Оценка */}
          <RatingBlock psy={psy} canRate={wasInTherapy} tone={c} />

          {/* Запись */}
          {booking ? (
            <div className="rounded-[18px] bg-white p-4" style={{ border: `var(--bw-lg) solid ${c.edge}` }}>
              <BookFlow psyName={psy.name} onDone={onClose} />
            </div>
          ) : (
            <button onClick={() => { tap(); setBooking(true); }} className="w-full rounded-[16px] bg-[var(--ink)] py-3.5 text-[15px] font-black text-white transition-transform active:scale-[0.98]">Записаться к специалисту</button>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 text-[11px] font-black uppercase tracking-[.06em] text-[var(--muted)]">{title}</p>
      {children}
    </section>
  );
}

const RATING_KEY = "bereg_ratings";
function RatingBlock({ psy, canRate, tone }: { psy: Psy; canRate: boolean; tone: { bg: string; soft: string; edge: string } }) {
  const [mine, setMine] = useState(0);
  useEffect(() => { try { const r = JSON.parse(localStorage.getItem(RATING_KEY) || "{}"); if (r[psy.id]) setMine(r[psy.id]); } catch { /* ignore */ } }, [psy.id]);
  const rate = (v: number) => { success(); setMine(v); try { const r = JSON.parse(localStorage.getItem(RATING_KEY) || "{}"); r[psy.id] = v; localStorage.setItem(RATING_KEY, JSON.stringify(r)); } catch { /* ignore */ } };

  return (
    <Section title="Оценить специалиста">
      <div className="rounded-[16px] p-3.5" style={{ background: tone.soft, border: `var(--bw) solid ${tone.edge}` }}>
        {canRate ? (
          <>
            <div className="flex items-center justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((v) => (
                <motion.button key={v} whileTap={{ scale: 0.85 }} animate={mine >= v ? { scale: [1, 1.2, 1] } : {}} onClick={() => rate(v)} className="text-[28px] leading-none" style={{ color: mine >= v ? "var(--amber-edge)" : "var(--edge-neutral)" }} aria-label={`Оценка ${v}`}>★</motion.button>
              ))}
            </div>
            <p className="mt-2 text-center text-[11px] font-bold text-[var(--muted)]">{mine ? "Спасибо за оценку!" : "Вы были в терапии — можете оценить"}</p>
          </>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-white" style={{ border: `var(--bw) solid ${tone.edge}` }}><Icon name="check" width={16} weight="bold" /></span>
            <p className="text-[12px] font-semibold text-[var(--muted)]">Оценку могут ставить только клиенты, которые были в терапии с этим специалистом.</p>
          </div>
        )}
      </div>
    </Section>
  );
}

function BookFlow({ psyName, onDone }: { psyName: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [done, setDone] = useState<{ at: string; format: string } | null>(null);
  const book = useMutation({
    mutationFn: ({ iso, format }: { iso: string; format: "online" | "offline" }) => bookSlot(psyName, iso, format),
    onSuccess: (b) => { success(); setDone({ at: b.startsAt, format: b.format }); qc.invalidateQueries({ queryKey: ["my-bookings"] }); qc.invalidateQueries({ queryKey: ["slots"] }); qc.invalidateQueries({ queryKey: ["month-avail"] }); },
  });

  if (done) {
    const d = new Date(done.at);
    return (
      <div className="text-center">
        <p className="text-[14px] font-extrabold">Вы записаны к {psyName}</p>
        <p className="mt-0.5 text-[12px] font-semibold text-[var(--muted)]">{d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} в {d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} · {done.format === "online" ? "онлайн" : "очно"}</p>
        <div className="mt-3 flex justify-center gap-2">
          <Link href="/sessions"><Button size="sm" variant="soft">Мои сессии</Button></Link>
          <Button size="sm" variant="ghost" onClick={onDone}>Готово</Button>
        </div>
      </div>
    );
  }
  return (
    <>
      <p className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-[var(--muted)]">День и окно</p>
      <SlotPicker forClient variant="calendar" showAvail onPick={(iso, format) => book.mutate({ iso, format })} />
    </>
  );
}
