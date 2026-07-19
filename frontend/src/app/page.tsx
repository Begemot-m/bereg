"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { PageHead, SectionTitle } from "@/components/blocks";
import { Icon, type IconName } from "@/components/icons";
import { MoodFaces } from "@/components/mood-tracker";
import { Reveal } from "@/components/motion";
import { Disclosure } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { listAppointments } from "@/lib/appointments";
import { listClients, listMyBookings, type Mood } from "@/lib/clients";
import { mascotSrc, MOOD_LABEL, useAnimal } from "@/lib/mascots";
import { tap } from "@/lib/haptics";
import { displayName } from "@/lib/profile";
import { useRole } from "@/lib/role";
import { getSubscription, trialDaysLeft } from "@/lib/subscription";
import { getMyTherapy, updateMyTherapy, wheelPercent } from "@/lib/therapy";

const dtf = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

const T: Record<string, { bg: string; soft: string; edge: string }> = {
  green: { bg: "var(--green)", soft: "var(--green-soft)", edge: "var(--green-edge)" },
  amber: { bg: "var(--amber)", soft: "var(--amber-soft)", edge: "var(--amber-edge)" },
  purple: { bg: "var(--purple)", soft: "var(--purple-soft)", edge: "var(--purple-edge)" },
  coral: { bg: "var(--coral)", soft: "var(--coral-soft)", edge: "var(--coral-edge)" },
  salmon: { bg: "var(--salmon)", soft: "var(--salmon-soft)", edge: "var(--salmon-edge)" },
  sky: { bg: "var(--sky)", soft: "#d5e8ef", edge: "#5f95ab" },
};


// Центры, где можно получить помощь (реальные горячие линии РФ).
const CENTERS: { name: string; note: string; phone: string; tel: string }[] = [
  { name: "Детский телефон доверия", note: "бесплатно · круглосуточно · анонимно", phone: "8 800 2000 122", tel: "88002000122" },
  { name: "Экстренная психологическая помощь МЧС", note: "круглосуточно", phone: "8 495 989 50 50", tel: "84959895050" },
  { name: "Московская служба психологической помощи", note: "для жителей Москвы", phone: "051", tel: "051" },
  { name: "Горячая линия для женщин (центр «АННА»)", note: "насилие · кризис · бесплатно", phone: "8 800 7000 600", tel: "88007000600" },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}
function useName(): string {
  const [n, setN] = useState("");
  useEffect(() => setN(displayName()), []);
  return n;
}

export default function Home() {
  const [role] = useRole();
  return role === "psychologist" ? <PsyHome /> : <PersonHome guest={role === "guest"} />;
}

/* ================= Психолог ================= */
function PsyHome() {
  const name = useName();
  const { data: appts = [] } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const next = appts.find((a) => a.status === "scheduled" && new Date(a.startsAt) > new Date());
  const todayY = new Date().toDateString();
  const todaySessions = appts.filter((a) => a.status === "scheduled" && new Date(a.startsAt).toDateString() === todayY).length;
  const activeClients = clients.filter((c) => c.status === "therapy").length;
  const hwOpen = clients.reduce((n, c) => n + Math.max(0, c.hwTotal - c.hwDone), 0);

  return (
    <div className="space-y-7">
      <PageHead title={`${greeting()}${name ? `, ${name}` : ""}`} sub={`Ваш день в «${APP_NAME}»`} />

      {/* Ближайший клиент — один раз */}
      <HeroCard label="Ближайший клиент" tone="green" href="/sessions" empty={!next}
        emptyText="Запланированных сессий нет — откройте «Сессии»."
        title={next?.client.name ?? ""}
        sub={next ? `${cap(dtf.format(new Date(next.startsAt)))} · ${next.format === "online" ? "онлайн" : "очно"}` : ""}
        badge={next ? whenBadge(next.startsAt) : undefined} />

      {/* Быстрый прогресс */}
      <div>
        <SectionTitle>Сегодня</SectionTitle>
        <div className="grid grid-cols-3 gap-2.5">
          <Tile value={String(todaySessions)} label="сессий" tone="green" icon="calendar" />
          <Tile value={String(activeClients)} label="в терапии" tone="purple" icon="users" />
          <Tile value={String(hwOpen)} label="заданий" tone="coral" icon="check" />
        </div>
      </div>

      <OfferPsy />

      <QuickLinks items={[
        { title: "Сессии", desc: "Окна и записи", icon: "calendar", tone: "green", href: "/sessions" },
        { title: "Клиенты", desc: "Карточки и прогресс", icon: "users", tone: "purple", href: "/clients" },
        { title: "Инструменты", desc: "Для практики", icon: "tools", tone: "amber", href: "/tools" },
        { title: "Кабинет", desc: "Профиль и подписка", icon: "user", tone: "salmon", href: "/cabinet" },
      ]} />

      <HelpCenters />
    </div>
  );
}

