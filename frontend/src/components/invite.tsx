"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { botDeepLink } from "@/lib/brand";
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
    { need: 1, reward: "Неделя «Хроника+» в подарок" },
    { need: 3, reward: "Месяц «Хроника+» бесплатно" },
    { need: 5, reward: "Персональный набор практик" },
  ],
};

const COPY: Record<Variant, { title: string; sub: string; share: string }> = {
  psy: {
    title: "Приглашайте — получайте плюшки",
    sub: "Зовите клиентов и коллег в «Хронику». За каждого приглашённого — приятные бонусы.",
    share: "Веду практику в «Хронике» — удобные инструменты и забота о клиентах между сессиями. Присоединяйтесь:",
  },
  client: {
    title: "Подарите другу заботу о себе",
    sub: "",
    share: "Забочусь о себе в «Хронике»: настроение, практики, колесо баланса. Попробуй и ты:",
  },
};

function refCode(): string {
  if (typeof window === "undefined") return "VDOH";
  let c = localStorage.getItem("bereg_ref");
  if (!c) { c = Math.random().toString(36).slice(2, 8).toUpperCase(); localStorage.setItem("bereg_ref", c); }
  return c;
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
      {/* Салатовый — в тон блоку настроения дня */}
      <button onClick={() => { tap(); setOpen(true); }} className="card-soft relative w-full overflow-hidden p-5 text-left transition-transform active:scale-[0.99]" style={{ background: "var(--olive-soft)" }}>
        <motion.span aria-hidden className="absolute -bottom-6 right-14 h-14 w-14 rounded-full" style={{ background: "rgba(255,255,255,.35)" }} animate={{ y: [0, -8, 0] }} transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }} />
        <div className="relative flex items-center gap-3.5">
          <motion.span className="ico ico-white h-14 w-14 shrink-0" animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}><Icon name="users" width={26} weight="fill" color="var(--olive-edge)" /></motion.span>
          <div className="min-w-0 flex-1">
            <p className="t-micro">Приведите {psy ? "коллегу" : "друга"}</p>
            <p className="t-title mt-0.5">{psy ? "Позовите коллег в «Хронику»" : "Подарите другу заботу о себе"}</p>
            {psy && <p className="t-sub mt-1">Коллеге — месяц PRO, вам — бонус</p>}
          </div>
        </div>
        {/* Кнопка в цвет обводки блока */}
        <span className="btn relative mt-3.5 w-full"><Icon name="users" width={15} weight="fill" color="#fff" /> Пригласить</span>
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

  // Обе ссылки ведут в бота: мини-приложение должно открыться внутри Telegram,
  // а не в браузере. Реферальный код уезжает в start_param.
  const link = botDeepLink(`ref_${code}`);
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(c.share)}`;
  const bump = () => { const n = invited + 1; setInvited(n); localStorage.setItem("bereg_invited", String(n)); };
  const copy = async () => { try { await navigator.clipboard.writeText(link); success(); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ } };

  const nextPerk = perks.find((p) => invited < p.need) ?? perks[perks.length - 1];
  const progress = Math.min(1, invited / nextPerk.need);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(32,28,24,.46)] p-3 backdrop-blur-[2px] @md:items-center" onClick={onClose}>
      <motion.div initial={{ y: 34 }} animate={{ y: 0 }} exit={{ y: 34, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 32 }} onClick={(e) => e.stopPropagation()} className="chunk max-h-[min(92dvh,calc(100dvh-var(--top-pad)))] w-full max-w-md overflow-y-auto p-0" style={{ background: "var(--surface)" }}>
        {/* Герой */}
        <div className="relative overflow-hidden p-5" style={{ background: "var(--head)" }}>
          <motion.span aria-hidden className="absolute -right-8 -top-10 h-28 w-28 rounded-full" style={{ background: "rgba(255,255,255,.3)" }} animate={{ y: [0, 9, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} />
          <button onClick={onClose} className="x-close absolute right-4 top-4 h-8 w-8 rounded-full bg-white text-[15px]" aria-label="Закрыть">✕</button>
          <span className="ico ico-white relative h-12 w-12"><Icon name="spark" width={24} weight="fill" color="var(--edge)" /></span>
          <h3 className="font-tight relative mt-3 text-[20px] font-black leading-tight">{c.title}</h3>
          {c.sub && <p className="t-sub relative mt-1">{c.sub}</p>}
        </div>

        <div className="space-y-4 p-5">
          {/* Прогресс к плюшке */}
          {variant === "psy" && <div className="card-soft p-3.5">
            <div className="flex items-end justify-between">
              <div>
                <p className="t-micro">Приглашено</p>
                <p className="font-tight tnum text-[26px] font-black leading-none">{invited}</p>
              </div>
              <p className="t-cap">до подарка: {Math.max(0, nextPerk.need - invited)}</p>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white"><motion.div className="h-full rounded-full" style={{ background: "var(--edge)" }} initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.6 }} /></div>
            <p className="t-body mt-2">🎁 {nextPerk.reward}</p>
          </div>}

          {/* Поделиться — главное действие, поэтому сразу под прогрессом */}
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" onClick={() => { bump(); success(); }} className="btn w-full py-3.5 text-[15px]">
            <Icon name="telegram" width={17} weight="fill" color="#fff" /> Поделиться в Telegram
          </a>

          {/* Реферальная ссылка */}
          <div>
            {variant === "client" && <p className="t-micro mb-2">Ссылка на Telegram-бота</p>}
            <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2" style={{ border: "1px solid var(--head)" }}>
              <span className="t-cap min-w-0 flex-1 truncate">{link.replace(/^https?:\/\//, "")}</span>
              <button onClick={copy} className="btn btn-accent shrink-0 px-2.5 py-1 text-[11px]">{copied ? "Скопировано" : "Копировать"}</button>
            </div>
          </div>

          {/* Дорожная карта плюшек */}
          {variant === "psy" && <div>
            <p className="t-micro mb-2">Что можно получить</p>
            <div className="space-y-1.5">
              {perks.map((p) => {
                const got = invited >= p.need;
                return (
                  <div key={p.need} className="card-soft flex items-center gap-2.5 p-2.5" style={got ? { background: "var(--green-soft)" } : { background: "var(--surface-2)" }}>
                    <span className="ico ico-white h-8 w-8 shrink-0 text-[12px] font-black">{p.need}</span>
                    <span className="t-body min-w-0 flex-1">{p.reward}</span>
                    {got ? <Icon name="check" width={16} weight="fill" color="var(--green-edge)" /> : <span className="t-cap shrink-0">нужно {p.need}</span>}
                  </div>
                );
              })}
            </div>
          </div>}
          {variant === "psy" && <p className="t-cap text-center">Бонусы начисляются, когда приглашённый регистрируется по вашей ссылке.</p>}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function useInviteVariant(): Variant {
  const [role] = useRole();
  return role === "psychologist" ? "psy" : "client";
}
