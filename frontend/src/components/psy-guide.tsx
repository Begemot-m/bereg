"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { GuideShot } from "@/components/guide-shots";
import { Icon, type IconName } from "@/components/icons";
import { LandingScreen } from "@/components/landing-screens";
import { select, success, tap } from "@/lib/haptics";

const EASE = [0.16, 1, 0.3, 1] as const;
const KEY = "bereg_guide_done";

type Step = {
  /** Кадр реального интерфейса. Если его нет — рисованный экран раздела. */
  shot?: string;
  tab?: string;
  accent: string;
  title: string;
  /** Строка «Перейдите в раздел …» — с иконкой самого раздела. */
  go?: { label: string; icon: IconName };
  lines: { icon: IconName; text: string }[];
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
    ],
  },
  {
    shot: "cabinet-verify",
    accent: "var(--amber)",
    title: "Пройдите верификацию",
    go: { label: "Кабинет", icon: "user" },
    lines: [
      { icon: "seal", text: "Отправьте анкету на верификацию, после чего она будет опубликована в каталог" },
      { icon: "note", text: "Ключевое требование: профильное высшее образование или профессиональная переподготовка" },
      { icon: "users", text: "Без верификации профиль будут видеть только ваши клиенты" },
    ],
  },
  {
    shot: "sessions-schedule",
    accent: "var(--green)",
    title: "Настройте график",
    go: { label: "Сессии", icon: "calendar" },
    lines: [
      { icon: "gear", text: "Настройте свой график рабочих часов" },
      { icon: "compass", text: "Чтобы клиенты могли записываться к вам напрямую через каталог или раздел «Терапия»" },
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

            <div className="mt-3 min-h-[188px] px-1 @md:min-h-[160px]">
              <span className="t-micro">Шаг {index + 1} из {STEPS.length}</span>
              <p className="font-tight mt-0.5 text-[16px] font-black leading-tight">{step.title}</p>

              {/* Куда идти — отдельной плашкой с иконкой раздела: раньше это
                  тонуло первой строкой абзаца. */}
              {step.go && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5">
                  <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>Перейдите в раздел</span>
                  <Icon name={step.go.icon} width={14} weight="bold" color="var(--purple-edge)" />
                  <span className="text-[11.5px] font-black" style={{ color: "var(--purple-edge)" }}>{step.go.label}</span>
                </span>
              )}

              <ul className="mt-2 space-y-1.5">
                {step.lines.map((line) => (
                  <li key={line.text} className="flex gap-2">
                    <span className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] bg-white">
                      <Icon name={line.icon} width={11} weight="bold" color="var(--purple-edge)" />
                    </span>
                    <span className="min-w-0 flex-1 text-[12.5px] font-semibold leading-[1.35]">{line.text}</span>
                  </li>
                ))}
              </ul>
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