function OfferPsy() {
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  if (!sub) return null;
  const trial = sub.status === "trial";
  const days = Math.min(10, trialDaysLeft(sub));
  const active = sub.status === "active";
  return (
    <Reveal>
      <Link href="/cabinet" className="block">
        <div className="flex items-center gap-3 rounded-[20px] p-4" style={{ background: T.purple.soft, border: `var(--bw-lg) solid ${T.purple.edge}` }}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ background: T.purple.bg, border: `var(--bw) solid ${T.purple.edge}` }}><Icon name="spark" width={20} weight="fill" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Спецпредложение</p>
            <p className="text-[14px] font-black leading-tight">{active ? (sub.promo ? "Всё включено активно" : "Продлите «Практику»") : trial ? `Триал: ${days} ${plural(days, "день", "дня", "дней")} бесплатно` : "Всё включено — инструменты + каталог"}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">{active ? "Управлять в кабинете" : "Всё включено 1990 ₽ вместо 2980 — экономия 990 ₽"}</p>
          </div>
          <span className="text-[18px] font-black text-[var(--purple-edge)]">›</span>
        </div>
      </Link>
    </Reveal>
  );
}

/* ================= Клиент / гость ================= */
function PersonHome({ guest }: { guest: boolean }) {
  const name = useName();
  const { data: bookings = [] } = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings });
  const { data: therapy } = useQuery({ queryKey: ["my-therapy"], queryFn: getMyTherapy });
  const next = bookings.find((b) => new Date(b.startsAt) > new Date());
  const pct = wheelPercent(therapy?.wheel ?? null);
  const todayMood = therapy ? [...therapy.moods].reverse().find((e) => e.date.slice(0, 10) === new Date().toISOString().slice(0, 10))?.mood : undefined;
  const doneSessions = bookings.filter((b) => new Date(b.startsAt) < new Date()).length;

  return (
    <div className="space-y-7">
      <PageHead title={`${greeting()}${name && !guest ? `, ${name}` : ""}`} sub="Ваш день и забота о себе" />

      {/* Ближайшая сессия — один раз */}
      <HeroCard label="Ваша ближайшая сессия" tone="green" href="/sessions" empty={!next}
        emptyText="Записей пока нет."
        emptyCta={{ label: "Найти психолога", href: "/catalog" }}
        title={next?.psyName ?? ""}
        sub={next ? `${cap(dtf.format(new Date(next.startsAt)))} · ${next.format === "online" ? "онлайн" : "очно"}` : ""}
        badge={next ? whenBadge(next.startsAt) : undefined} />

      {/* Настроение — компактно, с раскрытием */}
      <MoodQuick todayMood={todayMood} />

      {/* Быстрый прогресс */}
      <div>
        <SectionTitle action={<Link href="/therapy" className="text-[12px] font-bold text-[var(--muted)]">Терапия →</Link>}>Мой прогресс</SectionTitle>
        <div className="grid grid-cols-3 gap-2.5">
          <Tile value={therapy?.wheel ? `${pct}%` : "—"} label="баланс" tone="purple" icon="balance" />
          <Tile value={todayMood ? `${todayMood}/5` : "—"} label="сегодня" tone="amber" icon="mood" />
          <Tile value={String(doneSessions)} label="встреч" tone="green" icon="check" />
        </div>
      </div>

      <OfferClient />

      <QuickLinks items={[
        { title: "Мои сессии", desc: "Встречи со специалистом", icon: "calendar", tone: "green", href: "/sessions" },
        { title: "Каталог", desc: "Найти психолога", icon: "compass", tone: "salmon", href: "/catalog" },
        { title: "Терапия", desc: "Прогресс и задания", icon: "therapy", tone: "purple", href: "/therapy" },
        { title: "Инструменты", desc: "Забота о себе", icon: "tools", tone: "amber", href: "/tools" },
      ]} />

      <HelpCenters />
    </div>
  );
}

