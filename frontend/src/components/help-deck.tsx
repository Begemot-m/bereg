"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui";
import { select, tap } from "@/lib/haptics";

export type HelpPage = { title: string; text: string; illo?: ReactNode; image?: string; imageAlt?: string };

// Мини-мокапы интерфейса для наглядности
const Frame = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-[104px] flex-col justify-center gap-1.5 rounded-[16px] p-3 stroke" style={{ background: "var(--page)" }}>{children}</div>
);
const Row = ({ bg, bd, children, dim }: { bg: string; bd: string; children: ReactNode; dim?: boolean }) => (
  <div className="flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[11px] font-extrabold stroke" style={{ background: bg, borderColor: bd, opacity: dim ? 0.6 : 1 }}>{children}</div>
);
const Pill = ({ bg, bd, children }: { bg: string; bd: string; children: ReactNode }) => (
  <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase stroke" style={{ background: bg, borderColor: bd }}>{children}</span>
);

const YEL = { bg: "var(--slot-morn)", bd: "var(--slot-morn-e)" }; // утро
const AMB = { bg: "var(--slot-day)", bd: "var(--slot-day-e)" };   // день (персик)
const PUR = { bg: "var(--purple)", bd: "var(--purple-edge)" };    // вечер

export const SESSIONS_HELP: HelpPage[] = [
  {
    title: "Три вида расписания",
    text: "«Ближайшие» — только ваши записи, по дням от сегодня. «Неделя» — весь график со свободными окнами. «Календарь» — любой день месяца.",
    illo: (
      <Frame>
        <div className="flex gap-1 rounded-full p-1 stroke" style={{ background: "#fff" }}>
          {["Ближайшие", "Неделя", "Календарь"].map((t, i) => (
            <span key={t} className="flex-1 rounded-full py-1 text-center text-[10px] font-extrabold" style={i === 1 ? { background: "var(--ink)", color: "#fff" } : { color: "var(--muted)" }}>{t}</span>
          ))}
        </div>
      </Frame>
    ),
  },
  {
    title: "Свободные окна — по времени",
    text: "Утренние окна (до 13:00) — жёлтые, дневные — персиковые, вечерние — лавандовые, с иконкой солнца или луны. Тапните «свободное окно», чтобы выбрать клиента и записать.",
    illo: (
      <Frame>
        <Row bg={YEL.bg} bd={YEL.bd}><span className="tnum">10:00</span><span className="flex-1 text-[var(--muted)]">свободное окно</span><span>☀</span></Row>
        <Row bg={PUR.bg} bd={PUR.bd}><span className="tnum">19:00</span><span className="flex-1 text-[var(--muted)]">свободное окно</span><span>🌙</span></Row>
      </Frame>
    ),
  },
  {
    title: "Формат: онлайн / очно",
    text: "У каждого окна — тумблер: онлайн лавандовый, очно зелёный. Формат берётся из вашего шаблона, но его можно поменять на конкретную дату.",
    illo: (
      <Frame>
        <div className="flex justify-center gap-2">
          <Pill bg="var(--purple-soft)" bd="var(--purple-edge)">онлайн ⇄</Pill>
          <Pill bg="var(--green-soft)" bd="var(--green-edge)">очно ⇄</Pill>
        </div>
      </Frame>
    ),
  },
  {
    title: "Закрыть окно на дату",
    text: "Крестик ✕ закрывает окно на эту дату — оно становится «закрыто» и недоступно для записи. Кнопка «↺ Открыть» возвращает его. Шаблон при этом не меняется.",
    illo: (
      <Frame>
        <Row bg={AMB.bg} bd={AMB.bd}><span className="tnum">16:00</span><span className="flex-1 text-[var(--muted)]">свободное окно</span><span style={{ color: "var(--salmon-edge)" }}>✕</span></Row>
        <Row bg="#f7f3ea" bd="var(--edge-neutral)" dim><span className="tnum line-through text-[var(--muted-2)]">16:00</span><span className="flex-1 text-[var(--muted-2)]">закрыто</span><span style={{ color: "var(--green-edge)" }}>↺ Открыть</span></Row>
      </Frame>
    ),
  },
  {
    title: "Занятые окна и шестерёнка",
    text: "Записанная сессия — белая карточка с именем клиента. Шестерёнка открывает действия «Перенести» и «Отменить».",
    illo: (
      <Frame>
        <div className="rounded-[10px] p-2 stroke" style={{ background: "#fff" }}>
          <div className="flex items-center gap-2 text-[11px] font-extrabold"><span className="h-4 w-1 rounded-full" style={{ background: AMB.bg }} /><span className="tnum">14:00</span><span className="flex-1">Марина</span><span className="flex h-7 w-7 items-center justify-center rounded-[8px] text-white" style={{ background: "var(--ink)" }}>⚙</span></div>
        </div>
      </Frame>
    ),
  },
  {
    title: "Меню дня и несколько дней",
    text: "Шестерёнка «Действия» над днём: сделать выходным, открыть все окна, перевести весь день в онлайн или очно. В «Календаре» можно «Выбрать несколько» дней и применить действия сразу ко всем.",
    illo: (
      <Frame>
        <div className="ml-auto w-44 rounded-[12px] p-1 stroke" style={{ background: "#fff" }}>
          {["⚙ Действия", "🌙 Сделать выходным", "↺ Открыть все окна"].map((t, i) => (
            <div key={t} className="rounded-[8px] px-2 py-1 text-[10px] font-bold" style={i === 0 ? { background: "var(--head-soft)" } : undefined}>{t}</div>
          ))}
        </div>
      </Frame>
    ),
  },
];

