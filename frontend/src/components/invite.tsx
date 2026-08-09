"use client";

import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { APP_NAME, botDeepLink } from "@/lib/brand";
import { select, success, tap } from "@/lib/haptics";
import { useRole } from "@/lib/role";

type Variant = "psy" | "client";

// Сколько коллег нужно привести до месяца Pro.
const GOAL = 5;

const COPY: Record<Variant, { title: string; sub: ReactNode; share: string }> = {
  psy: {
    title: "Подарки за приглашения",
    sub: <>За <b className="font-black text-[var(--ink)]">{GOAL}</b> приглашённых коллег, кто заполнит профиль в «Хронике», дарим месяц Pro.</>,
    share: "Приглашаю на цифровую платформу для психологов «Хроника»: клиенты, расписание и заметки в одном месте. Упростите работу с клиентами.",
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
        {psy ? (
          <div className="relative min-h-[84px] pr-[88px]">
            <GiftArt />
            <p className="t-title">Пригласите коллег и получите бонусы!</p>
            <p className="t-sub mt-1">Бесплатный месяц Pro и не только</p>
          </div>
        ) : (
          <div className="relative flex items-center gap-3.5">
            <motion.span className="ico ico-white h-14 w-14 shrink-0" animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}><Icon name="users" width={26} weight="fill" color="var(--olive-edge)" /></motion.span>
            <div className="min-w-0 flex-1">
              <p className="t-micro">Приведите друга</p>
              <p className="t-title mt-0.5">Подарите другу заботу о себе</p>
            </div>
          </div>
        )}
        {/* Кнопка в цвет обводки блока */}
        <span className="btn relative mt-3.5 w-full"><Icon name="users" width={15} weight="fill" color="#fff" /> Пригласить</span>
      </button>
      <AnimatePresence>{open && <InviteSheet variant={variant} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

// Подарок справа в баннере — рисунок поверх заливки, а не иконка.
function GiftArt() {
  return (
    <motion.svg
      aria-hidden
      viewBox="0 0 96 96"
      className="pointer-events-none absolute -right-2 -top-1 h-[84px] w-[84px]"
      animate={{ y: [0, -4, 0], rotate: [-2.5, 2.5, -2.5] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    >
      <circle cx="56" cy="42" r="38" fill="#fff" opacity=".26" />
      <circle cx="20" cy="72" r="11" fill="#fff" opacity=".2" />
      <ellipse cx="42" cy="30" rx="11" ry="7" transform="rotate(-20 42 30)" fill="#fff" stroke="var(--olive-edge)" strokeOpacity=".3" strokeWidth="2" />
      <ellipse cx="62" cy="30" rx="11" ry="7" transform="rotate(20 62 30)" fill="#fff" stroke="var(--olive-edge)" strokeOpacity=".3" strokeWidth="2" />
      <rect x="28" y="50" width="48" height="34" rx="8" fill="#fff" stroke="var(--olive-edge)" strokeOpacity=".3" strokeWidth="2" />
      <rect x="23" y="38" width="58" height="16" rx="7" fill="#fff" stroke="var(--olive-edge)" strokeOpacity=".3" strokeWidth="2" />
      <path d="M52 38v46" stroke="var(--olive-edge)" strokeOpacity=".45" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="52" cy="34" r="4.5" fill="#fff" stroke="var(--olive-edge)" strokeOpacity=".3" strokeWidth="2" />
      <path d="M14 26l1.9 5.1L21 33l-5.1 1.9L14 40l-1.9-5.1L7 33l5.1-1.9z" fill="#fff" opacity=".75" />
      <path d="M86 62l1.3 3.5L91 67l-3.7 1.5L86 72l-1.3-3.5L81 67l3.7-1.5z" fill="#fff" opacity=".6" />
    </motion.svg>
  );
}

function InviteSheet({ variant, onClose }: { variant: Variant; onClose: () => void }) {
  const c = COPY[variant];
  const psy = variant === "psy";
  const [code, setCode] = useState("VDOH");
  const [invited, setInvited] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setCode(refCode()); setInvited(Number(localStorage.getItem("bereg_invited") || 0)); }, []);

  // Ссылка ведёт в бота: мини-приложение должно открыться внутри Telegram,
  // а не в браузере. Реферальный код уезжает в start_param.
  const link = botDeepLink(`ref_${code}`);
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(c.share)}`;
  const bump = () => { const n = invited + 1; setInvited(n); localStorage.setItem("bereg_invited", String(n)); };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ } };

  // Одна кнопка: кладём ссылку в буфер и сразу предлагаем отправить — системным
  // «Поделиться», где он есть, иначе через Telegram.
  const share = async () => {
    await copy();
    success();
    if (typeof navigator.share === "function") {
      try { await navigator.share({ title: APP_NAME, text: c.share, url: link }); bump(); } catch { /* отменили — ссылка всё равно в буфере */ }
      return;
    }
    window.open(shareUrl, "_blank", "noopener,noreferrer");
    bump();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(32,28,24,.46)] p-3 backdrop-blur-[2px] @md:items-center" onClick={onClose}>
      <motion.div initial={{ y: 34 }} animate={{ y: 0 }} exit={{ y: 34, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 32 }} onClick={(e) => e.stopPropagation()} className="chunk max-h-[min(92dvh,calc(100dvh-var(--top-pad)))] w-full max-w-md overflow-y-auto p-0" style={{ background: "var(--surface)" }}>
        {/* Герой */}
        <div className="relative overflow-hidden p-5" style={{ background: "var(--olive-soft)" }}>
          <button onClick={onClose} className="x-close absolute right-4 top-4 h-8 w-8 rounded-full bg-white text-[15px]" aria-label="Закрыть">✕</button>
          {!psy && <span className="ico ico-white relative h-12 w-12"><Icon name="spark" width={24} weight="fill" color="var(--edge)" /></span>}
          <h3 className={`font-tight relative text-[20px] font-black leading-tight ${psy ? "pr-10" : "mt-3"}`}>{c.title}</h3>
          {c.sub && <p className="t-sub relative mt-1.5">{c.sub}</p>}
        </div>

        <div className="space-y-4 p-5">
          {/* Счётчик с метками: пять приглашённых — месяц Pro */}
          {psy && <div className="card-soft p-3.5" style={{ background: "var(--purple-soft)" }}>
            <div className="flex items-end justify-between">
              <div>
                <p className="t-micro">Приглашено</p>
                <p className="font-tight tnum text-[26px] font-black leading-none">{invited}<span className="text-[16px] text-[var(--muted)]"> / {GOAL}</span></p>
              </div>
              <p className="t-cap">до месяца Pro: {Math.max(0, GOAL - invited)}</p>
            </div>
            <div className="mt-2.5 flex gap-1.5">
              {Array.from({ length: GOAL }).map((_, i) => (
                <motion.span key={i} className="h-2.5 flex-1 rounded-full" style={{ background: i < invited ? "var(--purple-edge)" : "#fff" }} initial={{ opacity: 0, scaleX: 0.4 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: i * 0.06 }} />
              ))}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              {Array.from({ length: GOAL }).map((_, i) => (
                <span key={i} className="tnum t-cap flex-1 text-center" style={i < invited ? { color: "var(--ink)" } : undefined}>{i + 1}</span>
              ))}
            </div>
          </div>}

          {/* Поделиться — единственное действие: копирует ссылку и открывает шер */}
          <button onClick={share} className="btn w-full py-3.5 text-[15px]">
            <Icon name={copied ? "check" : "share"} width={17} weight="fill" color="#fff" /> {copied ? "Ссылка скопирована" : "Поделиться ссылкой"}
          </button>

          <div>
            {!psy && <p className="t-micro mb-1.5">Ссылка на Telegram-бота</p>}
            <p className="t-cap break-all text-center">{link.replace(/^https?:\/\//, "")}</p>
          </div>

          {psy && <p className="t-cap text-center">Очко засчитывается, когда коллега перешёл по вашей ссылке, заполнил профиль и отправил его на верификацию.</p>}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function useInviteVariant(): Variant {
  const [role] = useRole();
  return role === "psychologist" ? "psy" : "client";
}
