"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { apiFetch } from "@/lib/api";
import { APP_NAME, APP_NAME_ACC } from "@/lib/brand";
import { DEMO } from "@/lib/demo";
import { select, success, tap } from "@/lib/haptics";
import { completeOnboarding, tgUser } from "@/lib/profile";
import { setRole, setRoleIntent, type Role } from "@/lib/role";
import { FREE_CLIENT_LIMIT } from "@/lib/subscription";

const EASE = [0.16, 1, 0.3, 1] as const;

type Intro = {
  key: string;
  kicker: string;
  title: string;
  /** Хвост заголовка с новой строки и в цвете слайда. */
  titleAccent?: string;
  points: string[];
  bg: string;        // яркая заливка экрана-постера
  soft: string;      // мягкий тон для подложки под «арт»
  tone: string;      // акцент рамки скрина / кромок
  img?: string;      // реальный скрин из /public (можно заменить)
  mock: ReactNode;   // fallback — макет элемента приложения
};

const INTRO: Intro[] = [
  {
    key: "overview", kicker: APP_NAME, title: "Психологическое сопровождение под рукой",
    bg: "var(--amber-soft)", soft: "#fff7df", tone: "var(--amber-edge)",
    points: ["Найти своего специалиста", "Отслеживать динамику настроения и сессий", "Самостоятельная помощь на каждый день"],
    mock: <OverviewMock />,
  },
  {
    key: "catalog", kicker: "каталог", title: "Умный подбор специалистов",
    bg: "var(--tiffany-soft)", soft: "#effaf7", tone: "var(--tiffany-edge)",
    points: ["Персональный подбор вместо рейтинга", "Честные отзывы после встреч", "Удобный поиск по запросу"],
    mock: <CatalogMock />,
  },
  {
    key: "tools", kicker: "практики", title: "Самостоятельные практики и база знаний",
    bg: "var(--green-soft)", soft: "#eaf0e4", tone: "var(--green-edge)",
    points: ["Эффективные практики для самостоятельной работы", "Интерактивные инструменты внутри приложения", "Тесты и анализ собственного состояния"],
    mock: <ToolsMock />,
  },
  {
    key: "psy", kicker: "для психологов", title: "Клиент и специалист —", titleAccent: "в едином пространстве",
    bg: "var(--amber-soft)", soft: "#fff7df", tone: "var(--amber-edge)",
    points: ["Удобная форма записи с напоминаниями о встрече", "Подробная статистика и метрики по терапии", "Заметки по каждой сессии и динамика прогресса"],
    mock: <ClientProgressMock />,
  },
];

// Шаги: 0 — приветствие, 1..4 — интро, 5 — выбор роли.
const WELCOME = 0;
const ROLE_STEP = INTRO.length + 1;

