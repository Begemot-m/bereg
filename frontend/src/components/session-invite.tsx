"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import { botDeepLink } from "@/lib/brand";
import { OWN_PROFILE_ID } from "@/lib/catalog";
import { success, tap } from "@/lib/haptics";
import { useProfile } from "@/lib/profile";
import { getMonthAvailability, getSlots, ymdLocal } from "@/lib/schedule";

const dayF = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });
const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const MSG_KEY = "bereg_invite_message";

/**
 * Ссылка-приглашение на запись. Ведёт в бота: Telegram открывает мини-приложение
 * и отдаёт метку в start_param — по ней StartRoute сразу показывает анкету с
 * окнами. Обычный https-адрес открылся бы в браузере, мимо приложения.
 */
export function bookingInviteUrl(): string {
  return botDeepLink(`book_${OWN_PROFILE_ID}`);
}

// Кнопка живёт в «Сессиях», рядом с графиком: позвать клиента — часть работы
// с расписанием, а не отдельный раздел.
export function SessionInviteButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => { tap(); setOpen(true); }}
        className="card-soft mt-4 flex w-full items-center gap-3 p-3.5 text-left transition-transform active:scale-[0.99]"
      >
        <span className="ico ico-white h-11 w-11 shrink-0"><Icon name="telegram" width={21} weight="fill" color="var(--edge)" /></span>
        <span className="font-tight min-w-0 flex-1 text-[15px] font-black leading-tight">Направить приглашение на сессию</span>
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
  const suggested = [
    name ? `Здравствуйте! Это ${name.split(" ")[0]}.` : "Здравствуйте!",
    dayLabel && times ? `Ближайшие свободные окна: ${dayLabel} — ${times}.` : "У меня открылись свободные окна для записи.",
    "Выбрать удобное время и записаться можно здесь:",
  ].join(" ");

  // Свой текст приглашения хранится локально: психолог правит его один раз,
  // дальше кнопка отправки берёт сохранённый вариант.
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => { setSaved(localStorage.getItem(MSG_KEY)); }, []);

  const message = saved ?? suggested;
  const text = draft ?? message;
  const dirty = draft !== null && draft.trim() !== message.trim();

  const saveMessage = () => {
    const next = (draft ?? "").trim();
    if (!next) return;
    localStorage.setItem(MSG_KEY, next);
    setSaved(next); setDraft(null); success();
    setJustSaved(true); setTimeout(() => setJustSaved(false), 1600);
  };
  const resetMessage = () => { tap(); localStorage.removeItem(MSG_KEY); setSaved(null); setDraft(null); };

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
          {/* Заголовок стоит справа от иконки и не спорит с ней размером */}
          <div className="flex items-center gap-3 pr-10">
            <span className="ico ico-white h-11 w-11 shrink-0"><Icon name="calendar" width={21} weight="bold" color="var(--edge)" /></span>
            <h3 className="font-tight min-w-0 text-[15px] font-black leading-tight">Позвать клиента на сессию</h3>
          </div>
          <p className="t-sub mt-2.5">По данной ссылке пользователь сможет перейти в ваш профиль и выбрать удобное время. Вы получите уведомление, если он запишется к вам.</p>
        </div>

        <div className="space-y-4 p-5">
          {/* Что именно уйдёт в мессенджер — текст правится прямо здесь */}
          <div>
            <p className="t-micro mb-1.5">Сообщение</p>
            <div className="card-soft p-3">
              <textarea
                value={text}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                className="t-body w-full resize-none bg-transparent outline-none"
                aria-label="Текст приглашения"
              />
              <p className="t-cap mt-1 truncate" style={{ color: "var(--edge)" }}>{link.replace(/^https?:\/\//, "")}</p>
            </div>
            <div className="mt-1.5 flex items-center justify-end gap-1.5">
              {(saved || dirty) && (
                <button onClick={resetMessage} className="btn btn-white px-2.5 py-1 text-[10.5px]">Вернуть текст</button>
              )}
              <button disabled={!dirty} onClick={saveMessage} className="btn px-2.5 py-1 text-[10.5px]">{justSaved ? "Сохранено ✓" : "Сохранить"}</button>
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

          <div className="flex items-center gap-1.5">
            <a href={shareUrl} target="_blank" rel="noopener noreferrer" onClick={() => success()} className="btn flex-1 px-3 py-1.5 text-[11.5px]">
              <Icon name="telegram" width={13} weight="fill" color="#fff" /> Отправить в Telegram
            </a>
            <button onClick={copy} className="btn btn-white shrink-0 px-3 py-1.5 text-[11.5px]">{copied ? "Скопировано ✓" : "Копировать"}</button>
          </div>

          <p className="t-cap">Клиент добавит вас в раздел «Терапия», где вы продолжите совместную работу и станете отслеживать прогресс.</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
