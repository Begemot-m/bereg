"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";

import { Icon, type IconName } from "@/components/icons";
import { WindowsPoster, posterPng, sharePoster } from "@/components/invite-poster";
import { InviteShare } from "@/components/invite-share";
import { profileCompletionPercent } from "@/components/profile-editor";
import { bookingInviteUrl } from "@/components/session-invite";
import { asset } from "@/lib/asset";
import { APP_NAME } from "@/lib/brand";
import { OWN_PROFILE_ID, profileToCatalogPsy } from "@/lib/catalog";
import { DEMO } from "@/lib/demo";
import { success, select, tap } from "@/lib/haptics";
import { inviteShareLink } from "@/lib/invite";
import { inviteMessage, prepareInviteMessage, useFreeWindows, windowsInviteUrl, type Span } from "@/lib/invite-windows";
import { useMe } from "@/lib/me";
import { formatMoney } from "@/lib/money";
import { useProfile } from "@/lib/profile";
import { getWorkHours } from "@/lib/schedule";
import { shareTelegramMessage } from "@/lib/telegram";

const CARD_TEXT = `Моя визитка в «${APP_NAME}»: тут обо мне, о работе и запись на встречу`;

type View = "home" | "schedule" | "poster";

/**
 * Мини-блок «Позовите клиентов ссылкой» — открывает окно, а не уводит на
 * отдельный экран: приглашение отправляют между делом, и ради двух кнопок
 * терять место в приложении незачем.
 */
