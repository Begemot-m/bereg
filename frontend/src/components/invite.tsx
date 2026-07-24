"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { asset } from "@/lib/asset";
import { select, success, tap } from "@/lib/haptics";
import { useRole } from "@/lib/role";

type Variant = "psy" | "client";

const PERKS: Record<Variant, { need: number; reward: string }[]> = {
  psy: [
    { need: 1, reward: "Бонусные шаблоны техник" },
    { need: 3, reward: "Месяц продвижения в каталоге бесплатно" },
    { need: 5, reward: "Значок «Амбассадор» в профиле" },
  ],
  client: [
    { need: 1, reward: "Неделя «Клубок+» в подарок" },
    { need: 3, reward: "Месяц «Клубок+» бесплатно" },
    { need: 5, reward: "Персональный набор практик" },
  ],
};

const COPY: Record<Variant, { title: string; sub: string; share: string }> = {
  psy: {
    title: "Приглашайте — получайте плюшки",
    sub: "Зовите клиентов и коллег во «Клубок». За каждого приглашённого — приятные бонусы.",
    share: "Веду практику во «Клубок» — удобные инструменты и забота о клиентах между сессиями. Присоединяйтесь:",
  },
  client: {
    title: "Поделитесь заботой",
    sub: "Позовите друга во «Клубок». Вам — подарки, другу — тёплый старт.",
    share: "Забочусь о себе во «Клубок»: настроение, практики, колесо баланса. Попробуй и ты:",
  },
};

function refCode(): string {
  if (typeof window === "undefined") return "VDOH";
  let c = localStorage.getItem("bereg_ref");
  if (!c) { c = Math.random().toString(36).slice(2, 8).toUpperCase(); localStorage.setItem("bereg_ref", c); }
  return c;
}
function appUrl(): string {
  if (typeof window === "undefined") return "https://begemot-m.github.io/bereg/";
  return window.location.origin + asset("/");
}

