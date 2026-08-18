"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ArrowGlyph } from "@/components/blocks";
import { GuideShot } from "@/components/guide-shots";
import { Icon, type IconName } from "@/components/icons";
import { LandingScreen } from "@/components/landing-screens";
import { select, success, tap } from "@/lib/haptics";

const EASE = [0.16, 1, 0.3, 1] as const;
const KEY = "bereg_guide_done";

type Mode = "full" | "mini" | "hidden";

type Step = {
  /** Кадр реального интерфейса. Если его нет — рисованный экран раздела. */
  shot?: string;
  tab?: string;
  accent: string;
  title: string;
  /** Строка «Перейдите в раздел …» — с иконкой самого раздела. */
  go?: { label: string; icon: IconName; tone?: string };
  lines: { icon: IconName; text: string; strong?: boolean }[];
};

// Шесть шагов знакомства. Тексты владельца — дословно, слово в слово; здесь
// они только разложены по строкам с иконками, чтобы человек не упирался в
// сплошной абзац и не листал дальше.
const STEPS: Step[] = [
  {
    shot: "cabinet-profile",
    accent: "var(--purple)",
    title: "Заполните профиль",
    go: { label: "Кабинет", icon: "user" },
    lines: [
      { icon: "user", text: "Сперва заполните анкету специалиста с информацией о себе" },
      { icon: "edit", text: "Нажмите на кнопку «Заполнить профиль»" },
      { icon: "steps", text: "Следуйте по шагам и заполните все разделы информацией о себе. Это займёт немного времени." },
    ],
  },
  {
    shot: "cabinet-verify",
    accent: "var(--amber)",
    title: "Пройдите верификацию",
    go: { label: "Кабинет", icon: "user" },
    lines: [
      { icon: "seal", text: "Отправьте анкету на верификацию, после чего она будет опубликована в каталог" },
      { icon: "warn", text: "Ключевое требование: профильное высшее образование или профессиональная переподготовка", strong: true },
      { icon: "users", text: "Без верификации профиль будут видеть только ваши клиенты" },
    ],
  },
  {
    shot: "sessions-schedule",
    accent: "var(--green)",
    title: "Настройте график",
    go: { label: "Сессии", icon: "calendar", tone: "var(--green-edge)" },
    lines: [
      { icon: "gear", text: "Настройте свой график рабочих часов, чтобы клиенты могли записываться к вам напрямую через каталог или раздел «Терапия»" },
    ],
  },
  {
    shot: "clients-plus",
    accent: "var(--purple)",
    title: "Заведите первых клиентов",
    go: { label: "Клиенты", icon: "users" },
    lines: [
      { icon: "users", text: "Заведите первых клиентов в разделе «Клиенты»" },
      { icon: "plus", text: "Добавить можно вручную нажав на плюсик или по ссылке-приглашению" },
      { icon: "telegram", text: "Рекомендуем направлять ссылку, после чего клиент автоматически добавляется в список после авторизации, а вы автоматически закрепляетесь у клиента как специалист" },
      { icon: "mood", text: "Кроме того, вы сможете видеть отметки, которые ведёт клиент" },
    ],
  },
  {
    shot: "client-card",
    accent: "var(--tiffany)",
    title: "Бесплатно — и 14 дней PRO",
    lines: [
      { icon: "check", text: "Платформа позволяет бесплатно размещать анкету, а также вести 3 клиентов" },
      { icon: "spark", text: "С момента верификации анкеты вы получите бесплатно 14 дней подписки и сможете внести больше клиентов" },
    ],
  },
  {
    tab: "tools",
    accent: "var(--tiffany)",
    title: "Дальше — больше",
    lines: [
      { icon: "tools", text: "Платформа будет обновляться новыми инструментами в помощь вам и клиентам" },
      { icon: "question", text: "На каждой странице раздела есть сверху кнопка «Как это работает?» — нажмите её, чтобы гид показал все функции" },
      { icon: "heart", text: "Пользуйтесь с удовольствием!" },
    ],
  },
];

/**
 * Знакомство с платформой на главной специалиста. Пришло на место таблицы
 * первых шагов: чек-лист говорил, что нажать, но не объяснял, как платформа
 * устроена, и новичок уходил с главной. Здесь рисованные экраны разделов и
 * шесть шагов словами — от анкеты до подписки.
 *
 * Пока человек не дошёл до конца, блок висит развёрнутым и закрыть его нечем:
 * по данным судить нельзя — заведённый клиент не значит, что специалист знает
 * про верификацию и лимиты. Прошёл до «Всё понятно» — остаётся миниатюра, и
 * только у неё есть крестик, да и тот спрашивает.
 */
