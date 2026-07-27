"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { asset } from "@/lib/asset";
import { APP_NAME } from "@/lib/brand";
import { select, success, tap } from "@/lib/haptics";
import { completeOnboarding, tgUser } from "@/lib/profile";
import { setRole, type Role } from "@/lib/role";

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
    bg: "var(--amber)", soft: "var(--amber-soft)", tone: "var(--amber-edge)",
    points: ["Найти своего специалиста", "Отслеживать динамику настроения и сессий", "Самостоятельная помощь на каждый день"],
    img: "/onboarding/intro-1.webp", mock: <OverviewMock />,
  },
  {
    key: "catalog", kicker: "каталог", title: "Умный подбор специалистов",
    bg: "var(--green)", soft: "var(--green-soft)", tone: "var(--green-edge)",
    points: ["Персональный подбор вместо рейтинга", "Честные отзывы после встреч", "Удобный поиск по запросу"],
    img: "/onboarding/intro-2.webp", mock: <CatalogMock />,
  },
  {
    key: "tools", kicker: "практики", title: "Самостоятельные практики и база знаний",
    bg: "var(--coral)", soft: "var(--coral-soft)", tone: "var(--coral-edge)",
    points: ["Подберём лучшие практики между сессиями", "С отслеживанием настроения", "Дыхание, дневники, колесо баланса"],
    img: "/onboarding/intro-3.webp", mock: <ToolsMock />,
  },
  {
    key: "psy", kicker: "для психологов", title: "Удобная работа с клиентами",
    bg: "var(--purple)", soft: "var(--purple-soft)", tone: "var(--purple-edge)",
    points: ["Формирование свободных окон для записи", "CRM-система для ведения клиентов", "Напоминания о встречах"],
    img: "/onboarding/intro-4.webp", mock: <ScheduleMock />,
  },
];

export function Onboarding() {
  const [step, setStep] = useState(0); // 0..3 — интро, 4 — выбор роли
  const tg = tgUser();
  const isRole = step === INTRO.length;
  const cur = INTRO[step];

  const finish = () => { success(); completeOnboarding(); };
  const next = () => { select(); setStep((s) => Math.min(INTRO.length, s + 1)); };
  const back = () => { tap(); setStep((s) => Math.max(0, s - 1)); };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" data-accent="purple" style={{ background: isRole ? "#fbf8ef" : cur.bg, transition: "background-color .5s ease" }}>
      {/* Декоративные заливки-круги для «постерного» объёма */}
      {!isRole && (
        <>
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-40" style={{ background: "#fff" }} />
          <span aria-hidden className="pointer-events-none absolute -left-20 top-1/3 h-52 w-52 rounded-full opacity-20" style={{ background: cur.tone }} />
        </>
      )}

      <div className="relative mx-auto flex h-full w-full max-w-md flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+22px)] pt-[calc(env(safe-area-inset-top)+18px)]">
        {/* Верх: логотип + прогресс + пропустить */}
        <div className="flex items-center gap-3">
          <span className="flex h-7 items-center rounded-[9px] bg-[var(--ink)] px-2 text-[12px] font-black text-[var(--bg)]">{APP_NAME}</span>
          <div className="flex flex-1 gap-1.5">
            {INTRO.map((_, k) => <span key={k} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ background: k <= step ? "var(--ink)" : "rgba(32,28,24,.2)" }} />)}
          </div>
          <button onClick={finish} className="shrink-0 text-[11px] font-black" style={{ color: "rgba(32,28,24,.6)" }}>Пропустить</button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={isRole ? "role" : cur.key}
            initial={{ opacity: 0, x: 26 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -26 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="flex flex-1 flex-col"
          >
            {isRole ? (
              <RolePicker firstName={tg?.first_name} onPick={(r) => { select(); setRole(r); finish(); }} />
            ) : (
              <div className="flex flex-1 flex-col">
                <span className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em]" style={{ color: cur.tone, border: `1.5px solid ${cur.tone}` }}>{cur.kicker}</span>
                <h1 className="font-tight mt-3 text-[27px] font-black leading-[1.08]">{cur.title}</h1>
                <ul className="mt-4 space-y-2">
                  {cur.points.map((p, i) => (
                    <motion.li key={p} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.06 }} className="flex items-start gap-2.5 text-[13.5px] font-bold leading-snug">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white" style={{ border: `1.5px solid ${cur.tone}` }}><Icon name="check" width={12} weight="bold" color={cur.tone} /></span>
                      {p}
                    </motion.li>
                  ))}
                </ul>
                {/* «Арт»-зона: макет элемента приложения на мягкой цветной подложке */}
                <div className="relative flex min-h-0 flex-1 items-center justify-center py-3">
                  <span aria-hidden className="pointer-events-none absolute h-[300px] w-[300px] rounded-full" style={{ background: cur.soft, opacity: 0.75 }} />
                  <span aria-hidden className="pointer-events-none absolute bottom-2 h-24 w-52 rounded-full blur-2xl" style={{ background: cur.tone, opacity: 0.25 }} />
                  <Shot src={cur.img} tone={cur.tone}>{cur.mock}</Shot>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Низ: назад + стрелка (на интро-экранах) */}
        {!isRole && (
          <div className="flex items-center justify-between">
            <button onClick={back} disabled={step === 0} className="flex h-11 items-center gap-1 px-2 text-[13px] font-black disabled:opacity-0" style={{ color: "rgba(32,28,24,.6)" }} aria-label="Назад">‹ Назад</button>
            <motion.button onClick={next} whileTap={{ scale: 0.9 }} className="flex h-14 w-14 items-center justify-center rounded-full stroke-lg" style={{ background: "var(--ink)", color: "#fff", boxShadow: "0 12px 24px -10px rgba(32,28,24,.5)" }} aria-label="Дальше"><span className="text-[24px] leading-none">→</span></motion.button>
          </div>
        )}
      </div>
    </div>
  );
}

