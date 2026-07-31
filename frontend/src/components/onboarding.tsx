"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { APP_NAME } from "@/lib/brand";
import { select, success, tap } from "@/lib/haptics";
import { completeOnboarding, tgUser } from "@/lib/profile";
import { setRole, type Role } from "@/lib/role";
import { FREE_CLIENT_LIMIT } from "@/lib/subscription";

const EASE = [0.16, 1, 0.3, 1] as const;

type Intro = {
  key: string;
  kicker: string;
  title: string;
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
    bg: "var(--olive-soft)", soft: "#f3f5df", tone: "var(--olive-edge)",
    points: ["Подберём лучшие практики между сессиями", "С отслеживанием настроения", "Дыхание, дневники, колесо баланса"],
    mock: <ToolsMock />,
  },
  {
    key: "psy", kicker: "для психологов", title: "Удобная работа с клиентами",
    bg: "var(--amber-soft)", soft: "#fff7df", tone: "var(--amber-edge)",
    points: ["Формирование свободных окон для записи", "CRM-система для ведения клиентов", "Напоминания о встречах"],
    mock: <ScheduleMock />,
  },
];

export function Onboarding() {
  const [step, setStep] = useState(0); // 0..3 — интро, 4 — выбор роли
  const [psySell, setPsySell] = useState(false); // после выбора «психолог» — продажа PRO
  const tg = tgUser();
  const swipeX = useRef<number | null>(null);
  const isRole = step === INTRO.length && !psySell;
  const cur = INTRO[step];

  const finish = () => { success(); completeOnboarding(); };
  const next = () => { select(); setStep((s) => Math.min(INTRO.length, s + 1)); };
  const back = () => { tap(); setStep((s) => Math.max(0, s - 1)); };
  const endSwipe = (x: number) => {
    const start = swipeX.current;
    swipeX.current = null;
    if (start == null || isRole || psySell) return;
    const delta = x - start;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) next(); else back();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" data-accent="purple" style={{ background: psySell ? "#ffffff" : isRole ? "var(--tiffany-soft)" : cur.bg, transition: "background-color .5s ease" }}>
      {/* Декоративные заливки-круги для «постерного» объёма */}
      {!isRole && !psySell && cur && (
        <>
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-40" style={{ background: "#fff" }} />
          <span aria-hidden className="pointer-events-none absolute -left-20 top-1/3 h-52 w-52 rounded-full opacity-20" style={{ background: cur.tone }} />
        </>
      )}

      {!isRole && !psySell && (
        <>
          <button type="button" onClick={back} disabled={step === 0} className="absolute bottom-16 left-0 top-[calc(var(--top-pad)+48px)] z-20 w-[15%] disabled:pointer-events-none" aria-label="Предыдущий экран" />
          <button type="button" onClick={next} className="absolute bottom-16 right-0 top-[calc(var(--top-pad)+48px)] z-20 w-[15%]" aria-label="Следующий экран" />
        </>
      )}

      <div className="relative mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-[calc(var(--safe-bottom)+18px)] pt-[var(--top-pad)] min-[360px]:px-5 min-[390px]:px-6 md:pt-8">
        {/* Верх: логотип + прогресс + пропустить */}
        <div className="flex items-center gap-3">
          <span className="flex h-7 items-center rounded-[8px] bg-[var(--ink)] px-2 text-[12px] font-black text-[var(--bg)]">{APP_NAME}</span>
          <div className="flex flex-1 gap-1.5">
            {INTRO.map((_, k) => <span key={k} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ background: k <= step ? "var(--ink)" : "rgba(32,28,24,.2)" }} />)}
          </div>
          <button onClick={finish} className="shrink-0 text-[11px] font-black" style={{ color: "rgba(32,28,24,.6)" }}>Пропустить</button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={psySell ? "psySell" : isRole ? "role" : cur.key}
            initial={{ opacity: 0, x: 26 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -26 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="relative flex min-h-0 flex-1 flex-col touch-pan-y"
            onPointerDown={(event) => { if (!isRole && !psySell) swipeX.current = event.clientX; }}
            onPointerUp={(event) => endSwipe(event.clientX)}
            onPointerCancel={() => { swipeX.current = null; }}
          >
            {psySell ? (
              <PsySell onStart={finish} />
            ) : isRole ? (
              <RolePicker firstName={tg?.first_name} onPick={(r) => { select(); setRole(r); if (r === "psychologist") setPsySell(true); else finish(); }} />
            ) : (
              <div className="flex flex-1 flex-col">
                <span className="mt-[clamp(12px,3vh,24px)] inline-flex w-fit items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em]" style={{ color: cur.tone, border: `1.5px solid ${cur.tone}` }}>{cur.kicker}</span>
                <h1 className="font-tight mt-3 text-[clamp(23px,7vw,27px)] font-black leading-[1.08]">{cur.title}</h1>
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
        {!isRole && !psySell && (
          <div className="relative z-30 flex items-center justify-between">
            <button onClick={back} disabled={step === 0} className="back-link disabled:opacity-0" style={{ color: cur.tone }} aria-label="Назад">Назад</button>
            <button onClick={next} className="back-link" style={{ color: cur.tone }} aria-label="Далее">Далее</button>
          </div>
        )}
      </div>
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
    { icon: "compass", label: "Каталог новых клиентов", free: "—", pro: "включён" },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pb-4 pt-4">
        <span className="ico ico-accent h-12 w-12"><Icon name="users" width={23} weight="bold" color="#fff" /></span>
        <p className="t-micro mt-3" style={{ color: "var(--purple-edge)" }}>Для психологов</p>
        <h1 className="font-tight mt-1 text-[clamp(25px,7vw,30px)] font-black leading-[1.02] text-[var(--ink)]">
          Больше клиентов<br /><span style={{ color: "var(--purple-edge)" }}>без лимитов</span>
        </h1>

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
      </div>
      <div className="pt-2">
        <button onClick={() => { tap(); onStart(); }} className="btn btn-accent w-full py-3.5 text-[14px]"><Icon name="plus" width={17} weight="bold" color="#fff" /> Начать бесплатно</button>
      </div>
    </div>
  );
}

function RolePicker({ firstName, onPick }: { firstName?: string; onPick: (role: Role) => void }) {
  const roles: { role: Role; title: string; text: string; icon: IconName; tone: string }[] = [
    { role: "psychologist", title: "Я психолог", text: "Клиенты, записи и практика", icon: "users", tone: "purple" },
    { role: "client", title: "Я ищу специалиста", text: "Подбор и сопровождение", icon: "heart", tone: "tiffany" },
    { role: "guest", title: "Я занимаюсь сам", text: "Практики и наблюдения", icon: "compass", tone: "olive" },
  ];
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--purple-edge)]"><Icon name="therapy" width={24} weight="fill" color="#fff" /></span>
        <h1 className="font-tight mt-4 text-[27px] font-black leading-[1.08] text-[var(--ink)]">{firstName ? `${firstName}, с чего` : "С чего"}<br />начнём?</h1>
        <p className="mt-2 text-[13px] font-semibold leading-snug" style={{ color: "rgba(32,28,24,.66)" }}>Покажем то, что важно именно вам. Роль можно сменить в любой момент.</p>
      </div>

      <div className="mt-5">
        {roles.map((item, k) => (
          <motion.button
            key={item.role}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + k * 0.07, duration: 0.4, ease: EASE }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPick(item.role)}
            className={`flex w-full items-center gap-3 py-4 text-left ${k ? "line-top" : ""}`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]" style={{ background: `var(--${item.tone}-edge)` }}><Icon name={item.icon} width={21} weight="bold" color="#fff" /></span>
            <span className="min-w-0 flex-1"><span className="t-head block text-[var(--ink)]">{item.title}</span><span className="t-sub mt-0.5 block">{item.text}</span></span>
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: `var(--${item.tone}-soft)`, border: `2px solid var(--${item.tone}-edge)` }} />
          </motion.button>
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

