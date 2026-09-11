"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState, type CSSProperties } from "react";

import { ClientAvatar } from "@/components/client-avatar";
import { Icon, type IconName } from "@/components/icons";
import { InviteShare } from "@/components/invite-share";
import { ProPaywall } from "@/components/pro-sell";
import { bookingInviteUrl } from "@/components/session-invite";
import { byAppointments, contactHref, createClient, derivedStatus, listClients, STATUS_LABEL, type Client, type ClientStatus } from "@/lib/clients";
import { success, tap } from "@/lib/haptics";
import { useMe } from "@/lib/me";
import { FREE_CLIENT_LIMIT, getSubscription, isPro } from "@/lib/subscription";
import { zoneDayDiff, zoneFormat } from "@/lib/zone";

const EASE = [0.16, 1, 0.3, 1] as const;
const LINE = "var(--hairline)";
const SUB = "var(--muted)";

type Filter = ClientStatus | "all";
const TILES: { key: Filter; label: string; bg: string; icon: IconName }[] = [
  { key: "all", label: "Все", bg: "var(--surface)", icon: "users" },
  { key: "therapy", label: "В терапии", bg: "var(--green-soft)", icon: "therapy" },
  { key: "new", label: "Новые", bg: "var(--purple-soft)", icon: "spark" },
  { key: "paused", label: "Пауза", bg: "var(--amber-soft)", icon: "clock" },
];
const PILL: Record<ClientStatus, string> = { therapy: "var(--green)", new: "var(--purple)", paused: "var(--amber)" };

// Клиент · статус · ближайшая · встречи · задания · действие
const COLS = "md:grid-cols-[minmax(0,1.7fr)_104px_minmax(0,1.1fr)_96px_minmax(0,1fr)_112px]";

const timeF = zoneFormat({ hour: "2-digit", minute: "2-digit" });
const dayF = zoneFormat({ weekday: "short", day: "numeric", month: "short" });
const shortF = zoneFormat({ day: "numeric", month: "short" });

function nextLabel(iso: string): string {
  const d = new Date(iso);
  const diff = zoneDayDiff(new Date(), d);
  const day = diff === 0 ? "Сегодня" : diff === 1 ? "Завтра" : dayF.format(d);
  return `${day}, ${timeF.format(d)}`;
}

export function WebClients() {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [paywall, setPaywall] = useState(false);

  const { data: clients = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
    refetchInterval: (q) => (q.state.data?.some((c) => c.link === "invited") ? 2500 : false),
  });
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  const pro = isPro(sub);
  const atCap = !pro && clients.length >= FREE_CLIENT_LIMIT;

  const count = (key: Filter) => (key === "all" ? clients.length : clients.filter((c) => derivedStatus(c) === key).length);
  const q = useDeferredValue(search).trim().toLowerCase();
  const list = clients
    .filter((c) => filter === "all" || derivedStatus(c) === filter)
    .filter((c) => c.name.toLowerCase().includes(q))
    .sort(byAppointments);

  return (
    <div data-wide className="pb-4">
      <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="mr-auto">
          <h1 className="text-[28px] font-[650] leading-none tracking-tight">Клиенты</h1>
          {!pro && (
            <button onClick={() => { tap(); setPaywall(true); }} className="mt-1.5 text-[12px] font-semibold" style={{ color: atCap ? "var(--salmon-edge)" : SUB }}>
              {Math.min(clients.length, FREE_CLIENT_LIMIT)}/{FREE_CLIENT_LIMIT} на бесплатном тарифе{atCap ? " · лимит" : ""}
            </button>
          )}
        </div>
        <label className="flex h-9 w-full items-center gap-2 rounded-[14px] pl-1 pr-3 sm:w-[280px]" style={{ background: "var(--surface)", border: `1px solid ${LINE}` }}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--raspberry)" }}>
            <Icon name="zoom" width={13} weight="bold" />
          </span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по имени" className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold outline-none" />
        </label>
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {TILES.map((t, i) => {
              const on = filter === t.key;
              return (
                <motion.button
                  key={t.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.4, ease: EASE }}
                  onClick={() => { tap(); setFilter(t.key); }}
                  className="flex h-[74px] flex-col justify-between rounded-[16px] p-3 text-left transition-colors"
                  style={on ? { background: "var(--ink)", color: "#fff" } : { background: t.bg, border: t.key === "all" ? `1px solid ${LINE}` : undefined }}
                >
                  <span className="flex items-center justify-between">
                    <span className="tnum text-[22px] font-black leading-none">{count(t.key)}</span>
                    <Icon name={t.icon} width={15} color={on ? "#fff" : "var(--ink)"} />
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-[0.12em]" style={{ opacity: on ? 0.75 : 0.55 }}>{t.label}</span>
                </motion.button>
              );
            })}
          </div>

          <div className={`mt-4 hidden gap-3 px-3 pb-2 text-[8px] font-bold uppercase tracking-[0.12em] md:grid ${COLS}`} style={{ color: SUB }}>
            <span>Клиент</span><span>Статус</span><span>Ближайшая запись</span><span>Встречи</span><span>Задания</span><span />
          </div>

          <div className="mt-2 grid gap-1.5 md:mt-0">
            {isError && (
              <p className="py-6 text-[12px] font-semibold" style={{ color: SUB }}>
                Список не загрузился. <button onClick={() => refetch()} className="underline">Повторить</button>
              </p>
            )}
            {isLoading && Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-[54px] rounded-[14px]" />)}
            {!isLoading && !isError && list.length === 0 && (
              <p className="py-6 text-[12px] font-semibold" style={{ color: SUB }}>
                {clients.length === 0 ? "Клиентов пока нет." : "Никого не нашлось."}
              </p>
            )}
            {list.map((c, i) => <Row key={c.id} c={c} i={i} />)}
          </div>
        </div>

        <aside className="grid content-start gap-2.5">
          <NewClient atCap={atCap} onCap={() => setPaywall(true)} />
          <PageLink />
        </aside>
      </div>

      <ProPaywall open={paywall} onClose={() => setPaywall(false)} />
    </div>
  );
}