export function Onboarding() {
  const qc = useQueryClient();
  const [step, setStep] = useState(WELCOME);
  const [psySell, setPsySell] = useState(false); // после выбора «психолог» — продажа PRO
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const tg = tgUser();
  const swipeX = useRef<number | null>(null);
  const isWelcome = step === WELCOME && !psySell;
  const isRole = step === ROLE_STEP && !psySell;
  const cur = INTRO[step - 1];

  const finish = () => { success(); completeOnboarding(); };

  // Согласие даётся здесь же, галочкой на последнем шаге: отдельная стена
  // перед знакомством встречала человека юридическим текстом раньше, чем он
  // понял, куда попал. В демо согласовывать нечего — данных настоящих нет.
  const acceptAndGo = async (after: () => void) => {
    if (saving) return;
    setSaving(true);
    if (!DEMO) {
      try {
        await apiFetch("/consents", { method: "POST", body: JSON.stringify({ kinds: ["pd", "health"] }) });
        qc.invalidateQueries({ queryKey: ["consents"] });
      } catch {
        // Гость ещё без учётной записи — согласие спросит гейт после входа.
      }
    }
    setSaving(false);
    after();
  };
  const next = () => { select(); setStep((s) => Math.min(ROLE_STEP, s + 1)); };
  const back = () => { tap(); setStep((s) => Math.max(WELCOME, s - 1)); };
  const endSwipe = (x: number) => {
    const start = swipeX.current;
    swipeX.current = null;
    if (start == null || isRole || psySell) return;
    const delta = x - start;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) next(); else back();
  };

  // На экране продажи PRO шаг остаётся последним, а `cur` для него нет:
  // обращение к нему без проверки роняло приложение при выборе психолога.
  const bg = psySell ? "#ffffff" : isWelcome ? "var(--purple-soft)" : isRole ? "var(--tiffany-soft)" : cur?.bg ?? "var(--purple-soft)";

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto"
      data-accent="purple"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7, ease: EASE }}
      style={{ background: bg, transition: "background-color .5s ease" }}
    >
      {isWelcome && <SilkWaves />}

      {/* Декоративные заливки-круги для «постерного» объёма */}
      {!isWelcome && !isRole && !psySell && cur && (
        <>
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-40" style={{ background: "#fff" }} />
          <span aria-hidden className="pointer-events-none absolute -left-20 top-1/3 h-52 w-52 rounded-full opacity-20" style={{ background: cur.tone }} />
        </>
      )}

      {!isWelcome && !isRole && !psySell && (
        <>
          <button type="button" onClick={back} className="absolute bottom-16 left-0 top-[calc(var(--top-pad)+48px)] z-20 w-[15%]" aria-label="Предыдущий экран" />
          <button type="button" onClick={next} className="absolute bottom-16 right-0 top-[calc(var(--top-pad)+48px)] z-20 w-[15%]" aria-label="Следующий экран" />
        </>
      )}

      <div className="relative mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-[calc(var(--safe-bottom)+18px)] pt-[var(--top-pad)] min-[360px]:px-5 min-[390px]:px-6 md:pt-8">
        {/* Верх: прогресс + пропустить */}
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: ROLE_STEP + 1 }).map((_, k) => <span key={k} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ background: k <= step ? "var(--ink)" : "rgba(32,28,24,.2)" }} />)}
          </div>
          <button onClick={finish} className="shrink-0 text-[11px] font-black" style={{ color: "rgba(32,28,24,.6)" }}>Пропустить</button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={psySell ? "psySell" : isWelcome ? "welcome" : isRole ? "role" : cur.key}
            initial={{ opacity: 0, x: 26 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -26 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="relative flex min-h-0 flex-1 flex-col touch-pan-y"
            onPointerDown={(event) => { if (!isWelcome && !isRole && !psySell) swipeX.current = event.clientX; }}
            onPointerUp={(event) => endSwipe(event.clientX)}
            onPointerCancel={() => { swipeX.current = null; }}
          >
            {psySell ? (
              <PsySell onStart={finish} />
            ) : isWelcome ? (
              <Welcome onNext={next} />
            ) : isRole ? (
              <RolePicker
                firstName={tg?.first_name}
                agreed={agreed}
                saving={saving}
                onAgree={() => { tap(); setAgreed((v) => !v); }}
                onPick={(r) => {
                  select();
                  void acceptAndGo(() => {
                    setRole(r);
                    setRoleIntent(r);
                    if (r === "psychologist") setPsySell(true); else finish();
                  });
                }}
              />
            ) : (
              <div className="flex flex-1 flex-col">
                <span className="mt-[clamp(12px,3vh,24px)] inline-flex w-fit items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em]" style={{ color: cur.tone, border: `1.5px solid ${cur.tone}` }}>{cur.kicker}</span>
                <h1 className="font-tight mt-3 text-[clamp(23px,7vw,27px)] font-black leading-[1.08]">
                  {cur.title}
                  {cur.titleAccent && <><br /><span style={{ color: cur.tone }}>{cur.titleAccent}</span></>}
                </h1>
                <ul className="mt-3 space-y-1.5 min-[390px]:mt-4 min-[390px]:space-y-2">
                  {cur.points.map((p, i) => (
                    <motion.li key={p} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.06 }} className="flex items-start gap-2.5 text-[13.5px] font-bold leading-snug">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white" style={{ border: `1.5px solid ${cur.tone}` }}><Icon name="check" width={12} weight="bold" color={cur.tone} /></span>
                      {p}
                    </motion.li>
                  ))}
                </ul>
                {/* «Арт»-зона: макет элемента приложения на мягкой цветной подложке */}
                <div className="relative flex min-h-[238px] flex-1 items-center justify-center py-3">
                  <span aria-hidden className="pointer-events-none absolute h-[min(300px,82vw)] w-[min(300px,82vw)] rounded-full" style={{ background: cur.soft, opacity: 0.75 }} />
                  <span aria-hidden className="pointer-events-none absolute bottom-2 h-24 w-52 rounded-full blur-2xl" style={{ background: cur.tone, opacity: 0.25 }} />
                  <Shot tone={cur.tone}>{cur.mock}</Shot>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Текстовая навигация остаётся доступной помимо свайпа и тап-зон. */}
        {!isWelcome && !isRole && !psySell && (
          <div className="relative z-30 flex items-center gap-2.5">
            <button onClick={back} className="btn btn-outline flex-1 py-3" aria-label="Назад">Назад</button>
            <button onClick={next} className="btn btn-accent flex-1 py-3" aria-label="Далее">Далее</button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Приветствие: текст проявляется по очереди — заголовок, подзаголовок, кнопка.
function Welcome({ onNext }: { onNext: () => void }) {
  // Тот же подъём, что у Reveal на остальных экранах: opacity + сдвиг по y.
  // Анимируем только transform и opacity — блюр на каждом кадре роняет вебвью Telegram.
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.5, ease: EASE },
  });
  return (
    <div className="flex flex-1 flex-col justify-center py-10">
      <motion.p {...rise(0.1)} className="text-[11px] font-black uppercase tracking-[.18em]" style={{ color: "var(--purple-edge)" }}>
        Платформа психологической поддержки
      </motion.p>
      <motion.h1 {...rise(0.25)} className="font-tight mt-3 text-[clamp(30px,10vw,40px)] font-black leading-[1.02] text-[var(--ink)]">
        Добро пожаловать<br />в <span style={{ color: "var(--purple-edge)" }}>{APP_NAME_ACC}</span>
      </motion.h1>
      <motion.p {...rise(0.45)} className="mt-4 max-w-[320px] text-[15px] font-bold leading-snug" style={{ color: "rgba(32,28,24,.7)" }}>
        Цифровые инструменты для самостоятельной психологической поддержки и эффективного прогресса терапии
      </motion.p>
      <motion.div {...rise(0.65)} className="mt-8">
        <button onClick={onNext} className="btn btn-accent w-full py-3.5 text-[14px]">Начать знакомство</button>
      </motion.div>
    </div>
  );
}

