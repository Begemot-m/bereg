"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { PrivacyNote } from "@/components/privacy-note";
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
  /** Не просто строки: в пункте бывает слово, выделенное цветом. */
  points: ReactNode[];
  bg: string;        // яркая заливка экрана-постера
  soft: string;      // мягкий тон для подложки под «арт»
  tone: string;      // акцент рамки скрина / кромок
  img?: string;      // реальный скрин из /public (можно заменить)
  mock: ReactNode;   // fallback — макет элемента приложения
};

// Ветка клиента: что человек получает внутри.
const CLIENT_INTRO: Intro[] = [
  {
    key: "overview", kicker: APP_NAME, title: "Психологическое сопровождение под рукой",
    bg: "var(--amber-soft)", soft: "#fff7df", tone: "var(--amber-edge)",
    points: [
      "Найти проверенного квалифицированного специалиста",
      "Отслеживайте динамику настроения и сессий со специалистом",
      "Платформа будет пополняться инструментами для самостоятельной работы",
    ],
    mock: <OverviewMock />,
  },
  {
    key: "catalog", kicker: "каталог", title: "Умный подбор специалистов",
    bg: "var(--tiffany-soft)", soft: "#effaf7", tone: "var(--tiffany-edge)",
    points: [
      "Персональный подбор вместо рейтинга",
      "Честные отзывы после встреч",
      "Удобный поиск по запросу",
      "Вы можете пригласить своего специалиста и усилить вашу совместную работу",
    ],
    mock: <CatalogMock />,
  },
  {
    key: "tools", kicker: "практики", title: "Самостоятельные практики и база знаний",
    bg: "var(--green-soft)", soft: "#eaf0e4", tone: "var(--green-edge)",
    points: [
      "Цифровые инструменты помогут улучшить состояние",
      "Пройдите тесты и узнайте себя лучше",
      "Мы будем постоянно дополнять платформу и делиться практиками из научной психологии",
    ],
    mock: <ToolsMock />,
  },
];

// Ветка психолога: пять доводов, зачем платформа практике.
const PSY_INTRO: Intro[] = [
  {
    key: "crm", kicker: "практика", title: "Ваша практика —", titleAccent: "в одном месте",
    bg: "var(--tiffany-soft)", soft: "#effaf7", tone: "var(--tiffany-edge)",
    points: [
      "Приводите своих клиентов: карточка, записи и история встреч живут в приложении, к которому у них есть доступ",
      "Клиент сам выберет свободное окно без лишних переписок и согласований",
      "Напоминания о встрече и переносе не позволят пропустить сеанс",
      "Гибкие настройки графика, правил записи и отмены встреч для вашей комфортной практики",
    ],
    mock: <ScheduleMock />,
  },
  {
    key: "flow", kicker: "непрерывность", title: "Терапия не обрывается", titleAccent: "между встречами",
    bg: "var(--purple-soft)", soft: "#f2ecf9", tone: "var(--purple-edge)",
    points: [
      "Клиент отмечает настроение и самочувствие каждый день",
      "Платформа будет наполняться новыми диагностическими инструментами",
      "Заметки, задания и отметки о проведённых сессиях позволят глубже понять клиента",
      "Терапия ощущается непрерывным процессом в контакте со специалистом: клиенты реже станут выпадать и чаще возвращаться к вам",
    ],
    mock: <ClientProgressMock />,
  },
  {
    key: "catalog", kicker: "каталог", title: "Анкета в каталоге —", titleAccent: "ваша визитка",
    bg: "var(--amber-soft)", soft: "#fff7df", tone: "var(--amber-edge)",
    points: [
      "Подробная анкета о вас и вашем подходе: ссылку можно отправить кому угодно, а не только тем, кто нашёл вас внутри платформы",
      "Из каталога к вам записываются на свободные окна — на ближайшие даты, без переписки",
      "Прозрачная система без покупного рейтинга и накрученных отзывов: оценку ставят только клиенты, с кем вы провели встречу через платформу",
    ],
    mock: <ListingMock />,
  },
  {
    key: "reviews", kicker: "отзывы", title: "Рейтинг, который", titleAccent: "нельзя купить",
    bg: "var(--green-soft)", soft: "#eaf0e4", tone: "var(--green-edge)",
    points: [
      "Оценку ставит только тот, кто действительно был у вас на сессии",
      "Место в каталоге зависит от совпадения с запросом, а не от оплаты",
      "Честный отзыв работает на репутацию дольше любой рекламы",
    ],
    mock: <ReviewsMock />,
  },
  {
    key: "price", kicker: "оплата", title: "Ни рубля комиссии", titleAccent: "с ваших сессий",
    bg: "var(--coral-soft)", soft: "#fbe6df", tone: "var(--coral-edge)",
    points: [
      "Платите фиксированно за инструмент — процент со встреч не берём",
      "Сколько бы клиентов ни пришло, доход остаётся вашим",
      <>
        Первые {FREE_CLIENT_LIMIT} клиента и анкета в каталоге — бесплатно всегда, а после верификации ещё{" "}
        <span style={{ color: "var(--purple-edge)" }}>14 дней PRO без лимитов</span>
      </>,
    ],
    mock: <PriceMock />,
  },
];