function OfferClient() {
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  const active = sub?.clientPro;
  return (
    <Reveal>
      <Link href="/tools" className="block">
        <div className="flex items-center gap-3 rounded-[20px] p-4" style={{ background: T.purple.soft, border: `var(--bw-lg) solid ${T.purple.edge}` }}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ background: T.purple.bg, border: `var(--bw) solid ${T.purple.edge}` }}><Icon name="therapy" width={20} weight="fill" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Спецпредложение</p>
            <p className="text-[14px] font-black leading-tight">{active ? "Вдох+ активен" : "Вдох+ — инструменты для себя"}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">{active ? "Все практики открыты" : "Дневники, практики, колесо баланса — 390 ₽/мес"}</p>
          </div>
          <span className="text-[18px] font-black text-[var(--purple-edge)]">›</span>
        </div>
      </Link>
    </Reveal>
  );
}

/* ================= Общие блоки ================= */
function HeroCard({ label, tone, href, title, sub, badge, empty, emptyText, emptyCta }: { label: string; tone: keyof typeof T; href: string; title: string; sub: string; badge?: string; empty?: boolean; emptyText?: string; emptyCta?: { label: string; href: string } }) {
  const c = T[tone];
  return (
    <Reveal>
      <SectionTitle action={<Link href={href} className="text-[12px] font-bold text-[var(--muted)]">Все →</Link>}>{label}</SectionTitle>
      {empty ? (
        <div className="rounded-[22px] bg-white p-4" style={{ border: "var(--bw-lg) solid var(--edge-neutral)" }}>
          <p className="text-[13px] font-semibold text-[var(--muted)]">{emptyText}</p>
          {emptyCta && <Link href={emptyCta.href} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2 text-[13px] font-black text-white">{emptyCta.label} →</Link>}
        </div>
      ) : (
        <Link href={href} className="block">
          <div className="flex items-center gap-3 rounded-[22px] p-4 transition-transform active:scale-[0.99]" style={{ background: c.bg, border: `var(--bw-lg) solid ${c.edge}` }}>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-white text-[20px] font-black" style={{ border: `var(--bw) solid ${c.edge}` }}>{title.charAt(0)}</span>
            <div className="min-w-0 flex-1">
              {badge && <span className="mb-1 inline-block rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase" style={{ border: `var(--bw) solid ${c.edge}` }}>{badge}</span>}
              <p className="truncate text-[18px] font-black leading-tight">{title}</p>
              <p className="truncate text-[12px] font-bold text-[var(--muted)]">{sub}</p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-white" style={{ border: `var(--bw) solid ${c.edge}` }}><Icon name="calendar" width={20} /></span>
          </div>
        </Link>
      )}
    </Reveal>
  );
}

function MoodQuick({ todayMood }: { todayMood?: number }) {
  const qc = useQueryClient();
  const save = useMutation({ mutationFn: (mood: number) => updateMyTherapy({ mood }), onSuccess: (s) => qc.setQueryData(["my-therapy"], s) });
  const [open, setOpen] = useState(false);
  const [animal] = useAnimal();
  const expanded = open || !todayMood;

  return (
    <Reveal>
      <section className="overflow-hidden rounded-[20px] p-4" style={{ background: T.amber.soft, border: `var(--bw-lg) solid ${T.amber.edge}` }}>
        <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-2.5 text-left" aria-expanded={expanded}>
          <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-white" style={{ border: `var(--bw) solid ${T.amber.edge}` }}><Icon name="mood" width={18} weight="bold" /></span>
          <span className="flex-1"><span className="block text-[13px] font-black">Как вы сегодня?</span><span className="block text-[11px] font-semibold text-[var(--muted)]">{todayMood ? `Отмечено: ${MOOD_LABEL[todayMood]}` : "Отметьте настроение за пару секунд"}</span></span>
          {todayMood ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mascotSrc(animal, todayMood)} alt="" className="h-9 w-9 object-contain" />
          ) : null}
          <span className="text-[14px] font-black text-[var(--muted-2)] transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }}>⌄</span>
        </button>
        <Disclosure open={expanded} autoScroll={false}>
          <div className="mt-3"><MoodFaces todayMood={todayMood} onMood={(v) => { save.mutate(v); setOpen(false); }} /></div>
        </Disclosure>
      </section>
    </Reveal>
  );
}