// Фон приветствия: шёлковые волны, плывущие с разной скоростью.
// Анимация — на CSS и только по transform: motion пересчитывал бы её на
// каждом кадре в JS, а вебвью Telegram этого не прощает.
const WAVES = [
  { d: "M0 210 C 120 170 240 250 360 205 C 480 160 600 240 720 200 L 720 420 L 0 420 Z", fill: "var(--purple-edge)", opacity: 0.16, duration: 26, top: 0 },
  { d: "M0 250 C 130 300 250 200 360 250 C 470 300 600 210 720 255 L 720 420 L 0 420 Z", fill: "var(--tiffany-edge)", opacity: 0.14, duration: 34, top: 14 },
  { d: "M0 300 C 140 260 230 340 360 300 C 490 260 590 340 720 300 L 720 420 L 0 420 Z", fill: "var(--purple-edge)", opacity: 0.22, duration: 44, top: 28 },
];

function SilkWaves() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="silk-glow absolute left-1/2 top-[-14%] h-[52vh] w-[120vw] -translate-x-1/2" />
      <svg className="absolute inset-x-0 bottom-0 h-[72%] w-full" viewBox="0 0 360 420" preserveAspectRatio="none">
        {WAVES.map((wave, i) => (
          <g
            key={i}
            className="silk-wave"
            style={{ animationDuration: reduce ? "0s" : `${wave.duration}s`, ["--y" as string]: `${wave.top}px` }}
          >
            <path d={wave.d} fill={wave.fill} opacity={wave.opacity} />
            <path d={wave.d} fill={wave.fill} opacity={wave.opacity} transform="translate(360 0)" />
          </g>
        ))}
      </svg>
    </div>
  );
}