export const SCHEDULE_HELP: HelpPage[] = [
  {
    title: "Интервал работы",
    text: "Задайте границы дня — «с» и «до». Внутри этого интервала вы ставите окна приёма.",
    illo: (
      <Frame>
        <div className="flex items-center justify-center gap-2 text-[11px] font-extrabold">
          <span className="text-[var(--muted)]">Работаю</span>
          <span className="rounded-full px-2 py-0.5 stroke" style={{ background: "#fff" }}>− 09:00 +</span>
          <span className="rounded-full px-2 py-0.5 stroke" style={{ background: "#fff" }}>− 21:00 +</span>
        </div>
      </Frame>
    ),
  },
  {
    title: "Длина сессии",
    text: "Ползунком выбираете длительность. Она задаёт размер новых окон и наследуется — следующий блок ставится с тем же форматом, что и предыдущий. Уже поставленные окна не меняются.",
    illo: (
      <Frame>
        <div className="relative h-8">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full stroke" style={{ background: "var(--head-soft)" }} />
          <div className="absolute left-[38%] top-1/2 flex h-7 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: "var(--ink)" }}>50м</div>
        </div>
      </Frame>
    ),
  },
  {
    title: "Поставить окно",
    text: "Тапните по времени на графике дня — появится блок. Он магнитом прилипает к ровному часу. Утренние окна жёлтые, дневные персиковые, вечерние лавандовые, с иконкой солнца или луны.",
    illo: (
      <Frame>
        <div className="relative h-16 rounded-[10px] stroke" style={{ background: "#fff" }}>
          <div className="absolute inset-x-0 top-1/2 border-t" style={{ borderColor: "var(--edge-neutral)" }} />
          <div className="absolute left-2 right-2 top-1.5 flex items-center justify-between rounded-[8px] px-2 py-1 text-[11px] font-extrabold stroke" style={{ background: YEL.bg, borderColor: YEL.bd }}><span>10:00</span><span>☀</span></div>
          <div className="absolute inset-x-2 bottom-1.5 flex items-center justify-between rounded-[8px] px-2 py-1 text-[11px] font-extrabold stroke" style={{ background: PUR.bg, borderColor: PUR.bd }}><span>19:00</span><span>🌙</span></div>
        </div>
      </Frame>
    ),
  },
  {
    title: "Формат и удаление",
    text: "Слева на блоке — тумблер формата (онлайн лавандовый / очно зелёный). Справа персиковый крестик ✕ удаляет окно.",
    illo: (
      <Frame>
        <div className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 stroke" style={{ background: AMB.bg, borderColor: AMB.bd }}>
          <Pill bg="var(--purple-soft)" bd="var(--purple-edge)">онлайн ⇄</Pill>
          <span className="flex-1 text-center text-[11px] font-extrabold">11:00–11:50</span>
          <span>☀</span>
          <span className="text-[13px] font-black" style={{ color: "var(--salmon-edge)" }}>✕</span>
        </div>
      </Frame>
    ),
  },
  {
    title: "Двигать и копировать",
    text: "Перетаскиванием блока меняете время. «На будни» повторит день на Пн–Пт, «На все дни» — на неделю. Потом можно поправить каждый день. «Сохранить» — и клиенты записываются в эти окна.",
    illo: (
      <Frame>
        <div className="flex gap-2">
          <span className="flex-1 rounded-full py-1.5 text-center text-[11px] font-extrabold stroke" style={{ background: "#fff" }}>На будни</span>
          <span className="flex-1 rounded-full py-1.5 text-center text-[11px] font-extrabold text-white" style={{ background: "var(--ink)" }}>Сохранить</span>
        </div>
      </Frame>
    ),
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
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full stroke text-[15px] font-bold" style={{ background: "#fff" }}>✕</button>
          </div>

          <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
            <div className="mb-3">
              {p.image ? <img src={p.image} alt={p.imageAlt ?? ""} className="aspect-[16/10] w-full rounded-[16px] object-cover stroke" /> : p.illo}
            </div>
            <h4 className="text-[15px] font-extrabold">{p.title}</h4>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">{p.text}</p>
          </motion.div>

          {/* Точки */}
          <div className="mt-4 flex justify-center gap-1.5">
            {pages.map((_, k) => (
              <span key={k} className="h-2 rounded-full transition-all" style={{ width: k === i ? 18 : 8, background: k === i ? "var(--ink)" : "var(--edge-neutral)" }} />
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            {i > 0 && <Button variant="soft" size="sm" onClick={() => { tap(); setI(i - 1); }}>Назад</Button>}
            <Button className="flex-1" onClick={() => { last ? (onDone ? onDone() : onClose()) : (select(), setI(i + 1)); }}>{last ? doneLabel : "Далее"}</Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
