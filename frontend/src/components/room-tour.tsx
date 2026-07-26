"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon, type IconName } from "@/components/icons";
import { select, success, tap } from "@/lib/haptics";
import type { Role } from "@/lib/role";

const EASE = [0.16, 1, 0.3, 1] as const;
const KEY = (role: Role) => `bereg:tour:${role}:v2`;

export function tourSeen(role: Role): boolean {
  if (typeof window === "undefined") return true; // SSR: не мигаем туром
  return localStorage.getItem(KEY(role)) === "1";
}

export function completeTour(role: Role) {
  localStorage.setItem(KEY(role), "1");
  window.dispatchEvent(new CustomEvent("bereg:tour-change"));
}

/** Сбросить туры всех ролей — используется вместе со сбросом знакомства. */
export function resetTours() {
  for (const role of ["psychologist", "client", "guest"] as Role[]) localStorage.removeItem(KEY(role));
  window.dispatchEvent(new CustomEvent("bereg:tour-change"));
}

type Step = { href: string; icon: IconName; title: string; text: string };

const TOURS: Record<Role, Step[]> = {
  psychologist: [
    { href: "/", icon: "home", title: "Главная — что требует внимания", text: "Здесь ближайшая сессия и короткий список того, что стоит подтянуть: кто остался без записи, насколько занята неделя." },
    { href: "/sessions", icon: "calendar", title: "Сессии — график и записи", text: "«График» задаёт рабочие часы и правила приёма. Тап по свободному окну записывает клиента, календарь показывает месяц целиком." },
    { href: "/clients", icon: "users", title: "Клиенты — карточки и прогресс", text: "В карточке видно объём работы, задания и настроение между встречами. Нового клиента можно сразу пригласить в Telegram." },
    { href: "/tools", icon: "tools", title: "Инструменты — материалы для практики", text: "Готовые техники и раздатки, которые можно дать клиенту как домашнее задание." },
    { href: "/cabinet", icon: "user", title: "Кабинет — профиль и подписка", text: "Анкета для каталога, приглашения коллег и подписка. Заполненный профиль участвует в подборе клиентов." },
  ],
  client: [
    { href: "/", icon: "home", title: "Главная — ваш день", text: "Ближайшая встреча, настроение и короткие шаги на сегодня. Отсюда быстро попасть в любой раздел." },
    { href: "/therapy", icon: "therapy", title: "Терапия — то, что между сессиями", text: "Настроение и его динамика, задания от терапевта и доска, куда можно записать всё, что важно не забыть сказать на встрече." },
    { href: "/catalog", icon: "compass", title: "Каталог — найти своего", text: "Подборка собирается по вашему запросу, а не по оплате размещения. Можно смотреть и весь список." },
    { href: "/tools", icon: "tools", title: "Инструменты — помощь в моменте", text: "Дыхание, разбор мыслей и короткие практики. Работают сами по себе, специалист для них не нужен." },
    { href: "/cabinet", icon: "user", title: "Кабинет — профиль и данные", text: "Здесь настройки, приглашения друзьям и полный сброс данных: всё живёт только на вашем устройстве." },
  ],
  guest: [
    { href: "/catalog", icon: "compass", title: "Каталог — с чего начать", text: "Посмотрите специалистов без обязательств. Подборка настраивается парой вопросов." },
    { href: "/tools", icon: "tools", title: "Инструменты — попробовать сейчас", text: "Практики и дневники доступны сразу, без записи к специалисту." },
    { href: "/cabinet", icon: "user", title: "Кабинет — выбрать роль позже", text: "Когда решите, кем пользуетесь приложением, роль меняется здесь в один тап." },
  ],
};

/**
 * Экскурсия по разделам при первом заходе в роли. Ведёт по экранам и
 * перекрывает интерфейс, пока шаги не пройдены.
 */
export function RoomTour({ role, onDone }: { role: Role; onDone: () => void }) {
  const steps = TOURS[role] ?? [];
  const [index, setIndex] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const step = steps[index];

  // Ведём пользователя по разделам: каждый шаг открывает свой экран.
  useEffect(() => {
    if (!step) return;
    if (pathname !== step.href) router.push(step.href);
  }, [index, step, pathname, router]);

  if (!step) return null;
  const last = index === steps.length - 1;

  const next = () => {
    if (last) { success(); completeTour(role); onDone(); return; }
    select();
    setIndex(index + 1);
  };

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Экскурсия по разделам">
      {/* Затемнение ловит все нажатия — пока тур идёт, приложением не пользуются */}
      <div className="absolute inset-0" style={{ background: "rgba(32,28,24,.55)" }} />

      <div className="absolute inset-x-0 bottom-0 px-3 pb-[calc(var(--safe-bottom)+14px)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="mx-auto w-full max-w-md rounded-[26px] bg-white p-5"
            style={{ boxShadow: "0 24px 48px -20px rgba(32,28,24,.5)" }}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ background: "var(--head-soft)" }}>
                <Icon name={step.icon} width={21} weight="bold" color="var(--edge)" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="t-micro">Экскурсия · {index + 1} из {steps.length}</p>
                <p className="t-title mt-0.5">{step.title}</p>
              </div>
            </div>

            <p className="t-body mt-3" style={{ color: "var(--muted)" }}>{step.text}</p>

            <div className="mt-4 flex gap-1.5">
              {steps.map((s, i) => (
                <span key={s.href} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ background: i <= index ? "var(--ink)" : "var(--surface-2)" }} />
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              {index > 0 && (
                <button onClick={() => { tap(); setIndex(index - 1); }} className="rounded-full px-4 py-3 text-[13px] font-black text-[var(--muted)]">
                  Назад
                </button>
              )}
              <button
                onClick={next}
                className="flex-1 rounded-full py-3 text-[14px] font-black text-white transition-transform active:scale-[0.98]"
                style={{ background: "var(--ink)" }}
              >
                {last ? "Всё понятно, начать" : "Дальше"}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