// После выбора «психолог» — продающий экран PRO с бесплатным стартом.
function PsySell({ onStart }: { onStart: () => void }) {
  const rows: { icon: IconName; label: string; free: string; pro: string }[] = [
    { icon: "users", label: "Клиенты", free: `до ${FREE_CLIENT_LIMIT}`, pro: "без лимита" },
    { icon: "calendar", label: "Записи и расписание", free: "всё", pro: "всё" },
    { icon: "note", label: "Задания и заметки", free: "всё", pro: "всё" },
    { icon: "chart", label: "Статистика работы", free: "всё", pro: "всё" },
    { icon: "compass", label: "Размещение в каталоге специалистов", free: "—", pro: "включено" },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pb-4 pt-4">
        <div className="flex items-center gap-3">
          <span className="ico ico-accent h-12 w-12 shrink-0"><Icon name="users" width={23} weight="bold" color="#fff" /></span>
          <div className="min-w-0">
            <p className="t-micro" style={{ color: "var(--purple-edge)" }}>Для психологов</p>
            <h1 className="font-tight mt-1 text-[clamp(22px,6vw,26px)] font-black leading-[1.04] text-[var(--ink)]">
              Больше клиентов <span style={{ color: "var(--purple-edge)" }}>без лимитов</span>
            </h1>
          </div>
        </div>

        <div className="mt-4 rounded-[20px] p-4" style={{ background: "var(--purple-soft)" }}>
          <div className="flex items-start gap-3">
            <span className="ico ico-accent h-10 w-10 shrink-0"><Icon name="check" width={18} weight="bold" color="#fff" /></span>
            <div>
              <p className="t-head text-[var(--ink)]">{FREE_CLIENT_LIMIT} клиента бесплатно</p>
              <p className="t-sub mt-0.5">Все функции доступны сразу. Карта не нужна.</p>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-[18px] bg-white" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
          <div className="grid grid-cols-[minmax(0,1fr)_72px_82px] items-center bg-[var(--purple-soft)] px-3 py-2.5 text-[11px] font-black">
            <span>Возможности</span><span className="text-center">Бесплатно</span><span className="text-center" style={{ color: "var(--purple-edge)" }}>PRO</span>
          </div>
          {rows.map((row) => (
            <div key={row.label} className="line-top grid grid-cols-[minmax(0,1fr)_72px_82px] items-center gap-1 px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--purple-edge)]"><Icon name={row.icon} width={13} weight="bold" color="#fff" /></span>
                <span className="text-[11px] font-bold leading-tight text-[var(--ink)]">{row.label}</span>
              </span>
              <span className="text-center text-[10.5px] font-bold text-[var(--muted)]">{row.free}</span>
              <span className="text-center text-[10.5px] font-black" style={{ color: "var(--purple-edge)" }}>{row.pro}</span>
            </div>
          ))}
        </div>

        <p className="t-cap mt-3 flex items-start gap-2 leading-snug">
          <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white" style={{ border: "1.5px solid var(--purple-edge)" }}><Icon name="user" width={11} weight="bold" color="var(--purple-edge)" /></span>
          Роль клиента тоже открыта: в кабинете переключитесь на неё и посмотрите приложение глазами тех, кого ведёте.
        </p>
      </div>
      <div className="pt-2">
        <button onClick={() => { tap(); onStart(); }} className="btn btn-accent w-full py-3.5 text-[14px]"><Icon name="spark" width={17} weight="fill" color="#fff" /> Начать бесплатно</button>
      </div>
    </div>
  );
}

const ROLE_OPTIONS: { role: Role; title: string; icon: IconName; features: { icon: IconName; title: string; text: string }[] }[] = [
  {
    role: "psychologist", title: "Я психолог", icon: "users",
    features: [
      { icon: "calendar", title: "Расписание и записи", text: "Рабочие часы, свободные окна, напоминания клиентам" },
      { icon: "users", title: "Карточки клиентов", text: "Настроение, задания и заметки по каждому в одном месте" },
      { icon: "chart", title: "Статистика практики", text: "Сессии, доход и загрузка недели считаются сами" },
    ],
  },
  {
    role: "client", title: "Я пользователь", icon: "heart",
    features: [
      { icon: "compass", title: "Поиск специалиста", text: "Универсальный фильтр под ваши требования с возможностью быстрой записи" },
      { icon: "chart", title: "Динамика и прогресс встреч", text: "Вы можете делать пометки о своём состоянии между встречами, чтобы увидеть динамику терапии на всей дистанции" },
      { icon: "tools", title: "Самостоятельные практики", text: "Платформа будет наполняться цифровыми инструментами для самостоятельной диагностики и работы без участия терапевта" },
    ],
  },
];