// Экран выбора роли: фиолетовый залив сверху, кнопки — ниже, под рукой.
function RolePicker({ firstName, onPick }: { firstName?: string; onPick: (role: Role) => void }) {
  const roles: { role: Role; title: string; icon: IconName; fill: string }[] = [
    { role: "psychologist", title: "Я психолог", icon: "users", fill: "fill-green" },
    { role: "client", title: "Я ищу специалиста", icon: "heart", fill: "fill-purple" },
    { role: "guest", title: "Я хочу заниматься сам", icon: "compass", fill: "fill-amber" },
  ];
  return (
    <div className="flex flex-1 flex-col">
      {/* Фиолетовый залив */}
      <div className="mt-4 rounded-[26px] p-6 pb-8" style={{ background: "var(--purple)", border: "var(--bw-lg) solid var(--purple-edge)" }}>
        <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white stroke"><Icon name="therapy" width={22} weight="fill" /></span>
        <h1 className="font-tight mt-4 text-[27px] font-black leading-[1.08]">{firstName ? `${firstName}, с чего` : "С чего"}<br />начнём?</h1>
        <p className="mt-2 text-[13px] font-semibold leading-snug" style={{ color: "rgba(32,28,24,.66)" }}>Покажем то, что важно именно вам. Роль можно сменить в любой момент.</p>
      </div>

      {/* Кнопки — ниже залива, в зоне большого пальца */}
      <div className="mt-auto space-y-3 pt-6">
        {roles.map((item, k) => (
          <motion.button
            key={item.role}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + k * 0.07, duration: 0.4, ease: EASE }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPick(item.role)}
            className={`chunk ${item.fill} flex w-full items-center gap-3.5 p-4 text-left`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-white stroke"><Icon name={item.icon} width={22} weight="regular" color="var(--ink)" /></span>
            <span className="flex-1 text-[16px] font-black">{item.title}</span>
            <span className="text-[18px] font-black text-[var(--muted-2)]">›</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// Слот под реальный скрин; если файла нет — макет элемента приложения в рамке телефона.
function Shot({ src, tone, children }: { src?: string; tone: string; children: ReactNode }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset(src)} alt="" onError={() => setBroken(true)} className="max-h-full w-auto object-contain drop-shadow-[0_24px_44px_rgba(32,28,24,0.4)]" />;
  }
  return <Phone tone={tone}>{children}</Phone>;
}

function Phone({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <div className="relative w-[214px] overflow-hidden rounded-[30px] bg-white p-2.5" style={{ boxShadow: "0 30px 52px -22px rgba(32,28,24,.6)", border: `var(--bw-lg) solid ${tone}` }}>
      <div className="overflow-hidden rounded-[22px] bg-white" style={{ border: "1.5px solid rgba(32,28,24,.12)" }}>
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
  <div className="rounded-[11px] p-2" style={{ background: tone, border: `1.5px solid ${edge}` }}>{children}</div>
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
          {[10, 16, 12, 20, 26, 22, 30].map((height, i) => <span key={i} className="w-[7px] rounded-full" style={{ height, background: i > 3 ? "var(--green)" : "var(--amber)", border: "1px solid rgba(32,28,24,.18)" }} />)}
        </div>
      </Box>
      <div className="grid grid-cols-2 gap-1.5">
        <Box tone="var(--green-soft)" edge="var(--green-edge)"><span className="block text-center text-[13px] font-black leading-none">12</span><span className="mt-1 block text-center text-[6px] font-black uppercase text-[var(--muted)]">встреч</span></Box>
        <Box tone="var(--purple-soft)" edge="var(--purple-edge)"><span className="block text-center text-[13px] font-black leading-none">9 ч</span><span className="mt-1 block text-center text-[6px] font-black uppercase text-[var(--muted)]">всего</span></Box>
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
          <div key={i} className="rounded-[10px] p-1.5" style={{ background: color as string, border: "1.5px solid rgba(32,28,24,.18)" }}>
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
        <div key={time} className="flex items-center gap-1.5 rounded-[10px] p-1.5" style={{ background: bg, border: `1.5px solid ${edge}` }}>
          <span className="text-[8px] font-black">{time}</span><span className="flex-1 text-[7px] font-bold text-[var(--muted)]">{who}</span>
        </div>
      ))}
      <div className="flex items-center gap-1 rounded-[9px] bg-[var(--amber-soft)] p-1.5" style={{ border: "1.5px solid var(--amber-edge)" }}><Icon name="bell" width={9} weight="bold" /><span className="text-[7px] font-black">Напоминание за час</span></div>
    </div>
  );
}
