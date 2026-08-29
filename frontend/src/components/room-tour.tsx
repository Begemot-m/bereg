"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon, type IconName } from "@/components/icons";
import { select, success, tap } from "@/lib/haptics";
import type { Role } from "@/lib/role";

const EASE = [0.16, 1, 0.3, 1] as const;
const KEY = (role: Role) => `bereg:tour:${role}:v5`;

const VEIL = { duration: 0.22, ease: EASE } as const;

const PAD = 8;          // воздух вокруг подсвеченного элемента
const GAP = 12;         // зазор между подсветкой и карточкой
const CARD = 210;       // высота карточки до первого замера
const SAFE_TOP = 72;    // под шапкой раздела элемент формально «на экране», а по факту скрыт
const SAFE_BOTTOM = 104; // то же самое за нижними табами

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
    { href: "/", target: '[data-tour="next-session"]', icon: "calendar", title: "Ближайшая встреча — всегда сверху", text: "Верхний блок главной показывает следующую сессию: дату, формат и управление записью. Пока специалист не выбран, тот же блок ведёт в каталог." },
    { href: "/", target: '[data-tour="mood"]', icon: "mood", title: "Отмечайте, как вы сегодня", text: "Тап открывает диск настроения и эмоции. Полминуты в день — и вместо «вроде нормально» появляется честная картина недели." },
    { href: "/", target: '[data-tour="nav-catalog"]', icon: "compass", title: "Каталог: здесь ищут своего", text: "Подборка собирается по вашему запросу, а не по оплате размещения. В анкете видно подход, цену и свободные окна — записаться можно сразу оттуда." },
    { href: "/therapy", target: '[data-tour="therapist"]', icon: "therapy", title: "«Терапия» — всё о вашей работе", text: "Наверху — ваш специалист: ближайшая встреча, история и запись на новое окно. Специалистов может быть несколько, они переключаются здесь же." },
    { href: "/therapy", target: '[data-tour="mood-stats"]', icon: "chart", title: "Ежедневные отметки складываются в график", text: "Динамика видна и вам, и терапевту: он приходит на встречу, уже зная, как прошли ваши недели, — не нужно пересказывать месяц по памяти." },
    { href: "/therapy", target: '[data-tour="work"]', icon: "note", title: "Задания между встречами", text: "То, о чём договорились на сессии. Отмечайте выполненное — специалист видит прогресс и не тратит начало встречи на опрос." },
    { href: "/therapy", target: '[data-tour="board"]', icon: "note", title: "Доска, которую видит терапевт", text: "Записывайте мысли и вопросы, пока они свежие. На сессии не придётся вспоминать, с чего вы хотели начать." },
    { href: "/therapy", target: '[data-tour="wheel"]', icon: "balance", title: "Колесо баланса — общая картина", text: "Короткие вопросы о важных сферах жизни. Результат сохраняется, и через пару месяцев видно, что реально сдвинулось." },
    { href: "/tools", target: '[data-tour="nav-tools"]', icon: "tools", title: "Практики всегда под рукой", text: "Дыхание и дневник мыслей открываются в любой момент. Черновики сохраняются — упражнение не обязательно заканчивать за один раз." },
    { href: "/cabinet", target: '[data-tour="nav-cabinet"]', icon: "user", title: "Кабинет: профиль и напоминания", text: "Имя, фото, роль, напоминания о сессиях и настройки приватности. Отсюда же экскурсию можно запустить заново." },
  ],
  psychologist: [
    { href: "/sessions", target: '[data-tour="schedule"]', icon: "clock", title: "Начните с рабочих часов", text: "«График» задаёт дни, часы и длительность встречи, а заодно напоминания и запрет отмены. Клиент видит только те окна, которые вы открыли." },
    { href: "/sessions", target: '[data-tour="views"]', icon: "calendar", title: "Неделя — ваш рабочий экран", text: "«Ближайшие» — дни с записями, «Неделя» — весь график разом. Тап по свободному окну записывает клиента, тап по записи открывает перенос, чат и отмену." },
    { href: "/sessions", target: '[data-tour="calendar"]', icon: "calendar", title: "Календарь на месяц", text: "Занятые дни, выходные и отпуск видно сразу. Отсюда же переход на нужную дату — не листая неделю за неделей." },
    { href: "/sessions", target: '[data-tour="quick-add"]', icon: "plus", title: "Записать вручную", text: "Плюс открывает быструю запись: выбрать клиента (или завести нового) и свободное окно на любую дату." },
    { href: "/cabinet", target: '[data-tour="profile-progress"]', icon: "user", title: "Анкета — ваше лицо в каталоге", text: "Полоса заполненности ведёт в редактор: методы, запросы, образование, формат и цена. Своих клиентов вы ведёте сразу, а в каталог анкета попадает после верификации." },
    { href: "/cabinet", target: '[data-tour="role-switch"]', icon: "user", title: "Побудьте на месте клиента", text: "Тумблер роли переключает приложение в клиентский режим: те же экраны, что видят ваши люди, — настроение, задания, запись. Вернуться в кабинет специалиста можно в любой момент, данные никуда не денутся." },
    { href: "/clients", target: '[data-tour="add-client"]', icon: "heart", title: "Заведите клиента", text: "Напишите имя в этом поле — карточка появится сразу. Ник Telegram подтянет имя и фото, а кнопка рядом откроет выбор из контактов. Приглашение отправляется позже, из карточки: тогда настроение, задания и записи начнут приходить сами." },
    { href: "/clients", target: '[data-tour="client-card"]', icon: "users", title: "Карточка — вся история работы", text: "Внутри: встречи, домашние задания, заметки после сессий, настроение между встречами и колесо баланса. Открывайте перед встречей вместо попыток вспомнить." },
    { href: "/tools", target: '[data-tour="nav-tools"]', icon: "tools", title: "Материалы для сессий", text: "Практики и упражнения, которые можно выдать клиенту как домашнее задание или пройти самому, чтобы понимать каждый шаг." },
  ],
  guest: [
    { href: "/catalog", target: '[data-tour="nav-catalog"]', icon: "compass", title: "Каталог специалистов", text: "Посмотрите анкеты без обязательств: фото, подход, с чем работает и с чем — нет." },
    { href: "/tools", target: '[data-tour="nav-tools"]', icon: "tools", title: "Практики без записи", text: "Дыхание, разбор мыслей и дневники доступны сразу — специалист для них не нужен." },
    { href: "/cabinet", target: '[data-tour="nav-cabinet"]', icon: "user", title: "Роль меняется здесь", text: "Когда решите, как пользуетесь приложением, переключите роль в кабинете — разделы подстроятся." },
    { href: "/", target: '[data-tour="mood"]', icon: "mood", title: "Отмечайте состояние", text: "Ежедневная отметка занимает меньше минуты и помогает видеть динамику, а не вспоминать неделю по последнему дню." },
    { href: "/", target: '[data-tour="nav-catalog"]', icon: "compass", title: "Можно начинать", text: "Откройте каталог, настройте фильтры и посмотрите несколько анкет. Выбор ни к чему не обязывает." },
  ],
};

