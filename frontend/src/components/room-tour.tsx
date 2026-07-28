"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Icon, type IconName } from "@/components/icons";
import { select, success, tap } from "@/lib/haptics";
import type { Role } from "@/lib/role";

const EASE = [0.16, 1, 0.3, 1] as const;
const KEY = (role: Role) => `bereg:tour:${role}:v3`;

const PAD = 8;      // воздух вокруг подсвеченного элемента
const CARD = 210;   // примерная высота карточки — решаем, сверху её класть или снизу

export function tourSeen(role: Role): boolean {
  if (typeof window === "undefined") return true; // SSR: не мигаем туром
  return localStorage.getItem(KEY(role)) === "1";
}

export function completeTour(role: Role) {
  localStorage.setItem(KEY(role), "1");
  window.dispatchEvent(new CustomEvent("bereg:tour-change"));
}

/** Запустить обучение вручную (из баннера на главной или кабинета). */
export function startTour() {
  window.dispatchEvent(new CustomEvent("bereg:tour-start"));
}

/** Сбросить туры всех ролей — вместе со сбросом знакомства. */
export function resetTours() {
  for (const role of ["psychologist", "client", "guest"] as Role[]) localStorage.removeItem(KEY(role));
  window.dispatchEvent(new CustomEvent("bereg:tour-change"));
}

type Step = {
  href: string;
  /** Элемент, который подсвечиваем. Если не найден — карточка просто по центру. */
  target?: string;
  icon: IconName;
  title: string;
  text: string;
};

const TOURS: Record<Role, Step[]> = {
  client: [
    { href: "/", target: '[data-tour="mood"]', icon: "mood", title: "Отмечайте, как вы сегодня", text: "Тап по карточке открывает диск настроения и эмоции. Полминуты в день — и видно настоящий фон недели, а не только «хорошо / плохо»." },
    { href: "/", target: '[data-tour="nav-catalog"]', icon: "compass", title: "Здесь ищут своего специалиста", text: "Подборка собирается по вашему запросу, а не по оплате размещения. Можно ответить на пару вопросов или сразу открыть весь список." },
    { href: "/therapy", target: '[data-tour="mood-stats"]', icon: "chart", title: "Динамика — общий язык с терапевтом", text: "Здесь настроение складывается в график. Терапевт видит эту динамику и приходит на встречу, уже зная, как прошли ваши недели." },
    { href: "/therapy", target: '[data-tour="board"]', icon: "note", title: "Доска, которую видит терапевт", text: "Записывайте сюда мысли и вопросы между встречами — на сессии не придётся вспоминать, с чего вы хотели начать." },
  ],
  psychologist: [
    { href: "/sessions", target: '[data-tour="schedule"]', icon: "clock", title: "Сначала — рабочие часы", text: "«График» задаёт дни, окна и длительность встречи. Отсюда же напоминания и запрет отмены. Клиенты видят только свободные окна." },
    { href: "/sessions", target: '[data-tour="views"]', icon: "calendar", title: "Неделя — рабочий экран", text: "«Ближайшие» показывают только записи, «Неделя» — все окна. Тап по свободному окну записывает клиента в два движения." },
    { href: "/sessions", target: '[data-tour="quick-add"]', icon: "plus", title: "Запись на любую дату", text: "Плюс открывает быструю запись: выбрать клиента (или завести нового) и свободное окно, не листая неделю." },
    { href: "/clients", target: '[data-tour="client-card"]', icon: "users", title: "Карточка клиента", text: "Видно объём работы, задания и настроение между встречами. Тап открывает историю встреч, домашки и колесо баланса." },
    { href: "/clients", target: '[data-tour="add-client"]', icon: "heart", title: "Новый клиент — и приглашение", text: "Заводите карточку и сразу отправляйте приглашение в Telegram: когда клиент подключится, его отметки появятся у вас." },
  ],
  guest: [
    { href: "/catalog", target: '[data-tour="nav-catalog"]', icon: "compass", title: "Каталог специалистов", text: "Посмотрите анкеты без обязательств: фото, подход, с чем работает и с чем — нет." },
    { href: "/tools", target: '[data-tour="nav-tools"]', icon: "tools", title: "Практики без записи", text: "Дыхание, разбор мыслей и дневники доступны сразу — специалист для них не нужен." },
    { href: "/cabinet", target: '[data-tour="nav-cabinet"]', icon: "user", title: "Роль меняется здесь", text: "Когда решите, как пользуетесь приложением, переключите роль в кабинете — разделы подстроятся." },
  ],
};

