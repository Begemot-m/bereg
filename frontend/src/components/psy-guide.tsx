"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { LandingScreen } from "@/components/landing-screens";
import { select, success, tap } from "@/lib/haptics";

const EASE = [0.16, 1, 0.3, 1] as const;
const KEY = "bereg_guide_done";

type Step = { tab: string; accent: string; text: string };

// Шесть шагов знакомства. Тексты владельца, менять их на ходу нельзя: это
// обещания платформы, а не подписи к картинкам.
const STEPS: Step[] = [
  {
    tab: "profile",
    accent: "var(--purple)",
    text: "Сперва заполните анкету специалиста с информацией о себе",
  },
  {
    tab: "catalog",
    accent: "var(--amber)",
    text: "Отправьте анкету на верификацию, после чего она будет опубликована в каталог. Ключевое требование: профильное высшее образование или профессиональная переподготовка. Без верификации профиль будут видеть только ваши клиенты",
  },
  {
    tab: "sessions",
    accent: "var(--green)",
    text: "Настройте свой график рабочих часов, чтобы клиенты могли записываться к вам напрямую через каталог или раздел «Терапия»",
  },
  {
    tab: "clients",
    accent: "var(--purple)",
    text: "Заведите первых клиентов в разделе «Клиенты». Добавить можно вручную нажав на плюсик или по ссылке-приглашению. Рекомендуем направлять ссылку, после чего клиент автоматически добавляется в список после авторизации, а вы автоматически закрепляетесь у клиента как специалист. Кроме того, вы сможете видеть отметки, которые ведёт клиент",
  },
  {
    tab: "profile",
    accent: "var(--tiffany)",
    text: "Платформа позволяет бесплатно размещать анкету, а также вести 3 клиентов. С момента верификации анкеты вы получите бесплатно 14 дней подписки и сможете внести больше клиентов",
  },
  {
    tab: "tools",
    accent: "var(--tiffany)",
    text: "Платформа будет обновляться новыми инструментами в помощь вам и клиентам. Пользуйтесь с удовольствием!",
  },
];

/**
 * Знакомство с платформой на главной специалиста. Пришло на место таблицы
 * первых шагов: чек-лист говорил, что нажать, но не объяснял, как платформа
 * устроена, и новичок уходил с главной. Здесь рисованные экраны разделов и
 * шесть шагов словами — от анкеты до подписки.
 *
 * Блок убирает сам человек — крестиком или кнопкой на последнем шаге. По
 * данным его прятать нельзя: заведённый клиент не значит, что специалист
 * знает про верификацию и лимиты.
 */
export function PsyGuide() {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [hidden, setHidden] = useState(true);
  const swipeX = useRef<number | null>(null);
  const reduce = useReducedMotion();

  // Флаг читается после монтирования: на сервере localStorage нет, а разметка
  // должна совпасть с первой отрисовкой в браузере.
  useEffect(() => setHidden(localStorage.getItem(KEY) === "1"), []);

  const last = index === STEPS.length - 1;
  const step = STEPS[index];

  const go = (next: number) => {
    if (next < 0 || next >= STEPS.length) return;
    select();
    setDir(next > index ? 1 : -1);
    setIndex(next);
  };
  const dismiss = (finished: boolean) => {
    if (finished) success(); else tap();
    localStorage.setItem(KEY, "1");
    setHidden(true);
  };
  const endSwipe = (x: number) => {
    const start = swipeX.current;
    swipeX.current = null;
    if (start == null) return;
    const delta = x - start;
    if (Math.abs(delta) < 48) return;
    go(delta < 0 ? index + 1 : index - 1);
  };

  if (hidden) return null;

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
            onClick={() => dismiss(false)}
            aria-label="Скрыть знакомство"
            className="x-close h-8 w-8 rounded-full bg-white text-[15px]"
          >
            ✕
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
            {/* Кадр раздела обрезан снизу и уведён в фон: это окно в приложение,
                а не его точная копия — иначе на карточку главной не влезет. */}
            <div className="relative h-[236px] overflow-hidden rounded-[16px] @md:h-[290px] @md:rounded-[24px]">
              <LandingScreen tab={step.tab} accent={step.accent} compact />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
                style={{ background: "linear-gradient(to bottom, transparent, var(--bg))" }}
              />
            </div>

            <div className="mt-3 min-h-[136px] px-1 @md:min-h-[104px]">
              <span className="t-micro">Шаг {index + 1} из {STEPS.length}</span>
              <p className="t-body mt-1.5 leading-[1.4]">{step.text}</p>
            </div>
          </motion.div>

          <div className="flex gap-1.5 px-1">
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
              onClick={() => { if (last) dismiss(true); else { tap(); go(index + 1); } }}
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