function Row({ c, i }: { c: Client; i: number }) {
  const status = derivedStatus(c);
  const href = contactHref(c);
  const hwPart = c.hwTotal ? c.hwDone / c.hwTotal : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 12) * 0.025, duration: 0.35, ease: EASE }}
      className={`group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] px-3 py-2.5 transition-colors hover:bg-[var(--surface)] ${COLS}`}
      style={{ background: "var(--surface-2)" }}
    >
      <Link href={`/clients/?id=${c.id}`} className="absolute inset-0 rounded-[14px]" aria-label={c.name} />

      <span className="pointer-events-none flex min-w-0 items-center gap-2.5">
        <ClientAvatar name={c.name} photo={c.photo} className="h-8 w-8 shrink-0 rounded-[10px] text-[12px] font-black" style={{ background: "var(--purple-soft)" } as CSSProperties} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-bold leading-tight">{c.name}</span>
          <span className="block truncate text-[10px] font-medium" style={{ color: SUB }}>
            {c.link === "invited" ? "приглашён" : c.contact || (c.link === "joined" ? "в приложении" : "без контакта")}
            {c.demo ? " · демо" : ""}
          </span>
        </span>
      </span>

      <span className="pointer-events-none">
        <span className="rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em]" style={{ background: PILL[status] }}>{STATUS_LABEL[status]}</span>
      </span>

      <span className="pointer-events-none hidden text-[11px] font-semibold md:block">
        {c.nextAt ? nextLabel(c.nextAt) : <span style={{ color: SUB }}>{c.lastAt ? `была ${shortF.format(new Date(c.lastAt))}` : "записи нет"}</span>}
      </span>

      <span className="tnum pointer-events-none hidden text-[11px] font-semibold md:block">
        {c.sessionsDone}
        <span style={{ color: SUB }}>{c.hoursDone ? ` · ${c.hoursDone} ч` : ""}</span>
      </span>

      <span className="pointer-events-none hidden items-center gap-2 md:flex">
        {c.hwTotal > 0 ? (
          <>
            <span className="h-[5px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--hairline)" }}>
              <span className="block h-full rounded-full" style={{ width: `${hwPart * 100}%`, background: "var(--tiffany-edge)" }} />
            </span>
            <span className="tnum text-[10px] font-bold">{c.hwDone}/{c.hwTotal}</span>
          </>
        ) : (
          <span className="text-[11px] font-semibold" style={{ color: SUB }}>—</span>
        )}
      </span>

      <span className="pointer-events-none relative hidden justify-end md:flex">
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={() => tap()}
            className="pointer-events-auto flex h-7 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            style={{ background: "var(--ink)", color: "#fff" }}
          >
            <Icon name="telegram" width={12} color="#fff" /> Написать
          </a>
        )}
      </span>
    </motion.div>
  );
}

function NewClient({ atCap, onCap }: { atCap: boolean; onCap: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const add = useMutation({
    mutationFn: () => createClient(name.trim().replace(/\s+/g, " "), contact.trim()),
    onSuccess: (c) => {
      success();
      setName(""); setContact("");
      qc.invalidateQueries({ queryKey: ["clients"] });
      router.push(`/clients/?id=${c.id}`);
    },
  });
  const field = "h-9 w-full rounded-[12px] px-3 text-[12px] font-semibold outline-none";

  return (
    <section className="rounded-[18px] p-4" style={{ background: "var(--raspberry-soft)" }}>
      <h2 className="text-[14px] font-[650] leading-none">Новый клиент</h2>
      <form
        onSubmit={(e) => { e.preventDefault(); if (atCap) { onCap(); return; } add.mutate(); }}
        className="mt-3 grid gap-2"
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя и фамилия" autoComplete="off" className={field} style={{ background: "var(--surface)" }} />
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Телефон или Telegram" autoComplete="off" className={field} style={{ background: "var(--surface)" }} />
        <button type="submit" disabled={add.isPending || !name.trim()} className="mt-1 flex h-9 items-center justify-center gap-1.5 rounded-full text-[12px] font-bold text-white disabled:opacity-45" style={{ background: "var(--ink)" }}>
          <Icon name="plus" width={13} weight="bold" color="#fff" /> Завести карточку
        </button>
      </form>
    </section>
  );
}

function PageLink() {
  const { data: me } = useMe();
  return (
    <section className="rounded-[18px] p-4" style={{ background: "var(--surface)", border: `1px solid ${LINE}` }}>
      <h2 className="text-[14px] font-[650] leading-none">Ссылка на вашу страницу</h2>
      <div className="mt-3"><InviteShare link={bookingInviteUrl(me?.id)} /></div>
    </section>
  );
}