export function ClientInviteBanner() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => { tap(); setOpen(true); }}
        className="card-soft relative block w-full overflow-hidden p-5 text-left transition-transform active:scale-[0.99]"
        style={{ background: "var(--tiffany-soft)" }}
      >
        <div className="relative flex items-center gap-3.5">
          <span className="ico ico-white h-14 w-14 shrink-0"><Icon name="telegram" width={26} weight="fill" color="var(--tiffany-edge)" /></span>
          <div className="min-w-0 flex-1">
            <p className="t-micro">Свои клиенты</p>
            <p className="t-title mt-0.5">Позовите клиентов ссылкой</p>
            <p className="t-cap mt-1">Приглашение с расписанием или афиша картинкой — клиент запишется сам</p>
          </div>
        </div>
        <span className="btn relative mt-3.5 w-full keep-style" style={{ background: "var(--tiffany-edge)", border: "var(--bw) solid var(--tiffany-edge)" }}>
          <Icon name="share" width={15} weight="fill" color="#fff" /> Собрать приглашение
        </span>
      </button>
      <AnimatePresence>{open && <ClientInviteSheet onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

/**
 * Окно приглашения. Сверху — миниатюра анкеты: специалист видит ровно то, что
 * увидит клиент. Ниже два пути: готовый текст со свободными окнами или та же
 * афиша картинкой для сторис.
 */
export function ClientInviteSheet({ onClose, start = "home" }: { onClose: () => void; start?: View }) {
  const { data: me } = useMe();
  const profile = useProfile();
  const { data: work } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours, enabled: Boolean(profile) });
  const [view, setView] = useState<View>(start);
  const [span, setSpan] = useState<Span>("week");
  const [saving, setSaving] = useState(false);
  // Готовая афиша живёт прямо в окне: её видно, её можно отправить ещё раз или
  // сохранить долгим нажатием — в Telegram это единственный надёжный путь.
  const [shot, setShot] = useState<{ url: string; note: string } | null>(null);
  const [sending, setSending] = useState(false);

  const windowsFor = DEMO ? OWN_PROFILE_ID : me?.id ?? null;
  const { days } = useFreeWindows(windowsFor, span);
  const psy = profile ? profileToCatalogPsy(profile, work) : null;
  const filled = profileCompletionPercent(profile) > 0;

  const windowsLink = windowsInviteUrl(me?.id);
  const cardLink = bookingInviteUrl(me?.id);
  const message = inviteMessage(psy?.name ?? "", days, span);

  const posterName = () => `raspisanie-${span === "week" ? "blizhayshie" : "sled-nedelya"}.jpg`;

  /**
   * Собрать картинку. Отправку отсюда не запускаем: системный лист «Поделиться»
   * требует свежего нажатия, а к концу отрисовки оно уже «протухло» — из-за
   * этого кнопка и выглядела сломанной. Сначала показываем готовую афишу,
   * отправляет её отдельная кнопка под ней.
   */
  const makePoster = async () => {
    if (!psy) return;
    tap();
    setSaving(true);
    try {
      const url = await posterPng(psy, days, span, windowsLink, "image/jpeg");
      setShot(url
        ? { url, note: "Готово. Отправьте картинку кнопкой ниже или сохраните долгим нажатием." }
        : { url: "", note: "Картинку собрать не вышло — отправьте приглашение текстом." });
      if (url) success();
    } catch {
      setShot({ url: "", note: "Картинку собрать не вышло — отправьте приглашение текстом." });
    } finally {
      setSaving(false);
    }
  };

  const sendPoster = async () => {
    if (!shot?.url) return;
    tap();
    const how = await sharePoster(shot.url, posterName());
    setShot({
      url: shot.url,
      note: how === "shared" ? "Картинка ушла в выбранный чат."
        : how === "saved" ? "Картинка сохранена в загрузки."
        : "Нажмите на картинку и удерживайте, чтобы сохранить или переслать.",
    });
  };

  // Картинка собрана заново под другой охват — старую показывать нельзя.
  const pickSpan = (value: Span) => { setSpan(value); setShot(null); };

  /**
   * Отправка приглашения. Сначала пробуем сообщение с настоящей кнопкой:
   * получателю остаётся один тап, а не «найди ссылку в тексте и нажми». Если
   * клиент старый или роут недоступен (демо), открываем обычный лист Telegram
   * со ссылкой — как раньше.
   */
  const send = async () => {
    tap();
    setSending(true);
    try {
      const prepared = await prepareInviteMessage(message, windowsLink);
      if (prepared?.id && (await shareTelegramMessage(prepared.id))) { success(); return; }
    } catch {
      /* нет prepared-сообщений — уходим ссылкой */
    } finally {
      setSending(false);
    }
    window.open(inviteShareLink(windowsLink, message), "_blank", "noopener");
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-[100] flex items-end justify-center overscroll-contain bg-[rgba(32,28,24,.46)] p-3 md:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[min(88dvh,calc(100dvh-var(--top-pad)-24px))] w-full max-w-md overflow-y-auto overflow-x-hidden rounded-[var(--r-block)] p-0"
        style={{ background: "var(--surface)" }}
      >
        <div className="relative overflow-hidden p-5" style={{ background: "var(--tiffany-soft)" }}>
          <button onClick={onClose} className="x-close absolute right-4 top-4 h-8 w-8 rounded-full bg-white text-[15px]" aria-label="Закрыть">✕</button>
          {view === "home" ? (
            <>
              <p className="t-micro relative">Ваша анкета</p>
              <h3 className="font-tight relative mt-0.5 pr-10 text-[20px] font-black leading-tight">Соберите ссылку на свою анкету</h3>
              <p className="t-sub relative mt-1.5">
                Клиент откроет её в Telegram, увидит, с чем вы работаете, и запишется сам. Заводить карточку и просить
                телефон не нужно — она появится в «Клиентах» после первой записи.
              </p>
            </>
          ) : (
            <>
              <button onClick={() => { tap(); setView("home"); }} className="t-cap relative font-black" style={{ color: "var(--tiffany-edge)" }}>← Назад</button>
              <h3 className="font-tight relative mt-1 pr-10 text-[19px] font-black leading-tight">
                {view === "schedule" ? "Пригласить клиента на запись" : "Расписание картинкой"}
              </h3>
              <p className="t-sub relative mt-1.5">
                {view === "schedule"
                  ? "Направьте ссылку, чтобы пользователь записался на платформе."
                  : "Вертикальная афиша 1080×1920: под сторис и пересылку в чат."}
              </p>
            </>
          )}
        </div>

        <div className="space-y-3.5 p-5">
          {view === "home" && (
            <>
              <CardPreview psy={psy} />
              <InviteShare link={cardLink} text={CARD_TEXT} />

              {!filled && (
                <div className="card p-3.5">
                  <p className="t-head">Анкета пока пустая</p>
                  <p className="t-sub mt-1">В приглашении клиент увидит только имя. Заполните анкету — появятся метод, опыт и цена.</p>
                  <Link href="/cabinet/profile" onClick={() => { tap(); onClose(); }} className="btn mt-3 w-full">Заполнить анкету</Link>
                </div>
              )}

              <div className="space-y-2">
                <Choice
                  icon="calendar"
                  title="Отправить приглашение с расписанием"
                  sub="Готовый текст со свободными окнами и ссылкой"
                  onClick={() => { tap(); setView("schedule"); }}
                />
                <Choice
                  icon="image"
                  title="Сформировать расписание картинкой"
                  sub="Афиша для сторис — ссылка внутри остаётся живой"
                  onClick={() => { tap(); setView("poster"); }}
                />
              </div>
            </>
          )}

          {view === "schedule" && (
            <>
              <SpanSwitch span={span} onSpan={pickSpan} />
              <div className="card p-3.5">
                <p className="t-sub whitespace-pre-line leading-relaxed" style={{ color: "var(--ink)" }}>{message}</p>
                <p className="t-cap mt-2 break-all" style={{ color: "var(--tiffany-edge)" }}>{windowsLink}</p>
              </div>
              <button onClick={() => void send()} disabled={sending} className="btn w-full py-3 text-[14px] disabled:opacity-50">
                <Icon name="telegram" width={16} weight="fill" color="#fff" /> {sending ? "Готовим…" : "Отправить приглашение"}
              </button>
              <button onClick={() => void makePoster()} disabled={!psy || saving} className="btn btn-white w-full py-2.5 disabled:opacity-50">
                <Icon name="image" width={15} weight="bold" color="var(--tiffany-edge)" /> {saving ? "Рисуем…" : shot ? "Собрать заново" : "Расписание картинкой"}
              </button>
              <p className="t-cap">
                {days.length
                  ? span === "next"
                    ? "Следующая неделя целиком, с понедельника. Окна берутся из графика в момент отправки."
                    : "Отсчёт идёт с сегодняшнего дня, семь дней вперёд. Окна берутся из графика в момент отправки."
                  : "Свободных окон в графике пока нет — клиент откроет ссылку и увидит время, как только оно появится."}
              </p>
            </>
          )}

          {view === "poster" && (
            <>
              {psy ? <WindowsPoster psy={psy} days={days} span={span} onSpan={setSpan} /> : <div className="card p-4"><p className="t-sub">Заполните имя в анкете, чтобы собрать афишу</p></div>}
              <button onClick={() => void makePoster()} disabled={!psy || saving} className="btn w-full py-3 text-[14px] disabled:opacity-50">
                <Icon name="image" width={16} weight="bold" color="#fff" /> {saving ? "Рисуем…" : "Собрать картинку"}
              </button>
              <InviteShare link={windowsLink} text={inviteMessage(psy?.name ?? "", days, span)} />
            </>
          )}
        </div>
      </motion.div>

      {/* Готовая афиша — отдельным окном поверх: внутри списка она занимала
          весь экран, и свободные окна переставали помещаться в блок. */}
      <AnimatePresence>
        {shot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={(e) => { e.stopPropagation(); setShot(null); }}
            className="fixed inset-0 z-[110] flex items-center justify-center overscroll-contain bg-[rgba(32,28,24,.62)] p-4"
          >
            <motion.div
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 18, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[86dvh] w-full max-w-sm overflow-y-auto rounded-[var(--r-block)] p-4"
              style={{ background: "var(--surface)" }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="t-head">Расписание картинкой</p>
                <button onClick={() => { tap(); setShot(null); }} className="x-close h-8 w-8 rounded-full bg-white text-[15px]" aria-label="Закрыть">✕</button>
              </div>
              <PosterShot url={shot.url} note={shot.note} onSend={() => void sendPoster()} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}

/**
 * Готовая афиша на экране. Показываем её саму, а не сообщение «сохранено»:
 * в Telegram картинку забирают долгим нажатием, и человек должен её видеть.
 */
function PosterShot({ url, note, onSend }: { url: string; note: string; onSend: () => void }) {
  if (!url) return <div className="card p-3.5"><p className="t-cap text-center">{note}</p></div>;
  return (
    <div className="card overflow-hidden p-2">
      <img src={url} alt="Расписание свободных окон" className="w-full rounded-[13px]" />
      <button onClick={onSend} className="btn btn-accent mt-2 w-full py-2.5">
        <Icon name="telegram" width={15} weight="fill" color="#fff" /> Отправить картинку
      </button>
      {note && <p className="t-cap mt-2 px-1 text-center">{note}</p>}
    </div>
  );
}

function Choice({ icon, title, sub, onClick }: { icon: IconName; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card flex w-full items-center gap-3 p-3.5 text-left transition-transform active:scale-[0.99]">
      <span className="ico ico-white h-11 w-11 shrink-0" style={{ background: "var(--tiffany-edge)" }}><Icon name={icon} width={20} weight="fill" color="#fff" /></span>
      <span className="min-w-0 flex-1">
        <span className="t-head block leading-tight">{title}</span>
        <span className="t-cap mt-0.5 block">{sub}</span>
      </span>
      <span className="t-cap shrink-0" style={{ color: "var(--edge)" }}>›</span>
    </button>
  );
}

function SpanSwitch({ span, onSpan }: { span: Span; onSpan: (span: Span) => void }) {
  return (
    <div className="flex gap-1.5">
      {(["week", "next"] as Span[]).map((value) => (
        <button
          key={value}
          onClick={() => { select(); onSpan(value); }}
          className={`flex-1 rounded-full py-2 text-[12px] font-black ${span === value ? "text-white" : ""}`}
          style={span === value ? { background: "var(--tiffany-edge)" } : { background: "var(--head-soft)", color: "var(--tiffany-edge)" }}
        >
          {value === "week" ? "Ближайшие дни" : "Следующая неделя"}
        </button>
      ))}
    </div>
  );
}

/** Миниатюра анкеты — то, что клиент увидит первым экраном. */
function CardPreview({ psy }: { psy: ReturnType<typeof profileToCatalogPsy> | null }) {
  if (!psy) return <div className="card p-4"><p className="t-sub">Анкета соберётся, как только заполните профиль</p></div>;
  const portrait = psy.portrait ? asset(psy.portrait) : "";
  return (
    <div className="card overflow-hidden p-3">
      <div className="flex gap-3">
        {portrait ? (
          <div className="relative h-[96px] w-[86px] shrink-0 overflow-hidden rounded-[14px]">
            <Image src={portrait} alt={`Портрет: ${psy.name}`} fill sizes="86px" className="object-cover" unoptimized={/^(data:|blob:)/i.test(portrait)} />
          </div>
        ) : (
          <span className="ico h-[86px] w-[86px] shrink-0 rounded-[14px]"><Icon name="user" width={34} weight="fill" /></span>
        )}
        <div className="min-w-0 flex-1">
          <p className="t-head flex items-center gap-1.5"><span className="truncate">{psy.name || "Ваше имя"}</span>{psy.verified && <Icon name="seal" width={15} weight="fill" color="var(--green)" className="shrink-0" />}</p>
          <p className="mt-0.5 text-[11px] font-black" style={{ color: "var(--edge)" }}>{psy.specialistTypes?.length ? psy.specialistTypes.join(" · ") : "Психолог"}</p>
          <p className="t-cap mt-0.5 truncate">{[psy.method, psy.years ? `${psy.years} лет практики` : ""].filter(Boolean).join(" · ")}</p>
          {psy.price > 0 && <p className="t-cap mt-1 font-black" style={{ color: "var(--ink)" }}>{formatMoney(psy.price, psy.currency ?? "RUB")} / {psy.minutes} мин</p>}
        </div>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        <span className="chip">В мою терапию</span>
        <span className="chip">Записаться</span>
      </div>
    </div>
  );
}