// Один и тот же якорь живёт и в сайдбаре, и в нижних табах: берём тот,
// который сейчас на экране, иначе прожектор уедет в скрытую разметку.
function findTarget(selector: string): Element | null {
  for (const el of Array.from(document.querySelectorAll(selector))) {
    const box = el.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return el;
  }
  return null;
}

/**
 * Экскурсия при первом заходе в роли: переводит в нужный раздел, подсвечивает
 * конкретный элемент и объясняет его. Интерфейс перекрыт, пока шаги не пройдены.
 */
export function RoomTour({ role, onDone }: { role: Role; onDone: () => void }) {
  const steps = TOURS[role] ?? [];
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardH, setCardH] = useState(CARD);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const step = steps[index];

  // Переводим в нужный раздел.
  useEffect(() => {
    if (step && pathname !== step.href) router.push(step.href);
  }, [step, pathname, router]);

  // Ждём появления элемента (после навигации он рисуется не сразу) и дальше
  // какое-то время не отпускаем: экран догружает данные и проигрывает анимации
  // входа, поэтому единственный замер оставлял подсветку там, где блок был в
  // первый кадр, а не там, где он остановился.
  useEffect(() => {
    if (!step) return;
    if (!step.target || pathname !== step.href) { setRect(null); return; }
    let tries = 0;
    let timer = 0;
    let frame = 0;
    let until = 0;
    let last = "";
    const track = () => {
      const el = findTarget(step.target!);
      if (el) {
        const box = el.getBoundingClientRect();
        const key = `${box.top}|${box.left}|${box.width}|${box.height}`;
        if (key !== last) { last = key; setRect(box); }
      }
      frame = performance.now() < until ? requestAnimationFrame(track) : 0;
    };
    const follow = (ms: number) => {
      until = performance.now() + ms;
      if (!frame) frame = requestAnimationFrame(track);
    };
    const hunt = () => {
      const el = findTarget(step.target!);
      if (!el) {
        if (tries++ < 40) timer = window.setTimeout(hunt, 60);
        return;
      }
      const box = el.getBoundingClientRect();
      if (box.top < SAFE_TOP || box.bottom > window.innerHeight - SAFE_BOTTOM) el.scrollIntoView({ block: "center", behavior: "auto" });
      follow(3000);
    };
    const nudge = () => follow(500);
    hunt();
    window.addEventListener("resize", nudge);
    window.addEventListener("scroll", nudge, true);
    return () => {
      window.clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", nudge);
      window.removeEventListener("scroll", nudge, true);
    };
  }, [step, pathname]);

  // Реальная высота карточки: по прикидке в 210 px длинные шаги не помещались
  // снизу и кнопки уезжали за край экрана.
  useEffect(() => {
    const el = cardRef.current;
    if (el) setCardH(el.offsetHeight);
  }, [index, rect]);

  if (!step) return null;
  const last = index === steps.length - 1;

  const next = () => {
    if (last) { success(); completeTour(role); onDone(); return; }
    select();
    setIndex(index + 1);
  };
  const close = () => {
    tap();
    completeTour(role);
    onDone();
  };

  // Карточку кладём туда, где она целиком помещается; если не помещается
  // нигде — где места больше. И в любом случае держим в пределах экрана,
  // иначе кнопки шага оказываются за краем.
  const viewport = typeof window === "undefined" ? 0 : window.innerHeight;
  const spaceBelow = rect ? viewport - (rect.bottom + PAD + GAP) - 12 : 0;
  const spaceAbove = rect ? rect.top - PAD - GAP - 12 : 0;
  const below = rect ? spaceBelow >= cardH || spaceBelow >= spaceAbove : false;
  const limit = Math.max(12, viewport - cardH - 12);
  const cardStyle: React.CSSProperties = rect
    ? below
      ? { top: Math.min(rect.bottom + PAD + GAP, limit) }
      : { bottom: Math.min(Math.max(16, viewport - rect.top + PAD + GAP), limit) }
    : { bottom: 24 };

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Экскурсия по разделам">
      {/* Прожектор: дыра в затемнении вокруг элемента. Без подсветки — сплошная вуаль. */}
      {rect ? (
        <>
          <motion.div className="pointer-events-none absolute inset-x-0 top-0 bg-[rgba(32,28,24,.68)]" initial={false} transition={VEIL} animate={{ height: Math.max(0, rect.top - PAD) }} />
          <motion.div className="pointer-events-none absolute left-0 bg-[rgba(32,28,24,.68)]" initial={false} transition={VEIL} animate={{ top: rect.top - PAD, width: Math.max(0, rect.left - PAD), height: rect.height + PAD * 2 }} />
          <motion.div className="pointer-events-none absolute right-0 bg-[rgba(32,28,24,.68)]" initial={false} transition={VEIL} animate={{ top: rect.top - PAD, left: rect.right + PAD, height: rect.height + PAD * 2 }} />
          <motion.div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[rgba(32,28,24,.68)]" initial={false} transition={VEIL} animate={{ top: rect.bottom + PAD }} />
          <motion.div
            className="pointer-events-none absolute rounded-[16px]"
            initial={false}
            animate={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
            transition={{ duration: 0.3, ease: EASE }}
            style={{ outline: "2px solid rgba(255,255,255,.95)", outlineOffset: 2 }}
          />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: "rgba(32,28,24,.62)" }} />
      )}

      {/* Ловим нажатия, чтобы приложением нельзя было пользоваться по ходу тура */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      <div className="pointer-events-none absolute inset-x-0 px-3" style={cardStyle}>
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            ref={cardRef}
            initial={{ opacity: 0, y: below ? -14 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="pointer-events-auto mx-auto w-full max-w-md rounded-[22px] bg-white p-4"
            style={{ boxShadow: "0 24px 48px -20px rgba(32,28,24,.55)" }}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]" style={{ background: "var(--head-soft)" }}>
                <Icon name={step.icon} width={19} weight="bold" color="var(--edge)" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="t-micro">Экскурсия · {index + 1} из {steps.length}</p>
                <p className="t-head mt-0.5">{step.title}</p>
              </div>
              <button onClick={close} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[15px] font-black" aria-label="Закрыть экскурсию">×</button>
            </div>

            <p className="t-sub mt-2.5">{step.text}</p>

            <div className="mt-3 flex gap-1.5">
              {steps.map((s, i) => (
                <span key={s.title} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ background: i <= index ? "var(--ink)" : "var(--surface-2)" }} />
              ))}
            </div>

            {/* Обе кнопки одной ширины: в flex «Назад» сжималась по тексту
                и переносила слово на вторую строку. */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {index > 0 && (
                <button
                  onClick={() => { tap(); setIndex(index - 1); }}
                  className="rounded-full py-2.5 text-[13.5px] font-black transition-transform active:scale-[0.98]"
                  style={{ border: "var(--bw) solid var(--ink)", color: "var(--ink)" }}
                >
                  Назад
                </button>
              )}
              <button
                onClick={next}
                className={`rounded-full py-2.5 text-[13.5px] font-black text-white transition-transform active:scale-[0.98] ${index > 0 ? "" : "col-span-2"}`}
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
