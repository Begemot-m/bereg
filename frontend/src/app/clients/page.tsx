"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";

import { ClientDetail } from "@/app/clients/[id]/client-detail";

import { PageHead } from "@/components/blocks";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Icon } from "@/components/icons";
import { Disclosure, Input, SkeletonRow } from "@/components/ui";
import { createClient, derivedStatus, listClients, STATUS_LABEL, type Client, type ClientStatus } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";
import { getSubscription, isPro, FREE_CLIENT_LIMIT } from "@/lib/subscription";
import { ProPaywall } from "@/components/pro-sell";
import { PROD_URL } from "@/lib/brand";

const APP_URL = PROD_URL;

// Анонс модулей закрывается насовсем: показывать его на каждом заходе — шум.
const MODULES_TEASER_KEY = "bereg_modules_teaser_hidden";

const FILTERS: { key: ClientStatus | "all"; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "therapy", label: "В терапии" },
  { key: "new", label: "Новые" },
  { key: "paused", label: "Пауза" },
];

const nextF = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Быстрое сообщение: телеграм по @нику, иначе звонок по номеру.
function contactHref(contact: string | null): string | null {
  const v = (contact ?? "").trim();
  if (!v) return null;
  if (v.startsWith("@")) return `https://t.me/${v.slice(1)}`;
  if (/^\+?[\d\s()-]{6,}$/.test(v)) return `tel:${v.replace(/[^\d+]/g, "")}`;
  return null;
}

function relDay(iso: string): string {
  const d = new Date(iso); const t = new Date();
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const today = new Date(t); today.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return `Сегодня, ${time}`;
  if (diff === 1) return `Завтра, ${time}`;
  return nextF.format(d);
}

// Ранжирование: сначала в терапии и записанные, затем новые, затем пауза.
function rank(c: Client): number {
  const s = derivedStatus(c);
  if (s === "therapy") return 0;
  if (c.nextAt) return 1;
  if (s === "new") return 2;
  return 3;
}

export default function ClientsPage() {
  const search = useSearchParams();
  // Карточка клиента, созданного в демо, открывается здесь же по ?id —
  // статический экспорт не собирает страницы под новые идентификаторы.
  if (search.get("id")) return <ClientDetail />;
  return <ClientsList />;
}

function ClientsList() {
  const qc = useQueryClient();
  const router = useRouter();
  const [filter, setFilter] = useState<ClientStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [contact, setContact] = useState("");
  const [open, setOpen] = useState(false);

  const { data: clients = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
    // Пока кого-то пригласили — тихо подтягиваем список, чтобы поймать подключение.
    refetchInterval: (q) => (q.state.data?.some((c) => c.link === "invited") ? 2500 : false),
  });
  const [inviteAfter, setInviteAfter] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  const pro = isPro(sub);
  const atCap = !pro && clients.length >= FREE_CLIENT_LIMIT;
  const add = useMutation({
    mutationFn: () => createClient(`${first.trim()} ${last.trim()}`.trim(), contact.trim()),
    onSuccess: (c) => {
      success();
      const name = first.trim();
      setFirst(""); setLast(""); setOpen(false);
      qc.invalidateQueries({ queryKey: ["clients"] });
      if (inviteAfter) {
        const text = `${name}, приглашаю вас в «Хронику» — там мы будем видеть настроение между встречами и задания к сессии.`;
        window.open(`https://t.me/share/url?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent(text)}`, "_blank", "noopener");
      }
      router.push(`/clients/?id=${c.id}`);
    },
  });

  // Фильтрация — отложенным значением: набор в поле не ждёт перерисовки списка.
  const q = useDeferredValue(search).trim().toLowerCase();
  const list = clients
    .filter((c) => (filter === "all" ? true : derivedStatus(c) === filter))
    .filter((c) => c.name.toLowerCase().includes(q))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "ru"));

  return (
    <div>
      <PageHead title="Клиенты" sub={`Всего: ${clients.length}`} icon="users" />

      <div className="sheet">
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
            onClick={() => { tap(); if (atCap) { setPaywall(true); return; } setOpen((v) => !v); }}
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.06 }}
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 14 }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"
            style={{ background: open ? "var(--ink)" : "var(--edge)" }}
            data-tour="add-client"
            aria-label="Добавить клиента"
            aria-expanded={open}
          >
            <Icon name="plus" width={22} weight="bold" color="#fff" />
          </motion.button>
        </div>

        <QuickAddClient
          open={open}
          first={first}
          last={last}
          setFirst={setFirst}
          setLast={setLast}
          contact={contact}
          setContact={setContact}
          pending={add.isPending}
          onCreate={(invite) => { if (!first.trim()) return; setInviteAfter(invite); add.mutate(); }}
        />

        <ModulesTeaser />

        {/* Фон как у шапки раздела — счётчик читается как часть раздела, а не как тревога */}
        {!pro && (
          <button onClick={() => { tap(); setPaywall(true); }} className="card-soft mb-3 flex w-full items-center gap-3 p-3 text-left" style={{ background: "var(--page)" }}>
            <span className="ico ico-accent h-9 w-9 shrink-0"><Icon name="spark" width={16} weight="bold" color="#fff" /></span>
            <span className="min-w-0 flex-1">
              <span className="t-head block">{clients.length}/{FREE_CLIENT_LIMIT} на бесплатном тарифе</span>
              {atCap ? <><strong className="t-head mt-1 block">Лимит достигнут</strong><span className="t-sub block">Перейдите на PRO, чтобы открыть безлимитные функции.</span></> : <span className="t-sub block">Все функции доступны для первых трёх клиентов.</span>}
            </span>
            <span className="chip chip-strong shrink-0">PRO ›</span>
          </button>
        )}

        <div className="mb-4 flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { select(); setFilter(f.key); }}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-black transition-colors duration-200 ${filter === f.key ? "bg-[var(--ink)] text-[var(--bg)]" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

      </Reveal>

      {isError ? (
        <div className="card-soft p-5 text-center"><p className="t-head">Не удалось загрузить клиентов</p><p className="t-sub mt-1">Проверьте соединение и попробуйте ещё раз.</p><button onClick={() => void refetch()} className="btn mt-4">Повторить</button></div>
      ) : isLoading ? (
        <div className="space-y-3"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
      ) : list.length === 0 ? (
        <p className="t-sub px-1">{search ? "Никого не нашли по этому имени." : "Нет клиентов в этом фильтре."}</p>
      ) : (
        <Stagger className="space-y-3">
          {list.map((c: Client, i) => <StaggerItem key={c.id}><div data-tour={i === 0 ? "client-card" : undefined}><ClientCard client={c} /></div></StaggerItem>)}
        </Stagger>
      )}
      </div>

      <ProPaywall open={paywall} onClose={() => setPaywall(false)} reason={atCap ? `Заняты все ${FREE_CLIENT_LIMIT} бесплатные карточки. PRO открывает клиентов без лимита.` : undefined} />
    </div>
  );
}