const SOON: { icon: IconName; label: string }[] = [
  { icon: "book", label: "База знаний" },
  { icon: "spark", label: "AI-помощник" },
  { icon: "question", label: "Тесты для самодиагностики" },
];

// Мини-баннер о наполнении платформы: показывает, что дальше будет больше.
function SoonBanner() {
  return (
    <div className="mt-6 rounded-[18px] p-3.5" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-white px-2 py-0.5 text-[9.5px] font-black uppercase tracking-[.1em]" style={{ color: "var(--purple-edge)" }}>Скоро</span>
        <p className="text-[12.5px] font-black leading-tight text-[var(--ink)]">Платформа растёт</p>
      </div>
      <p className="mt-2 text-[11.5px] font-semibold leading-snug" style={{ color: "rgba(32,28,24,.66)" }}>
        Готовим базу знаний, AI-помощника и тесты для самодиагностики — чтобы усилить терапевтическую практику.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {SOON.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-black" style={{ color: "var(--ink)" }}>
            <Icon name={item.icon} width={13} weight="bold" color="var(--purple-edge)" />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function RolePicker({ firstName, agreed, saving, onAgree, onPick }: {
  firstName?: string;
  agreed: boolean;
  saving: boolean;
  onAgree: () => void;
  onPick: (role: Role) => void;
}) {
  const [index, setIndex] = useState(1); // по умолчанию — пользователь
  const active = ROLE_OPTIONS[index];
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-5 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[var(--purple-edge)]"><Icon name="therapy" width={24} weight="fill" color="#fff" /></span>
        <h1 className="font-tight text-[25px] font-black leading-[1.06] text-[var(--ink)]">{firstName ? `${firstName}, с чего начнём?` : "С чего начнём?"}</h1>
      </div>
      <p className="mt-3 text-[13px] font-semibold leading-snug" style={{ color: "rgba(32,28,24,.66)" }}>Выберите роль. Позже её можно будет сменить.</p>

      {/* Свитч: лавандовая плашка едет к выбранной половине */}
      <div className="relative mt-6 grid grid-cols-2 rounded-full bg-white p-1" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
        <motion.span
          aria-hidden
          className="absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-[var(--purple-edge)]"
          animate={{ left: index === 0 ? 4 : "50%" }}
          transition={{ type: "spring", stiffness: 340, damping: 32 }}
        />
        {ROLE_OPTIONS.map((item, k) => (
          <button
            key={item.role}
            onClick={() => { select(); setIndex(k); }}
            className="relative z-[1] flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-black transition-colors duration-200"
            style={{ color: index === k ? "#fff" : "var(--purple-edge)" }}
          >
            <Icon name={item.icon} width={16} weight="bold" color={index === k ? "#fff" : "var(--purple-edge)"} />
            {item.title}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.role}
          initial={{ opacity: 0, x: index === 0 ? -14 : 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: index === 0 ? 14 : -14 }}
          transition={{ duration: 0.24, ease: EASE }}
          className="mt-4"
        >
          <p className="t-micro" style={{ color: "var(--purple-edge)" }}>Возможности платформы</p>
          {/* Список возможностей роли — иначе низ экрана оставался пустым */}
          <div className="mt-3 space-y-3.5">
            {active.features.map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--purple-soft)]"><Icon name={item.icon} width={18} weight="bold" color="var(--purple-edge)" /></span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-black leading-tight">{item.title}</span>
                  <span className="mt-0.5 block text-[11.5px] font-semibold leading-snug" style={{ color: "rgba(32,28,24,.6)" }}>{item.text}</span>
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      <SoonBanner />

      <div className="mt-auto pt-6">
        {/* Согласие — здесь, одной галочкой: без него кнопка не работает. */}
        <button onClick={onAgree} aria-pressed={agreed} className="flex w-full items-start gap-2.5 rounded-[14px] bg-white/70 p-3 text-left">
          <span
            className="keep-style mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px]"
            style={{ background: agreed ? "var(--purple-edge)" : "#fff", border: `var(--bw) solid ${agreed ? "var(--purple-edge)" : "var(--edge)"}` }}
          >
            {agreed && <Icon name="check" width={13} weight="bold" color="#fff" />}
          </span>
          <span className="text-[11.5px] font-semibold leading-snug" style={{ color: "rgba(32,28,24,.72)" }}>
            Согласен на обработку персональных данных, включая записи о состоянии — дневник, заметки, колесо баланса.{" "}
            <Link href="/policy" onClick={(event) => event.stopPropagation()} className="font-black underline" style={{ color: "var(--purple-edge)" }}>Политика</Link>
            . Отозвать можно в кабинете.
          </span>
        </button>
        <button
          onClick={() => onPick(active.role)}
          disabled={!agreed || saving}
          className="btn btn-accent mt-3 w-full py-3.5 text-[14px] disabled:opacity-45"
        >
          {saving ? "Сохраняем…" : "Продолжить"}
        </button>
      </div>
    </div>
  );
}

// Адаптивный снимок актуальных элементов интерфейса. Он использует общие
// токены приложения и не остаётся в старой палитре после её обновления.
function Shot({ tone, children }: { tone: string; children: ReactNode }) {
  return <Phone tone={tone}>{children}</Phone>;
}

function Phone({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <div className="relative w-[min(214px,64vw)] overflow-hidden rounded-[27px] bg-white p-2.5" style={{ boxShadow: "0 30px 52px -22px rgba(32,28,24,.6)", border: `var(--bw-lg) solid ${tone}` }}>
      <div className="overflow-hidden rounded-[20px] bg-white" style={{ border: "1.5px solid rgba(32,28,24,.12)" }}>
        <div className="flex items-center gap-1 px-3 pb-1.5 pt-2.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
          <span className="h-1 w-8 rounded-full bg-[var(--ink)] opacity-15" />
        </div>
        <div className="min-h-[224px] bg-white p-2.5">{children}</div>
      </div>
    </div>
  );
}

const Bar = ({ w = "100%", h = 7, tone = "rgba(32,28,24,.14)" }: { w?: string; h?: number; tone?: string }) => (
  <span className="block rounded-full" style={{ width: w, height: h, background: tone }} />
);
const Box = ({ children, tone = "#fff", edge = "rgba(32,28,24,.16)" }: { children?: ReactNode; tone?: string; edge?: string }) => (
  <div className="rounded-[10px] p-2" style={{ background: tone, border: `1.5px solid ${edge}` }}>{children}</div>
);

// ——— Макеты элементов приложения (без персонажей) ———

function OverviewMock() {
  return (
    <div className="space-y-2">
      <Box tone="var(--amber-soft)" edge="var(--amber-edge)">
        <div className="flex items-center justify-between"><Bar w="45%" h={6} tone="rgba(32,28,24,.3)" /><span className="rounded-full bg-white px-1.5 py-0.5 text-[7px] font-black stroke">сегодня</span></div>
        <p className="mt-1.5 text-[10px] font-black">Ближайшая сессия · 18:00</p>
      </Box>
      <Box>
        <Bar w="55%" h={6} tone="rgba(32,28,24,.3)" />
        <div className="mt-1.5 flex items-end justify-center gap-[3px]">
          {[10, 16, 12, 20, 26, 22, 30].map((height, i) => <span key={i} className="w-[7px] rounded-full" style={{ height, background: i === 4 ? "var(--olive-edge)" : "var(--amber-soft)", border: "1px solid rgba(32,28,24,.18)" }} />)}
        </div>
      </Box>
      <div className="grid grid-cols-3 gap-1">
        <Box tone="var(--olive-soft)" edge="var(--olive-edge)"><span className="block text-center text-[13px] font-black leading-none">4</span><span className="mt-1 block text-center text-[5.5px] font-black uppercase text-[var(--muted)]">сессии</span></Box>
        <Box tone="var(--amber-soft)" edge="var(--amber-edge)"><span className="block text-center text-[13px] font-black leading-none">4 ч</span><span className="mt-1 block text-center text-[5.5px] font-black uppercase text-[var(--muted)]">работы</span></Box>
        <Box tone="var(--purple-soft)" edge="var(--purple-edge)"><span className="block text-center text-[13px] font-black leading-none">3</span><span className="mt-1 block text-center text-[5.5px] font-black uppercase text-[var(--muted)]">клиента</span></Box>
      </div>
    </div>
  );
}

function CatalogMock() {
  return (
    <div className="space-y-2">
      <div className="flex gap-1">{["тревога", "онлайн", "до 4000"].map((l) => <span key={l} className="rounded-full px-1.5 py-0.5 text-[7px] font-black" style={{ background: "var(--olive-soft)", border: "1px solid var(--olive-edge)" }}>{l}</span>)}</div>
      {[0, 1].map((row) => (
        <Box key={row}>
          <div className="flex gap-1.5">
            <span className="h-[38px] w-[32px] shrink-0 rounded-[8px]" style={{ background: row ? "var(--purple-soft)" : "var(--green-soft)", border: "1.5px solid rgba(32,28,24,.16)" }} />
            <div className="flex-1 space-y-1 pt-0.5"><Bar w="80%" h={6} tone="rgba(32,28,24,.32)" /><span className="flex items-center gap-1"><Icon name="check" width={8} weight="bold" color="var(--green-edge)" /><Bar w="60%" h={4} /></span><Bar w="68%" h={4} /></div>
          </div>
        </Box>
      ))}
      <div className="rounded-full py-1 text-center text-[8px] font-black text-white" style={{ background: "var(--ink)" }}>Посмотреть и записаться</div>
    </div>
  );
}

function ToolsMock() {
  return (
    <div className="space-y-2">
      <Box tone="var(--coral-soft)" edge="var(--coral-edge)">
        <Bar w="50%" h={6} tone="rgba(32,28,24,.3)" />
        <div className="mt-1.5 flex items-center justify-center gap-1.5">{[1, 2, 3, 4, 5].map((i) => <span key={i} className="h-6 w-6 rounded-[8px]" style={{ background: `var(--mood-${i})`, border: "1px solid rgba(32,28,24,.2)" }} />)}</div>
      </Box>
      <div className="grid grid-cols-2 gap-1.5">
        {[["var(--green)", "Дыхание"], ["var(--amber)", "Дневник"], ["var(--purple)", "Медитация"], ["var(--coral)", "Заземление"]].map(([color, label], i) => (
          <div key={i} className="rounded-[9px] p-1.5" style={{ background: color as string, border: "1.5px solid rgba(32,28,24,.18)" }}>
            <span className="block h-4 w-4 rounded-[6px] bg-white" style={{ border: "1.5px solid rgba(32,28,24,.18)" }} />
            <span className="mt-1.5 block text-[7px] font-black">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientProgressMock() {
  return (
    <div className="space-y-2">
      <Box tone="var(--purple-soft)" edge="var(--purple-edge)">
        <div className="flex items-center gap-1.5">
          <span className="h-6 w-6 shrink-0 rounded-full bg-white" style={{ border: "1.5px solid var(--purple-edge)" }} />
          <span className="flex-1 space-y-1"><Bar w="52%" h={6} tone="rgba(32,28,24,.32)" /><Bar w="34%" h={4} /></span>
          <span className="rounded-full bg-white px-1.5 py-0.5 text-[7px] font-black">8 сессий</span>
        </div>
      </Box>
      <Box>
        <div className="flex items-center justify-between"><Bar w="42%" h={5} tone="rgba(32,28,24,.3)" /><span className="text-[7px] font-black uppercase text-[var(--muted)]">прогресс</span></div>
        <div className="mt-1.5 flex items-end justify-center gap-[3px]">
          {[9, 13, 11, 18, 17, 24, 29].map((height, i) => <span key={i} className="w-[7px] rounded-full" style={{ height, background: i > 4 ? "var(--olive-edge)" : "var(--amber-soft)", border: "1px solid rgba(32,28,24,.18)" }} />)}
        </div>
      </Box>
      <Box tone="var(--amber-soft)" edge="var(--amber-edge)">
        <span className="flex items-center gap-1"><Icon name="note" width={9} weight="bold" /><Bar w="55%" h={5} tone="rgba(32,28,24,.3)" /></span>
        <p className="mt-1 text-[7.5px] font-black leading-tight">Заметка после встречи · задание отправлено</p>
      </Box>
    </div>
  );
}
