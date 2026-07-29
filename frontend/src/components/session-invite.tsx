"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

import { ArrowGlyph } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { asset } from "@/lib/asset";
import { OWN_PROFILE_ID } from "@/lib/catalog";
import { success, tap } from "@/lib/haptics";
import { useProfile } from "@/lib/profile";
import { getMonthAvailability, getSlots, ymdLocal } from "@/lib/schedule";

const dayF = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });
const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function appUrl(): string {
  if (typeof window === "undefined") return "https://begemot-m.github.io/bereg/";
  return window.location.origin + asset("/");
}

/** Ссылка-приглашение на запись: открывает анкету специалиста сразу с окнами. */
export function bookingInviteUrl(): string {
  return `${appUrl()}?psy=${OWN_PROFILE_ID}&book=1`;
}

// Кнопка живёт в «Сессиях», рядом с графиком: позвать клиента — часть работы
// с расписанием, а не отдельный раздел.
export function SessionInviteButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => { tap(); setOpen(true); }}
        className="card-soft mb-4 flex w-full items-center gap-3 p-3.5 text-left transition-transform active:scale-[0.99]"
      >
        <span className="ico ico-white h-11 w-11 shrink-0"><Icon name="telegram" width={21} weight="fill" color="var(--edge)" /></span>
        <span className="min-w-0 flex-1">
          <span className="t-micro block">Свободные окна</span>
          <span className="t-head mt-0.5 block leading-tight">Позвать клиента на сессию</span>
          <span className="t-cap mt-0.5 block">Пришлём ссылку — он выберет время сам</span>
        </span>
        <span className="btn shrink-0 px-3 py-2 text-[12px]">Позвать <ArrowGlyph /></span>
      </button>
      <AnimatePresence>{open && <SessionInviteSheet onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function SessionInviteSheet({ onClose }: { onClose: () => void }) {
  const profile = useProfile();
  const [copied, setCopied] = useState(false);
  const { data: avail } = useQuery({ queryKey: ["month-avail", false], queryFn: () => getMonthAvailability(false) });

  // Ближайший день со свободным окном — с него и начинаем разговор.
  const firstFree = useMemo(() => {
    if (!avail) return null;
    const today = ymdLocal(new Date());
    return Object.keys(avail).filter((d) => d >= today && avail[d] === "free").sort()[0] ?? null;
  }, [avail]);
  const { data: slots = [] } = useQuery({
    queryKey: ["slots", firstFree, false],
    queryFn: () => getSlots(firstFree!, false),
    enabled: Boolean(firstFree),
  });
  const free = slots.filter((s) => !s.taken).slice(0, 4);

  const link = bookingInviteUrl();
  const dayLabel = firstFree ? cap(dayF.format(new Date(firstFree + "T00:00:00"))) : null;
  const times = free.map((s) => timeF.format(new Date(s.start))).join(", ");
  const name = profile?.name?.trim();

  // Текст, который человек прочитает в мессенджере. Без давления и канцелярита.
  const message = [
    name ? `Здравствуйте! Это ${name.split(" ")[0]}.` : "Здравствуйте!",
    dayLabel && times ? `Есть свободные окна: ${dayLabel} — ${times}.` : "У меня открылись свободные окна для записи.",
    "Выбрать удобное время и записаться можно здесь:",
  ].join(" ");
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(`${message} ${link}`); success(); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(32,28,24,.46)] p-3 backdrop-blur-[2px] @md:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 34 }} animate={{ y: 0 }} exit={{ y: 34, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="chunk max-h-[min(92dvh,calc(100dvh-var(--top-pad)))] w-full max-w-md overflow-y-auto p-0"
        style={{ background: "var(--surface)" }}
      >
        <div className="relative p-5" style={{ background: "var(--head)" }}>
          <button onClick={onClose} className="x-close absolute right-4 top-4 h-8 w-8 rounded-full bg-white text-[15px]" aria-label="Закрыть">✕</button>
          <span className="ico ico-white h-12 w-12"><Icon name="calendar" width={24} weight="bold" color="var(--edge)" /></span>
          <h3 className="font-tight mt-3 text-[20px] font-black leading-tight">Позвать клиента на сессию</h3>
          <p className="t-sub mt-1">Ссылка открывает вашу страницу с расписанием — человек выбирает окно и записывается сам.</p>
        </div>

        <div className="space-y-4 p-5">
          {/* Что именно уйдёт в мессенджер */}
          <div>
            <p className="t-micro mb-1.5">Сообщение</p>
            <div className="card-soft p-3.5">
              <p className="t-body">{message}</p>
              <p className="t-cap mt-1.5 truncate" style={{ color: "var(--edge)" }}>{link.replace(/^https?:\/\//, "")}</p>
            </div>
          </div>

          {/* Ближайшие окна — чтобы psychologist видел, что именно предлагает */}
          {firstFree && (
            <div>
              <p className="t-micro mb-1.5">Ближайшие свободные окна</p>
              {free.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {free.map((s) => <span key={s.start} className="chip tnum">{timeF.format(new Date(s.start))}</span>)}
                  <span className="chip" style={{ background: "var(--surface-2)" }}>{dayLabel}</span>
                </div>
              ) : (
                <p className="t-cap">На ближайший день окон нет — откройте их в графике.</p>
              )}
            </div>
          )}

          <a href={shareUrl} target="_blank" rel="noopener noreferrer" onClick={() => success()} className="btn w-full py-3">
            <Icon name="telegram" width={17} weight="fill" color="#fff" /> Отправить в Telegram
          </a>
          <button onClick={copy} className="btn btn-white w-full py-2.5">{copied ? "Ссылка скопирована" : "Скопировать ссылку"}</button>

          <p className="t-cap">Клиент попадёт сразу на запись. После неё приложение предложит добавить вас в «Терапию» — так у него будут видны встречи, задания и прогресс.</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