// startRole — знакомство без выбора роли: так приходят по ссылке-приглашению,
// где человек уже назвался клиентом специалиста, и спрашивать его «вы психолог?»
// после экрана приглашения было бы странно.
// preview — знакомство открыто из кабинета «просто посмотреть»: роль не
// переключается, согласие повторно не подписывается, флаг пройденного
// онбординга остаётся как был. Закрытие — onClose, а не вход в приложение.
export function Onboarding({ startRole, preview, onClose }: { startRole?: Role; preview?: boolean; onClose?: () => void } = {}) {
  const qc = useQueryClient();
  // Роль выбирается на первом же экране, дальше знакомство идёт под неё.
  const [picked, setPicked] = useState<Role | null>(startRole ?? null);
  const [step, setStep] = useState(1); // 1..slides.length — слайды, последний+1 — финал
  const [agreed, setAgreed] = useState(!!preview);
  const [saving, setSaving] = useState(false);
  const tg = tgUser();
  const swipeX = useRef<number | null>(null);
  const slides = picked === "psychologist" ? PSY_INTRO : CLIENT_INTRO;
  const FINISH_STEP = slides.length + 1;
  const isWelcome = picked === null;
  const isFinish = !isWelcome && step === FINISH_STEP;
  const cur = isWelcome || isFinish ? undefined : slides[step - 1];

  const finish = () => { success(); if (preview) onClose?.(); else completeOnboarding(); };

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
  const pick = (role: Role) => {
    select();
    if (!preview) {
      setRole(role);
      setRoleIntent(role);
    }
    setPicked(role);
    setStep(1);
  };
  const next = () => { select(); setStep((s) => Math.min(FINISH_STEP, s + 1)); };
  // С первого слайда «назад» возвращает к выбору роли: её можно передумать.
  const back = () => {
    tap();
    if (step <= 1) { if (!startRole) setPicked(null); return; }
    setStep((s) => s - 1);
  };
  const endSwipe = (x: number) => {
    const start = swipeX.current;
    swipeX.current = null;
    if (start == null || isWelcome || isFinish) return;
    const delta = x - start;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) next(); else back();
  };

  // На финальном экране слайда нет: обращение к `cur` без проверки роняло бы
  // приложение.
  const bg = isFinish ? "#ffffff" : isWelcome ? "var(--purple-soft)" : cur?.bg ?? "var(--purple-soft)";

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
      {cur && (
        <>
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-40" style={{ background: "#fff" }} />
          <span aria-hidden className="pointer-events-none absolute -left-20 top-1/3 h-52 w-52 rounded-full opacity-20" style={{ background: cur.tone }} />
          <button type="button" onClick={back} className="absolute bottom-16 left-0 top-[calc(var(--top-pad)+48px)] z-20 w-[15%]" aria-label="Предыдущий экран" />
          <button type="button" onClick={next} className="absolute bottom-16 right-0 top-[calc(var(--top-pad)+48px)] z-20 w-[15%]" aria-label="Следующий экран" />
        </>
      )}

      <div className="relative mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-[calc(var(--safe-bottom)+18px)] pt-[var(--top-pad)] min-[360px]:px-5 min-[390px]:px-6 md:pt-8">
        {/* Верх: прогресс по ветке роли + пропустить */}
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1.5">
            {!isWelcome && Array.from({ length: FINISH_STEP }).map((_, k) => <span key={k} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ background: k < step ? "var(--ink)" : "rgba(32,28,24,.2)" }} />)}
          </div>
          {/* «Пропустить» осталось только в просмотре из кабинета: на боевом
              знакомстве это была единственная дверь мимо согласия на обработку
              данных — человек оказывался внутри платформы, ничего не подписав. */}
          {preview && <button onClick={finish} className="shrink-0 text-[11px] font-black" style={{ color: "rgba(32,28,24,.6)" }}>Закрыть</button>}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={isWelcome ? "welcome" : isFinish ? `finish-${picked}` : cur!.key}
            initial={{ opacity: 0, x: 26 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -26 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="relative flex min-h-0 flex-1 flex-col touch-pan-y"
            onPointerDown={(event) => { if (cur) swipeX.current = event.clientX; }}
            onPointerUp={(event) => endSwipe(event.clientX)}
            onPointerCancel={() => { swipeX.current = null; }}
          >
            {isWelcome ? (
              <Welcome firstName={tg?.first_name} onPick={pick} />
            ) : isFinish ? (
              (() => {
                const consent = {
                  agreed,
                  saving,
                  onAgree: () => { tap(); setAgreed((v) => !v); },
                  onStart: () => { if (preview) { finish(); return; } void acceptAndGo(finish); },
                };
                return picked === "psychologist" ? <PsySell {...consent} /> : <ClientFinish {...consent} />;
              })()
            ) : cur ? (
              <div className="flex flex-1 flex-col">
                <span className="mt-[clamp(12px,3vh,24px)] inline-flex w-fit items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em]" style={{ color: cur.tone, border: `1.5px solid ${cur.tone}` }}>{cur.kicker}</span>
                <h1 className="font-tight mt-3 text-[clamp(23px,7vw,27px)] font-black leading-[1.08]">
                  {cur.title}
                  {cur.titleAccent && <><br /><span style={{ color: cur.tone }}>{cur.titleAccent}</span></>}
                </h1>
                <ul className="mt-3 space-y-1.5 min-[390px]:mt-4 min-[390px]:space-y-2">
                  {cur.points.map((p, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.06 }} className="flex items-start gap-2.5 text-[13.5px] font-bold leading-snug">
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
            ) : null}
          </motion.div>
        </AnimatePresence>

        {/* Текстовая навигация остаётся доступной помимо свайпа и тап-зон. */}
        {cur && (
          <div className="relative z-30 flex items-center gap-2.5">
            <button onClick={back} className="btn btn-outline flex-1 py-3" aria-label="Назад">Назад</button>
            <button onClick={next} className="btn btn-accent flex-1 py-3" aria-label="Далее">Далее</button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Приветствие и сразу развилка. Роль выбирается свитчем, как было раньше:
// лавандовая плашка едет к выбранной половине, под ней — что даёт эта роль.
function Welcome({ firstName, onPick }: { firstName?: string; onPick: (role: Role) => void }) {
  const [index, setIndex] = useState(0); // по умолчанию — пользователь
  const active = ROLE_OPTIONS[index];
  // Тот же подъём, что у Reveal на остальных экранах: opacity + сдвиг по y.
  // Анимируем только transform и opacity — блюр на каждом кадре роняет вебвью Telegram.
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.5, ease: EASE },
  });
  return (
    <div className="flex flex-1 flex-col py-4">
      <motion.p {...rise(0.1)} className="text-[11px] font-black uppercase tracking-[.18em]" style={{ color: "var(--purple-edge)" }}>
        Платформа психологической поддержки
      </motion.p>
      <motion.h1 {...rise(0.22)} className="font-tight mt-2.5 text-[clamp(24px,8vw,32px)] font-black leading-[1.04] text-[var(--ink)]">
        {firstName ? `${firstName}, добро пожаловать` : "Добро пожаловать"}<br />в <span style={{ color: "var(--purple-edge)" }}>{APP_NAME_ACC}</span>
      </motion.h1>
      <motion.p {...rise(0.36)} className="mt-3 text-[13.5px] font-bold leading-snug" style={{ color: "rgba(32,28,24,.7)" }}>
        Это приложение позволяет сделать процесс оказания и получения психологической помощи наглядным, интерактивным и удобным.
      </motion.p>

      {/* Свитч: лавандовая плашка едет к выбранной половине */}
      <motion.div {...rise(0.48)} className="relative mt-5 grid grid-cols-2 rounded-full bg-white p-1" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
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
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.role}
          initial={{ opacity: 0, x: index === 0 ? -14 : 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: index === 0 ? 14 : -14 }}
          transition={{ duration: 0.24, ease: EASE }}
          className="mt-4 space-y-2.5"
        >
          {active.bullets.map((b, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[13px] font-bold leading-snug text-[var(--ink)]">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white" style={{ border: "1.5px solid var(--purple-edge)" }}>
                <Icon name="check" width={12} weight="bold" color="var(--purple-edge)" />
              </span>
              {b}
            </div>
          ))}
        </motion.div>
      </AnimatePresence>

      <motion.div {...rise(0.6)} className="mt-auto pt-6">
        <button onClick={() => onPick(active.role)} className="btn btn-accent w-full py-3.5 text-[14px]">
          Продолжить как {active.title.replace("Я ", "")}
        </button>
        <p className="t-cap mt-2 text-center">Роль потом можно сменить в кабинете</p>
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

type FinishProps = { agreed: boolean; saving: boolean; onAgree: () => void; onStart: () => void };

// Согласие даётся одной галочкой на последнем экране знакомства — общей для
// обеих веток.
function Consent({ agreed, onAgree }: { agreed: boolean; onAgree: () => void }) {
  return (
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
  );
}

// Финал ветки психолога — тарифы: что открыто бесплатно и что даёт PRO.
function PsySell({ agreed, saving, onAgree, onStart }: FinishProps) {
  const rows: { icon: IconName; label: string; free: string; pro: string }[] = [
    { icon: "users", label: "Клиенты", free: `до ${FREE_CLIENT_LIMIT}`, pro: "без лимита" },
    { icon: "calendar", label: "Записи и расписание", free: "всё", pro: "всё" },
    { icon: "note", label: "Задания и заметки", free: "всё", pro: "всё" },
    { icon: "chart", label: "Статистика работы", free: "всё", pro: "всё" },
    { icon: "compass", label: "Анкета в каталоге специалистов", free: "бесплатно", pro: "бесплатно" },
    { icon: "check", label: "Подтверждение новых записей", free: `в пределах ${FREE_CLIENT_LIMIT}`, pro: "любых" },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pb-4 pt-4">
        <div className="flex items-center gap-3">
          <span className="ico ico-accent h-12 w-12 shrink-0"><Icon name="users" width={23} weight="bold" color="#fff" /></span>
          <div className="min-w-0">
            <p className="t-micro" style={{ color: "var(--purple-edge)" }}>Для психологов</p>
            <h1 className="font-tight mt-1 text-[clamp(22px,6vw,26px)] font-black leading-[1.04] text-[var(--ink)]">
              Начните вести практику <span style={{ color: "var(--purple-edge)" }}>уже сегодня</span>
            </h1>
          </div>
        </div>

        <div className="mt-4 rounded-[20px] p-4" style={{ background: "var(--purple-soft)" }}>
          <div className="flex items-start gap-3">
            <span className="ico ico-accent h-10 w-10 shrink-0"><Icon name="check" width={18} weight="bold" color="#fff" /></span>
            <div>
              <p className="t-head text-[var(--ink)]">{FREE_CLIENT_LIMIT} клиента бесплатно</p>
              <p className="t-sub mt-0.5">Все функции и место в каталоге доступны сразу. Как только анкету одобрят, каждый получает 14 дней PRO без лимитов — отсчёт со дня верификации.</p>
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

        <div className="mt-4"><PrivacyNote variant="psy" /></div>
      </div>
      <div className="pt-2">
        <Consent agreed={agreed} onAgree={onAgree} />
        <button
          onClick={() => { tap(); onStart(); }}
          disabled={!agreed || saving}
          className="btn btn-accent mt-3 w-full py-3.5 text-[14px] disabled:opacity-45"
        >
          <Icon name="spark" width={17} weight="fill" color="#fff" /> {saving ? "Сохраняем…" : "Начать бесплатно"}
        </button>
      </div>
    </div>
  );
}

// Финал ветки клиента: короткая сводка того, что открыто сразу.
const CLIENT_FINISH: { icon: IconName; title: string; text: string }[] = [
  { icon: "compass", title: "Каталог", text: "Познакомьтесь ближе с нашими специалистами в разделе «Каталог»" },
  { icon: "therapy", title: "Терапия", text: "Загляните в основной раздел «Терапия», чтобы пройти первую диагностику состояния и ежедневно отслеживать динамику" },
  { icon: "users", title: "Свой специалист", text: "Если вы уже находитесь в терапии — пригласите вашего специалиста. Если нет — мы поможем укрепить ментальное здоровье" },
];

function ClientFinish({ agreed, saving, onAgree, onStart }: FinishProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pb-4 pt-4">
        <div className="flex items-center gap-3">
          <span className="ico ico-accent h-12 w-12 shrink-0"><Icon name="heart" width={23} weight="bold" color="#fff" /></span>
          <div className="min-w-0">
            <p className="t-micro" style={{ color: "var(--purple-edge)" }}>Всё готово</p>
            <h1 className="font-tight mt-1 text-[clamp(22px,6vw,26px)] font-black leading-[1.04] text-[var(--ink)]">
              С чего можно <span style={{ color: "var(--purple-edge)" }}>начинать?</span>
            </h1>
          </div>
        </div>

        <div className="mt-5 space-y-3.5">
          {CLIENT_FINISH.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--purple-soft)]"><Icon name={item.icon} width={18} weight="bold" color="var(--purple-edge)" /></span>
              <span className="min-w-0">
                <span className="block text-[13px] font-black leading-tight">{item.title}</span>
                <span className="mt-0.5 block text-[11.5px] font-semibold leading-snug" style={{ color: "rgba(32,28,24,.6)" }}>{item.text}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5"><PrivacyNote variant="client" /></div>

        <SoonBanner />
      </div>
      <div className="pt-2">
        <Consent agreed={agreed} onAgree={onAgree} />
        <button
          onClick={() => { tap(); onStart(); }}
          disabled={!agreed || saving}
          className="btn btn-accent mt-3 w-full py-3.5 text-[14px] disabled:opacity-45"
        >
          {saving ? "Сохраняем…" : "Начать"}
        </button>
      </div>
    </div>
  );
}

const ROLE_OPTIONS: { role: Role; title: string; icon: IconName; bullets: ReactNode[] }[] = [
  {
    role: "client", title: "Я пользователь", icon: "heart",
    bullets: [
      "Подбирайте проверенных дипломированных специалистов",
      "Отмечайте своё состояние каждый день, чтобы ваш специалист находился с вами в контакте",
      "Пользуйтесь инструментами для самостоятельной практики и диагностики",
    ],
  },
  {
    role: "psychologist", title: "Я специалист", icon: "users",
    bullets: [
      "Управляйте записями, расписанием и направляйте автоматические напоминания о встрече",
      "Пользуйтесь карточкой клиента, в которой видно статистику и подробности о состоянии",
      <>
        Размещайте свою анкету в каталоге и получайте клиентов{" "}
        <span style={{ color: "var(--purple-edge)" }}>без комиссии</span> за сессии
      </>,
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

// Запись в свободное окно и автоматическое напоминание.
function ScheduleMock() {
  return (
    <div className="space-y-2">
      <Box tone="var(--tiffany-soft)" edge="var(--tiffany-edge)">
        <div className="flex items-center justify-between"><Bar w="40%" h={6} tone="rgba(32,28,24,.3)" /><span className="text-[7px] font-black uppercase text-[var(--muted)]">вторник</span></div>
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          {["10:00", "11:30", "15:00", "18:00"].map((slot, i) => (
            <span key={slot} className="rounded-[7px] py-1 text-center text-[6.5px] font-black" style={{ background: i === 3 ? "var(--ink)" : "#fff", color: i === 3 ? "#fff" : "var(--ink)", border: "1.5px solid rgba(32,28,24,.16)" }}>{slot}</span>
          ))}
        </div>
      </Box>
      <Box>
        <span className="flex items-center gap-1"><Icon name="bell" width={9} weight="bold" color="var(--tiffany-edge)" /><Bar w="46%" h={5} tone="rgba(32,28,24,.3)" /></span>
        <p className="mt-1 text-[7.5px] font-black leading-tight">Напоминание клиенту отправлено · за 2 часа</p>
      </Box>
      <Box tone="var(--olive-soft)" edge="var(--olive-edge)">
        <span className="flex items-center gap-1"><Icon name="swap" width={9} weight="bold" /><Bar w="50%" h={5} tone="rgba(32,28,24,.3)" /></span>
        <p className="mt-1 text-[7.5px] font-black leading-tight">Перенос согласован без переписки</p>
      </Box>
    </div>
  );
}

// Своя карточка в каталоге и кнопка записи в ней.
function ListingMock() {
  return (
    <div className="space-y-2">
      <Box tone="var(--amber-soft)" edge="var(--amber-edge)">
        <div className="flex gap-1.5">
          <span className="h-[38px] w-[32px] shrink-0 rounded-[8px] bg-white" style={{ border: "1.5px solid var(--amber-edge)" }} />
          <div className="flex-1 space-y-1 pt-0.5">
            <Bar w="72%" h={6} tone="rgba(32,28,24,.32)" />
            <span className="flex items-center gap-1"><Icon name="seal" width={8} weight="bold" color="var(--green-edge)" /><Bar w="52%" h={4} /></span>
            <div className="flex gap-1">{["КПТ", "тревога"].map((l) => <span key={l} className="rounded-full bg-white px-1.5 py-[1px] text-[6px] font-black">{l}</span>)}</div>
          </div>
        </div>
      </Box>
      <Box>
        <div className="flex items-center justify-between"><Bar w="38%" h={5} tone="rgba(32,28,24,.3)" /><span className="text-[7px] font-black uppercase text-[var(--muted)]">ближайшее</span></div>
        <div className="mt-1.5 flex gap-1">{["ср 12:00", "чт 16:00"].map((slot) => <span key={slot} className="flex-1 rounded-[7px] bg-white py-1 text-center text-[6.5px] font-black" style={{ border: "1.5px solid rgba(32,28,24,.16)" }}>{slot}</span>)}</div>
      </Box>
      <div className="rounded-full py-1 text-center text-[8px] font-black text-white" style={{ background: "var(--ink)" }}>Записаться</div>
    </div>
  );
}

// Отзыв приходит только от того, кто был на сессии.
function ReviewsMock() {
  return (
    <div className="space-y-2">
      <Box tone="var(--green-soft)" edge="var(--green-edge)">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-[2px]">{[0, 1, 2, 3, 4].map((i) => <Icon key={i} name="star" width={9} weight="fill" color="var(--green-edge)" />)}</span>
          <span className="text-[8px] font-black">4.9</span>
        </div>
        <span className="mt-1 flex items-center gap-1"><Icon name="seal" width={8} weight="bold" color="var(--green-edge)" /><span className="text-[6.5px] font-black uppercase text-[var(--muted)]">был на 6 сессиях</span></span>
      </Box>
      <Box>
        <Bar w="86%" h={4} />
        <span className="mt-1 block"><Bar w="64%" h={4} /></span>
        <span className="mt-1.5 flex items-center gap-1"><Icon name="lock" width={8} weight="bold" color="var(--muted)" /><span className="text-[6.5px] font-black text-[var(--muted)]">оценка недоступна без встречи</span></span>
      </Box>
      <Box tone="var(--purple-soft)" edge="var(--purple-edge)">
        <p className="text-[7.5px] font-black leading-tight">Подбор по совпадению с запросом, а не по оплате</p>
      </Box>
    </div>
  );
}

// Фиксированная плата вместо процента со встреч.
function PriceMock() {
  return (
    <div className="space-y-2">
      <Box tone="var(--coral-soft)" edge="var(--coral-edge)">
        <div className="flex items-center justify-between"><span className="text-[7px] font-black uppercase text-[var(--muted)]">комиссия с сессии</span><span className="text-[13px] font-black leading-none">0 ₽</span></div>
      </Box>
      <Box>
        <Bar w="52%" h={5} tone="rgba(32,28,24,.3)" />
        <div className="mt-1.5 space-y-1">
          {[["Сессия 4 000 ₽", "вам 4 000 ₽"], ["Сессия 6 000 ₽", "вам 6 000 ₽"]].map(([left, right]) => (
            <span key={left} className="flex items-center justify-between text-[6.5px] font-black">
              <span className="text-[var(--muted)]">{left}</span>
              <span>{right}</span>
            </span>
          ))}
        </div>
      </Box>
      <Box tone="var(--olive-soft)" edge="var(--olive-edge)">
        <span className="flex items-center gap-1"><Icon name="check" width={9} weight="bold" color="var(--olive-edge)" /><p className="text-[7.5px] font-black leading-tight">Фиксированная подписка за инструмент</p></span>
      </Box>
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
