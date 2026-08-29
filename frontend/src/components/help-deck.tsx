"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";

import { GuideShot } from "@/components/guide-shots";
import { Icon, type IconName } from "@/components/icons";
import { Button } from "@/components/ui";
import { asset } from "@/lib/asset";
import { select, tap } from "@/lib/haptics";

export type HelpPage = {
  title: string;
  text: string;
  illo?: ReactNode;
  image?: string;
  imageAlt?: string;
  /** Строка «Перейдите в раздел …» с иконкой самого раздела. */
  go?: { label: string; icon: IconName };
};

// Кадр реального интерфейса вместо снимка: не устаревает при смене стилей и
// читается на телефоне.
function Shot({ name }: { name: string }) {
  return <div className="aspect-[16/10] w-full overflow-hidden rounded-[14px] stroke"><GuideShot name={name} /></div>;
}

export const SESSIONS_HELP: HelpPage[] = [
  {
    title: "Сначала составьте график",
    text: "Кнопка «График» слева задаёт рабочие дни, часы приёма и длительность сессии. Пока график пуст, записывать некуда: клиент видит только те окна, которые вы открыли.",
    image: asset("/help/s1-schedule.webp"),
    imageAlt: "Кнопки «График», плюс и «Календарь» над списком дней",
  },
  {
    title: "Два взгляда на расписание",
    text: "«Ближайшие» — дни, где уже есть записи, с окнами и действиями. «Неделя» — весь график целиком. Кнопка «Календарь» справа открывает любой день месяца.",
    image: asset("/help/s2-views.webp"),
    imageAlt: "Переключатель «Ближайшие» и «Неделя» над днём с записями",
  },
  {
    title: "Записать клиента",
    text: "Тап по свободному окну раскрывает его, «Выбрать клиента» открывает список — там же заводится новый. Зелёный плюс по центру делает то же самое для любой даты. Свободные окна белые в рамке, занятые — с заливкой: пустое от занятого видно сразу.",
    image: asset("/help/s5-book.webp"),
    imageAlt: "Раскрытое свободное окно с кнопкой «Выбрать клиента»",
  },
  {
    title: "Перенести, написать, освободить",
    text: "Тап по записи разворачивает её на всю ширину: «Перенести» — выбор нового окна, «Написать» — чат с клиентом в Telegram, «Освободить» снимает встречу, а окно остаётся свободным. Формат меняется переключателем справа от имени.",
    image: asset("/help/s4-appt.webp"),
    imageAlt: "Раскрытая запись клиента с кнопками «Перенести», «Написать», «Освободить»",
  },
  {
    title: "Выходной и закрытые окна",
    text: "В раскрытом свободном окне внизу справа есть «Удалить окно» — оно уходит с этой даты, а шаблон недели не меняется. «↺ Открыть окна» возвращает его. Кнопка «Действия» над днями делает выходной целиком и переводит все окна в онлайн или очно.",
    image: asset("/help/s6-window.webp"),
    imageAlt: "Ссылка «Удалить окно» в раскрытом свободном окне",
  },
  {
    title: "Отпуск — сразу на много дней",
    text: "Откройте «Календарь», нажмите «Выбор» и отметьте нужные дни. Действия применятся ко всем разом: сделать выходными, вернуть окна, перевести неделю в онлайн. Записи при этом не трогаются — их переносят вручную.",
    image: asset("/help/s7-vacation.webp"),
    imageAlt: "Календарь с несколькими выбранными днями и меню массовых действий",
  },
];

export const SCHEDULE_HELP: HelpPage[] = [
  {
    title: "Интервал работы",
    text: "Задайте границы дня — «с» и «до». Внутри этого интервала вы ставите окна приёма.",
    image: asset("/help/w1-hours.webp"),
    imageAlt: "Строка «Работаю с 09:00 до 21:00» в редакторе графика",
  },
  {
    title: "Длина сессии",
    text: "Ползунком выбираете длительность. Она задаёт размер новых окон и наследуется — следующий блок ставится с тем же форматом, что и предыдущий. Уже поставленные окна не меняются.",
    image: asset("/help/w2-length.webp"),
    imageAlt: "Ползунок длины сессии на отметке 50 минут",
  },
  {
    title: "Поставить окно",
    text: "Тапните по времени на графике — появится блок, который можно перемещать. Можно установить формат встречи: очно или онлайн, а также удалить блок с помощью крестика.",
    image: asset("/help/w3-rail.webp"),
    imageAlt: "График дня с окнами приёма на шкале времени",
  },
  {
    title: "Двигать и копировать",
    text: "Вы можете выбрать день вручную, либо скопировать заданный график на будние и выходные дни. «Очистить» удаляет все блоки.",
    image: asset("/help/w5-copy.webp"),
    imageAlt: "Действия «На будни», «На выходные» и «Очистить» под днями недели",
  },
  {
    title: "Правила приёма",
    text: "После формирования графика вы можете установить правила встреч. «Запрет отмены» — за сколько дней встречу уже не отменить. «За сколько дней возможно записаться на встречу» — насколько заранее клиент обязан забронировать окно. «Выкл» — ограничения нет. После заполнения нажмите кнопку «Сохранить расписание».",
    image: asset("/help/w6-rules.webp"),
    imageAlt: "Правила приёма: запрет отмены и предварительная запись",
  },
];