/**
 * Экскурсия при первом заходе в роли: переводит в нужный раздел, подсвечивает
 * конкретный элемент и объясняет его. Интерфейс перекрыт, пока шаги не пройдены.
 */
export function RoomTour({ role, onDone }: { role: Role; onDone: () => void }) {
  const steps = TOURS[role] ?? [];
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const step = steps[index];

  const measure = useCallback(() => {
    if (!step?.target) { setRect(null); return; }
    const el = document.querySelector(step.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  // Переводим в нужный раздел.
  useEffect(() => {
    if (step && pathname !== step.href) router.push(step.href);
  }, [step, pathname, router]);

  // Ждём появления элемента (после навигации он рисуется не сразу),
  // подкручиваем к нему и запоминаем положение.
  useEffect(() => {
    if (!step) return;
    setRect(null);
    if (!step.target || pathname !== step.href) return;
    let tries = 0;
    let timer = 0;
    const hunt = () => {
      const el = document.querySelector(step.target!);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        timer = window.setTimeout(measure, 420);
        return;
      }
      if (tries++ < 40) timer = window.setTimeout(hunt, 100);
    };
    hunt();
    return () => window.clearTimeout(timer);
  }, [step, pathname, measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  if (!step) return null;
  const last = index === steps.length - 1;

  const next = () => {
    if (last) { success(); completeTour(role); onDone(); return; }
    select();
    setIndex(index + 1);
  };

  // Карточку кладём с той стороны от подсветки, где больше места.
  const below = rect ? rect.bottom + CARD < window.innerHeight - 24 : false;
  const cardStyle: React.CSSProperties = rect
    ? below
      ? { top: rect.bottom + PAD + 12 }
      : { bottom: Math.max(16, window.innerHeight - rect.top + PAD + 12) }
    : { bottom: 24 };

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Экскурсия по разделам">
      {/* Прожектор: дыра в затемнении вокруг элемента. Без подсветки — сплошная вуаль. */}
      {rect ? (
        <motion.div
          layout
          className="pointer-events-none absolute rounded-[11px]"
          initial={false}
          animate={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
          transition={{ duration: 0.34, ease: EASE }}
          style={{ boxShadow: "0 0 0 9999px rgba(32,28,24,.62)", outline: "2px solid rgba(255,255,255,.9)", outlineOffset: 2 }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "rgba(32,28,24,.62)" }} />
      )}

      {/* Ловим нажатия, чтобы приложением нельзя было пользоваться по ходу тура */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      <div className="pointer-events-none absolute inset-x-0 px-3" style={cardStyle}>
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: below ? -14 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="pointer-events-auto mx-auto w-full max-w-md rounded-[14px] bg-white p-4"
            style={{ boxShadow: "0 24px 48px -20px rgba(32,28,24,.55)" }}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px]" style={{ background: "var(--head-soft)" }}>
                <Icon name={step.icon} width={19} weight="bold" color="var(--edge)" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="t-micro">Экскурсия · {index + 1} из {steps.length}</p>
                <p className="t-head mt-0.5">{step.title}</p>
              </div>
            </div>

            <p className="t-sub mt-2.5">{step.text}</p>

            <div className="mt-3 flex gap-1.5">
              {steps.map((s, i) => (
                <span key={s.title} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ background: i <= index ? "var(--ink)" : "var(--surface-2)" }} />
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              {index > 0 && (
                <button onClick={() => { tap(); setIndex(index - 1); }} className="rounded-full px-4 py-2.5 text-[13px] font-black text-[var(--muted)]">Назад</button>
              )}
              <button
                onClick={next}
                className="flex-1 rounded-full py-2.5 text-[13.5px] font-black text-white transition-transform active:scale-[0.98]"
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