function Tile({ value, label, tone, icon }: { value: string; label: string; tone: keyof typeof T; icon: IconName }) {
  const c = T[tone];
  return (
    <div className="rounded-[16px] p-3" style={{ background: c.soft, border: `var(--bw) solid ${c.edge}` }}>
      <Icon name={icon} width={16} weight="bold" />
      <p className="mt-1.5 font-tight tnum text-[22px] font-black leading-none">{value}</p>
      <p className="mt-0.5 text-[10px] font-black uppercase tracking-[.04em] text-[var(--muted)]">{label}</p>
    </div>
  );
}

function QuickLinks({ items }: { items: { title: string; desc: string; icon: IconName; tone: keyof typeof T; href: string }[] }) {
  return (
    <div>
      <SectionTitle>Разделы</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((it) => {
          const c = T[it.tone];
          return (
            <Link key={it.href + it.title} href={it.href} onClick={tap} className="rounded-[18px] p-4 transition-transform active:scale-[0.98]" style={{ background: c.bg, border: `var(--bw-lg) solid ${c.edge}` }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white" style={{ border: `var(--bw) solid ${c.edge}` }}><Icon name={it.icon} width={20} weight="bold" /></span>
              <p className="mt-5 text-[15px] font-black">{it.title}</p>
              <p className="mt-0.5 text-[12px] font-semibold text-[var(--muted)]">{it.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function HelpCenters() {
  return (
    <div>
      <SectionTitle>Центры, где можно получить помощь</SectionTitle>
      <div className="rounded-[20px] p-1.5" style={{ background: T.coral.soft, border: `var(--bw-lg) solid ${T.coral.edge}` }}>
        {CENTERS.map((c, i) => (
          <a key={c.tel} href={`tel:${c.tel}`} onClick={tap} className="flex items-center gap-3 rounded-[15px] p-2.5" style={i > 0 ? { borderTop: `var(--bw) solid ${T.coral.edge}` } : undefined}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white" style={{ border: `var(--bw) solid ${T.coral.edge}` }}><Icon name="bell" width={18} weight="bold" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[13px] font-black leading-tight">{c.name}</span><span className="block text-[11px] font-semibold text-[var(--muted)]">{c.note}</span></span>
            <span className="tnum shrink-0 rounded-full bg-white px-2.5 py-1 text-[12px] font-black" style={{ border: `var(--bw) solid ${T.coral.edge}` }}>{c.phone}</span>
          </a>
        ))}
      </div>
      <p className="mt-2 px-1 text-[11px] font-semibold text-[var(--muted-2)]">Если сейчас тяжело — можно позвонить анонимно и бесплатно. Это нормально — просить о помощи.</p>
    </div>
  );
}

/* ================= утилиты ================= */
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function whenBadge(iso: string): string | undefined {
  const d = new Date(iso), now = new Date();
  const day0 = new Date(now); day0.setHours(0, 0, 0, 0);
  const dd = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - day0.getTime()) / 86400000);
  if (dd === 0) return `сегодня в ${timeF.format(d)}`;
  if (dd === 1) return `завтра в ${timeF.format(d)}`;
  return undefined;
}
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