function ScheduleMock() {
  return (
    <div className="space-y-2">
      <div className="flex justify-between">{["пн", "вт", "ср", "чт", "пт"].map((d, i) => <span key={d} className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[7px] font-black" style={{ background: i === 2 ? "var(--ink)" : "#fff", color: i === 2 ? "#fff" : "var(--muted)", border: "1.5px solid rgba(32,28,24,.16)" }}>{d}</span>)}</div>
      {([["10:00", "var(--green-soft)", "var(--green-edge)", "свободно"], ["13:30", "var(--purple-soft)", "var(--purple-edge)", "Марина"], ["18:00", "#fff", "rgba(32,28,24,.16)", "свободно"]] as const).map(([time, bg, edge, who]) => (
        <div key={time} className="flex items-center gap-1.5 rounded-[9px] p-1.5" style={{ background: bg, border: `1.5px solid ${edge}` }}>
          <span className="text-[8px] font-black">{time}</span><span className="flex-1 text-[7px] font-bold text-[var(--muted)]">{who}</span>
        </div>
      ))}
      <div className="flex items-center gap-1 rounded-[8px] bg-[var(--amber-soft)] p-1.5" style={{ border: "1.5px solid var(--amber-edge)" }}><Icon name="bell" width={9} weight="bold" /><span className="text-[7px] font-black">Напоминание за час</span></div>
    </div>
  );
}