export function PsyGuide() {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [mode, setMode] = useState<Mode>("hidden");
  const [askClose, setAskClose] = useState(false);
  const swipeX = useRef<number | null>(null);
  const reduce = useReducedMotion();

  // Флаг читается после монтирования: на сервере localStorage нет, а разметка
  // должна совпасть с первой отрисовкой в браузере.
  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    setMode(saved === "hidden" ? "hidden" : saved ? "mini" : "full");
  }, []);

  const last = index === STEPS.length - 1;
  const step = STEPS[index];

  const go = (next: number) => {
    if (next < 0 || next >= STEPS.length) return;
    select();
    setDir(next > index ? 1 : -1);
    setIndex(next);
  };
  const finish = () => { success(); localStorage.setItem(KEY, "mini"); setMode("mini"); };
  const hide = () => { tap(); localStorage.setItem(KEY, "hidden"); setAskClose(false); setMode("hidden"); };
  // Развернуть можно сколько угодно раз, но отметка «пройдено» остаётся: после
  // перезагрузки человек видит миниатюру, а не полный блок с первого шага.
  const expand = () => { tap(); setIndex(0); setMode("full"); };
  // Стрелка в шапке сворачивает гид в строку — тот же жест, что у раскрытых
  // блоков в остальном приложении. Знакомство при этом никуда не девается.
  const collapse = () => { tap(); localStorage.setItem(KEY, "mini"); setMode("mini"); };
  const endSwipe = (x: number) => {
    const start = swipeX.current;
    swipeX.current = null;
    if (start == null) return;
    const delta = x - start;
    if (Math.abs(delta) < 48) return;
    go(delta < 0 ? index + 1 : index - 1);
  };

  if (mode === "hidden") return null;

  // Свёрнутое знакомство: «Всё понятно» не убирает блок насовсем, а оставляет
  // строку — вернуться к шагам можно в любой момент.
  if (mode === "mini") {
    return (
      <section>
        <div
          role="button"
          tabIndex={0}
          onClick={expand}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); expand(); } }}
          className="chunk flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-transform active:scale-[.99]"
          style={{ background: "var(--purple-soft)", borderColor: "var(--purple)" }}
        >
          <span className="ico h-9 w-9 shrink-0 rounded-[12px]" style={{ background: "var(--purple-edge)" }}>
            <Icon name="question" width={17} weight="bold" color="#fff" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-black leading-tight">С чего начать?</span>
            <span className="t-cap block">Наглядное знакомство с платформой</span>
          </span>
          {/* Крестик появляется только здесь, у пройденного знакомства, и стоит
              слева от кнопки: убрать строку совсем — отдельное решение. */}
          <span className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              aria-label="Убрать знакомство"
              onClick={(event) => { event.stopPropagation(); tap(); setAskClose(true); }}
              className="x-close h-6 w-6 rounded-full bg-white text-[12px]"
            >
              ✕
            </button>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black" style={{ color: "var(--purple-edge)" }}>Открыть</span>
          </span>
        </div>
        <CloseAsk open={askClose} onCancel={() => { tap(); setAskClose(false); }} onConfirm={hide} />
      </section>
    );
  }

  return (
    <section>
      <div className="chunk overflow-hidden" style={{ background: "var(--purple-soft)", borderColor: "var(--purple)" }}>
        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            {!reduce && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-[15px]"
                style={{ background: "var(--purple)" }}
                animate={{ scale: [1, 1.28, 1], opacity: [0.55, 0, 0.55] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeOut" }}
              />
            )}
            <motion.span
              className="ico relative h-12 w-12 rounded-[15px]"
              style={{ background: "var(--purple-edge)" }}
              animate={reduce ? undefined : { rotate: [0, -10, 9, -4, 0], y: [0, -3, 0, -2, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }}
            >
              <Icon name="question" width={24} weight="bold" color="#fff" />
            </motion.span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-tight block text-[19px] font-black leading-tight">С чего начать?</span>
            <span className="t-sub mt-0.5 block">Познакомьтесь с функциями платформы</span>
          </span>
          <button
            type="button"
            onClick={collapse}
            aria-label="Свернуть знакомство"
            className="arrow shrink-0 self-start"
            style={{ background: "var(--purple-edge)" }}
          >
            <ArrowGlyph size={14} style={{ transform: "rotate(-90deg)" }} />
          </button>
        </div>

        <div
          className="px-3 pb-3 touch-pan-y"
          onPointerDown={(event) => { swipeX.current = event.clientX; }}
          onPointerUp={(event) => endSwipe(event.clientX)}
          onPointerCancel={() => { swipeX.current = null; }}
        >
          <motion.div
            key={index}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {/* Кадр интерфейса показывает ровно тот блок, на который просят
                нажать. Обрезан снизу и уведён в фон: полный экран на карточку
                главной не влезет, а так это читается как окно в приложение. */}
            <div className="relative h-[236px] overflow-hidden rounded-[16px] @md:h-[290px] @md:rounded-[24px]">
              {step.shot ? <GuideShot name={step.shot} /> : <LandingScreen tab={step.tab ?? "tools"} accent={step.accent} compact />}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
                style={{ background: "linear-gradient(to bottom, transparent, var(--bg))" }}
              />
            </div>

            <div className="mt-3 min-h-[188px] px-1 pb-4 @md:min-h-[160px]">
              <span className="t-micro">Шаг {index + 1} из {STEPS.length}</span>
              <p className="font-tight mt-0.5 text-[16px] font-black leading-tight">{step.title}</p>

              {/* Куда идти — отдельной плашкой с иконкой раздела: раньше это
                  тонуло первой строкой абзаца. */}
              {step.go && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5">
                  <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>Перейдите в раздел</span>
                  <Icon name={step.go.icon} width={14} weight="bold" color={step.go.tone ?? "var(--purple-edge)"} />
                  <span className="text-[11.5px] font-black" style={{ color: step.go.tone ?? "var(--purple-edge)" }}>{step.go.label}</span>
                </span>
              )}

              <ul className="mt-2.5 space-y-2">
                {step.lines.map((line) => (
                  <li key={line.text} className="flex gap-2">
                    <span className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] bg-white">
                      <Icon name={line.icon} width={11} weight="bold" color={line.strong ? "var(--salmon-edge)" : "var(--purple-edge)"} />
                    </span>
                    <span className={`min-w-0 flex-1 text-[12.5px] leading-[1.35] `}>{line.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          <div className="mt-1 flex gap-1.5 px-1">
            {STEPS.map((_, k) => (
              <button
                key={k}
                type="button"
                aria-label={`Шаг ${k + 1}`}
                onClick={() => go(k)}
                className="h-1.5 flex-1 rounded-full transition-colors duration-300"
                style={{ background: k <= index ? "var(--purple-edge)" : "rgba(32,28,24,.16)" }}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => { tap(); go(index - 1); }}
              disabled={index === 0}
              className="btn flex-1 py-2.5"
              style={{ background: "transparent", color: "var(--purple-edge)", borderColor: "var(--purple-edge)" }}
            >
              Назад
            </button>
            <button
              type="button"
              onClick={() => { if (last) finish(); else { tap(); go(index + 1); } }}
              className="btn flex-1 py-2.5"
              style={{ background: "var(--purple-edge)", color: "#fff", borderColor: "var(--purple-edge)" }}
            >
              {last ? "Всё понятно" : "Далее"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Вопрос перед тем, как убрать знакомство совсем. */
function CloseAsk({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => void }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(32,28,24,.42)", backdropFilter: "blur(2px)" }}
        >
          <motion.div
            initial={{ y: 18, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 18, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="chunk w-full max-w-sm p-5 text-center"
            style={{ background: "var(--surface)" }}
          >
            <span className="ico mx-auto h-12 w-12 rounded-[15px]" style={{ background: "var(--purple)" }}>
              <Icon name="question" width={22} weight="bold" color="var(--purple-edge)" />
            </span>
            <p className="font-tight mt-3 text-[17px] font-black leading-tight">Вы уверены, что этот гид вам больше не понадобится?</p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="btn flex-1 py-2.5"
                style={{ background: "transparent", color: "var(--purple-edge)", borderColor: "var(--purple-edge)" }}
              >
                Нет
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="btn flex-1 py-2.5"
                style={{ background: "var(--purple-edge)", color: "#fff", borderColor: "var(--purple-edge)" }}
              >
                Да
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