/**
 * Полное знакомство с разделом: сначала настройка графика, потом сама работа с
 * расписанием. Первый шаг «Как работают сессии» («сначала составьте график») из
 * хвоста выкинут — про график только что рассказали пять экранов подряд.
 */
export const SESSIONS_FULL_HELP: HelpPage[] = [...SCHEDULE_HELP, ...SESSIONS_HELP.slice(1)];

/** Как завести клиентов. Открывается кнопкой в шапке и при первом заходе. */
export const CLIENTS_HELP: HelpPage[] = [
  {
    title: "Имя в поле — карточка готова",
    text: "Напишите имя в верхнем поле: оно ищет по списку и заводит нового клиента. Ник Telegram через «собаку» подтянет имя и фото. Кнопка рядом откроет выбор из контактов — сразу до десяти человек. Приглашение подключить свой профиль отправляется позже, из самой карточки: тогда настроение, задания и записи станут общими.",
    illo: <Shot name="clients-plus" />,
  },
  {
    title: "Профиль клиента и его данные",
    text: "После того как клиент авторизуется, вы сможете видеть его профиль и данные о его настроении, а также статистику совместной работы.",
    illo: <Shot name="client-card" />,
  },
  {
    title: "Всё зашифровано",
    text: "Все данные хранятся в зашифрованном виде, и карточку клиента будете видеть только вы. Мы стараемся сохранить конфиденциальность и безопасность наших пользователей. Авторизация через Telegram лишь позволяет синхронизировать данные и вести статистику терапии, что является ключевой целью платформы.",
    illo: <Shot name="privacy" />,
  },
  {
    title: "Побудьте на месте клиента",
    go: { label: "Кабинет", icon: "user" },
    text: "Здесь можно переключить свой профиль на пользовательский, чтобы вживую посмотреть отметку настроения, колесо баланса и другие инструменты. Кроме того, вы можете работать со своим специалистом в качестве клиента.",
    illo: <Shot name="cabinet-role" />,
  },
  {
    title: "Связь не прерывается",
    text: "Мы хотим сохранить связь между специалистом и клиентом, чтобы процесс терапии был непрерывным и наглядно показывал прогресс. За счёт ежедневного посещения платформы клиенты вероятнее захотят вернуться к вам.",
    illo: <Shot name="continuity" />,
  },
];

export function HelpDeck({ title, pages, onClose, onDone, doneLabel = "Понятно" }: { title: string; pages: HelpPage[]; onClose: () => void; onDone?: () => void; doneLabel?: string }) {
  const [i, setI] = useState(0);
  const p = pages[i];
  const last = i === pages.length - 1;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[60] flex items-end justify-center p-3 @md:items-center" style={{ background: "rgba(32,28,24,.42)", backdropFilter: "blur(2px)" }}>
        <motion.div initial={{ y: 30, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 32 }} onClick={(e) => e.stopPropagation()} className="chunk w-full max-w-md p-5" style={{ background: "var(--surface)" }}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-tight text-[18px] font-extrabold">{title}</h3>
            <button onClick={onClose} className="x-close h-8 w-8 rounded-full stroke text-[15px]" style={{ background: "#fff" }}>✕</button>
          </div>

          <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
            <div className="mb-3">
              {p.image ? <img src={p.image} alt={p.imageAlt ?? ""} loading="lazy" decoding="async" className="aspect-[16/10] w-full rounded-[14px] object-cover stroke" /> : p.illo}
            </div>
            <h4 className="text-[15px] font-extrabold">{p.title}</h4>
            {p.go && (
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5" style={{ background: "var(--surface-2)" }}>
                <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>Перейдите в раздел</span>
                <Icon name={p.go.icon} width={13} weight="bold" color="var(--edge)" />
                <span className="text-[11.5px] font-black" style={{ color: "var(--edge)" }}>{p.go.label}</span>
              </span>
            )}
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">{p.text}</p>
          </motion.div>

          {/* Точки */}
          <div className="mt-4 flex justify-center gap-1.5">
            {pages.map((_, k) => (
              <span key={k} className="h-2 rounded-full transition-all" style={{ width: k === i ? 18 : 8, background: k === i ? "var(--ink)" : "var(--edge-neutral)" }} />
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            {i > 0 && <button className="back-link" onClick={() => { tap(); setI(i - 1); }}>Назад</button>}
            <Button className="flex-1" onClick={() => { last ? (onDone ? onDone() : onClose()) : (select(), setI(i + 1)); }}>{last ? doneLabel : "Далее"}</Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