// Карточка клиента: имя и статус, запрос, объём работы, ближайшая встреча
// и быстрая связь — всё, что нужно, чтобы не открывать карточку ради одной цифры.
function ClientCard({ client: c }: { client: Client }) {
  const s = derivedStatus(c);
  // Рамка и плашки — в лавандовом тоне раздела; статус различается словом,
  // а не цветом, иначе карточки пестрят.
  const tone = "purple";
  const href = contactHref(c.contact);
  return (
    <div
      className="relative overflow-hidden rounded-[18px] bg-white p-4 transition-transform active:scale-[0.995]"
      style={{ border: `var(--bw-lg) solid var(--${tone}-edge)` }}
    >
      <Link href={`/clients/?id=${c.id}`} onClick={tap} className="absolute inset-0 z-0" aria-label={`Карточка клиента: ${c.name}`} />

      <div className="pointer-events-none relative z-10">
        <div className="flex items-stretch gap-3.5">
          <span className="flex h-[104px] w-[86px] shrink-0 items-center justify-center rounded-[16px] text-[30px] font-black" style={{ background: `var(--${tone}-soft)`, color: `var(--${tone}-edge)` }}>
            {c.name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="t-head break-words leading-tight">{c.name}</p>
            <span
              className="mt-1 inline-flex rounded-full px-2 py-1 text-[12px] font-black"
              style={{ background: "var(--purple-soft)", color: "var(--purple-edge)" }}
            >
              {STATUS_LABEL[s]}
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="t-cap inline-flex items-center gap-1.5">
                <Icon name="check" width={13} weight="bold" color={`var(--${tone}-edge)`} />
                {c.sessionsDone > 0 ? `${c.sessionsDone} встреч${plural(c.sessionsDone)}` : "встреч пока нет"}
                {c.hoursDone > 0 && ` · ${c.hoursDone} ч`}
              </span>
              {c.hwTotal > 0 && (
                <span className="t-cap inline-flex items-center gap-1.5">
                  <Icon name="note" width={13} weight="bold" color={`var(--${tone}-edge)`} />
                  {c.hwDone}/{c.hwTotal} заданий
                </span>
              )}
              {c.link === "invited" && (
                <span className="t-cap inline-flex items-center gap-1.5">
                  <Icon name="bell" width={13} weight="bold" color={`var(--${tone}-edge)`} /> приглашён
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-3">
        <span
          className="t-cap pointer-events-none flex w-full items-center gap-1.5 rounded-full px-3 py-2"
          style={{ background: "var(--surface-2)", color: c.nextAt ? "var(--ink)" : "var(--muted-2)" }}
        >
          <Icon name="calendar" width={13} weight="bold" color={c.nextAt ? "var(--muted)" : "var(--muted-2)"} />
          {c.nextAt ? `Ближайшая · ${relDay(c.nextAt)}` : "Записи нет"}
        </span>
        <div className={`mt-2 grid gap-2 ${href ? "grid-cols-2" : "grid-cols-1"}`}>
          <Link
            href={`/clients/?id=${c.id}`}
            onClick={tap}
            className="t-cap relative z-20 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3.5 py-2.5 font-black"
            style={{ background: "#fff", border: "var(--bw) solid var(--purple-edge)", color: "var(--purple-edge)" }}
          >
            <Icon name="user" width={13} weight="bold" color="var(--purple-edge)" /> Открыть карточку
          </Link>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={tap}
              className="t-cap inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3.5 py-2.5 font-black"
              style={{ background: `var(--${tone}-edge)`, border: `var(--bw) solid var(--${tone}-edge)`, color: "#fff" }}
            >
              <Icon name="telegram" width={13} weight="fill" color="#fff" /> Написать
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// Анонс мультитулов: сплошная плашка тоном раздела, без кнопки —
// обещать нечего, пока модулей нет. Задача блока — застолбить направление.
function ModulesTeaser() {
  const kinds = ["КПТ", "Схема-терапия", "Детская", "Семейная", "Травма"];
  const [hidden, setHidden] = useState(() => typeof window !== "undefined" && localStorage.getItem(MODULES_TEASER_KEY) === "1");
  if (hidden) return null;
  const close = () => { tap(); localStorage.setItem(MODULES_TEASER_KEY, "1"); setHidden(true); };
  return (
    <section className="relative mb-4 overflow-hidden rounded-[20px] p-4" style={{ background: "var(--head)" }}>
      <button onClick={close} aria-label="Скрыть анонс модулей" className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full transition-transform active:scale-90" style={{ background: "rgba(255,255,255,.3)" }}>
        <Icon name="close" width={14} weight="bold" color="#fff" />
      </button>
      <div className="relative flex items-start gap-3">
        <motion.span
          className="ico ico-white h-11 w-11 shrink-0"
          animate={{ rotate: [0, -12, 12, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.2 }}
        >
          <Icon name="tools" width={21} weight="bold" color="var(--edge)" />
        </motion.span>
        <div className="min-w-0 flex-1">
          <span className="chip chip-strong uppercase">Скоро</span>
          <h2 className="font-tight mt-1.5 text-[18px] font-black leading-tight">Модули для усиленной работы с клиентом</h2>
          <p className="t-sub mt-1">Мультитулы под вашу специализацию: протоколы, замеры и материалы к сессии — собраны в один рабочий набор и подставляются в карточку клиента.</p>
        </div>
      </div>
      <div className="no-scrollbar relative -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1">
        {kinds.map((k) => <span key={k} className="chip shrink-0 bg-white">{k}</span>)}
      </div>
    </section>
  );
}

function plural(n: number) {
  const d = n % 10, dd = n % 100;
  if (d === 1 && dd !== 11) return "а";
  if (d >= 2 && d <= 4 && (dd < 10 || dd >= 20)) return "и";
  return "";
}

// Быстрое добавление: имя + фамилия → создаём карточку и открываем её.
function QuickAddClient({ open, first, last, contact, setFirst, setLast, setContact, pending, onCreate }: { open: boolean; first: string; last: string; contact: string; setFirst: (v: string) => void; setLast: (v: string) => void; setContact: (v: string) => void; pending: boolean; onCreate: (invite: boolean) => void }) {
  const fullName = [first, last].filter(Boolean).join(" ");
  const setFullName = (value: string) => {
    const [nextFirst = "", ...rest] = value.split(/\s+/);
    setFirst(nextFirst);
    setLast(rest.join(" "));
  };
  return (
    <Disclosure open={open} autoScroll={false}>
      {/* Тот же порядок полей, что и при добавлении из окна сессии */}
      <div className="card mb-4 p-3.5">
        <div className="mb-2.5 flex items-center gap-2">
          <span className="ico h-8 w-8"><Icon name="user" width={16} weight="bold" color="var(--edge)" /></span>
          <div><p className="text-[13px] font-black leading-none">Новый клиент</p><p className="t-cap mt-0.5">Имя, фамилия и контакт — карточка откроется сразу</p></div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onCreate(false); }} className="space-y-2">
          <Input className="[caret-color:var(--ink)]" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Имя и фамилия" autoFocus enterKeyHint="next" />
          <Input className="[caret-color:var(--ink)]" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Телефон или Telegram" enterKeyHint="done" />
          <button type="submit" disabled={pending || !first.trim()} className="btn w-full py-2.5">
            <Icon name="plus" width={15} weight="bold" color="#fff" /> Создать карточку
          </button>
          <button type="button" disabled={pending || !first.trim()} onClick={() => onCreate(true)} className="btn btn-accent w-full py-2.5">
            <Icon name="telegram" width={15} weight="fill" color="#fff" /> Создать и пригласить в Telegram
          </button>
          <p className="t-cap text-center">Приглашение открывает Telegram с готовым текстом. Когда клиент подключится, его настроение и задания появятся в карточке.</p>
        </form>
      </div>
    </Disclosure>
  );
}