export function InviteButton({ variant, className = "", label = "Пригласить" }: { variant: Variant; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => { tap(); setOpen(true); }} className={`inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2 text-[13px] font-black text-white transition-transform active:scale-[0.97] ${className}`}>
        <Icon name="spark" width={14} weight="fill" /> {label}
      </button>
      <AnimatePresence>{open && <InviteSheet variant={variant} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

// Постер-приглашение (для главной и кабинета).
export function InviteBanner({ variant }: { variant: Variant }) {
  const [open, setOpen] = useState(false);
  const psy = variant === "psy";
  return (
    <>
      <button onClick={() => { tap(); setOpen(true); }} className="relative w-full overflow-hidden rounded-[22px] p-5 text-left transition-transform active:scale-[0.99]" style={{ background: "var(--olive)", border: "var(--bw-lg) solid var(--olive-edge)" }}>
        <motion.span aria-hidden className="absolute -right-8 -top-10 h-28 w-28 rounded-full" style={{ background: "rgba(255,255,255,.28)" }} animate={{ y: [0, 10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} />
        <motion.span aria-hidden className="absolute -bottom-6 right-14 h-14 w-14 rounded-full" style={{ background: "rgba(255,255,255,.2)" }} animate={{ y: [0, -8, 0] }} transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }} />
        <div className="relative flex items-center gap-3.5">
          <motion.span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-white" style={{ border: "var(--bw-lg) solid var(--olive-edge)" }} animate={{ scale: [1, 1.08, 1], rotate: [0, -5, 5, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}><Icon name="heart" width={26} weight="fill" color="var(--olive-edge)" /></motion.span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.14em] opacity-70">Приведите {psy ? "коллегу" : "друга"}</p>
            <p className="mt-0.5 font-tight text-[19px] font-black leading-tight">{psy ? "Позовите коллег в «Клубок»" : "Подарите другу неделю Клубок+"}</p>
            <p className="mt-1 text-[11.5px] font-bold">{psy ? "Коллеге — месяц PRO, вам — бонус" : "Другу — 7 дней бесплатно, вам — бонус"}</p>
          </div>
        </div>
        <span className="relative mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-[14px] bg-[var(--ink)] py-2.5 text-[13px] font-black text-white"><Icon name="spark" width={15} weight="fill" /> Пригласить</span>
      </button>
      <AnimatePresence>{open && <InviteSheet variant={variant} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function InviteSheet({ variant, onClose }: { variant: Variant; onClose: () => void }) {
  const c = COPY[variant];
  const perks = PERKS[variant];
  const [code, setCode] = useState("VDOH");
  const [invited, setInvited] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setCode(refCode()); setInvited(Number(localStorage.getItem("bereg_invited") || 0)); }, []);

  const link = `${appUrl()}?ref=${code}`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(c.share)}`;
  const bump = () => { const n = invited + 1; setInvited(n); localStorage.setItem("bereg_invited", String(n)); };
  const copy = async () => { try { await navigator.clipboard.writeText(link); success(); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ } };

  const nextPerk = perks.find((p) => invited < p.need) ?? perks[perks.length - 1];
  const progress = Math.min(1, invited / nextPerk.need);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(32,28,24,.46)] p-3 backdrop-blur-[2px] @md:items-center" onClick={onClose}>
      <motion.div initial={{ y: 34 }} animate={{ y: 0 }} exit={{ y: 34, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 32 }} onClick={(e) => e.stopPropagation()} className="chunk max-h-[92dvh] w-full max-w-md overflow-y-auto p-0" style={{ background: "var(--surface)" }}>
        {/* Герой */}
        <div className="relative p-5" style={{ background: "linear-gradient(150deg, var(--amber), var(--amber-soft))", borderBottom: "var(--bw-lg) solid var(--amber-edge)" }}>
          <button onClick={onClose} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[15px] font-black stroke" aria-label="Закрыть">✕</button>
          <span className="flex h-12 w-12 items-center justify-center rounded-[15px] bg-white" style={{ border: "var(--bw) solid var(--amber-edge)" }}><Icon name="spark" width={24} weight="fill" /></span>
          <h3 className="font-tight mt-3 text-[20px] font-black leading-tight">{c.title}</h3>
          <p className="mt-1 text-[12px] font-bold text-[var(--muted)]">{c.sub}</p>
        </div>

        <div className="space-y-4 p-5">
          {/* Прогресс к плюшке */}
          <div className="rounded-[16px] p-3.5" style={{ background: "var(--amber-soft)", border: "var(--bw) solid var(--amber-edge)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-black">Приглашено: {invited}</p>
              <p className="text-[11px] font-bold text-[var(--muted)]">до подарка: {Math.max(0, nextPerk.need - invited)}</p>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white" style={{ border: "var(--bw) solid var(--amber-edge)" }}><motion.div className="h-full rounded-full bg-[var(--ink)]" initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.6 }} /></div>
            <p className="mt-2 text-[11px] font-bold">🎁 {nextPerk.reward}</p>
          </div>

          {/* Реферальная ссылка */}
          <div>
            <p className="mb-1.5 text-[11px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Ваша ссылка-приглашение</p>
            <div className="flex items-center gap-2 rounded-[13px] bg-white px-3 py-2.5" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
              <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-[var(--muted)]">{link.replace(/^https?:\/\//, "")}</span>
              <button onClick={copy} className="shrink-0 rounded-full bg-[var(--head-soft)] px-2.5 py-1 text-[11px] font-black stroke">{copied ? "Скопировано" : "Копировать"}</button>
            </div>
          </div>

          {/* Поделиться */}
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" onClick={() => { bump(); success(); }} className="flex w-full items-center justify-center gap-2 rounded-[15px] bg-[var(--ink)] py-3.5 text-[15px] font-black text-white transition-transform active:scale-[0.98]">
            <Icon name="spark" width={17} weight="fill" /> Поделиться в Telegram
          </a>

          {/* Дорожная карта плюшек */}
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Что можно получить</p>
            <div className="space-y-1.5">
              {perks.map((p) => {
                const got = invited >= p.need;
                return (
                  <div key={p.need} className="flex items-center gap-2.5 rounded-[13px] p-2.5" style={{ background: got ? "var(--green-soft)" : "#fff", border: `var(--bw) solid ${got ? "var(--green-edge)" : "var(--edge-neutral)"}` }}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white text-[12px] font-black stroke">{p.need}</span>
                    <span className="min-w-0 flex-1 text-[12px] font-bold">{p.reward}</span>
                    {got ? <Icon name="check" width={16} weight="fill" color="var(--green-edge)" /> : <span className="text-[10px] font-black uppercase text-[var(--muted-2)]">нужно {p.need}</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-center text-[10px] font-semibold text-[var(--muted-2)]">Бонусы начисляются, когда приглашённый регистрируется по вашей ссылке.</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function useInviteVariant(): Variant {
  const [role] = useRole();
  return role === "psychologist" ? "psy" : "client";
}
