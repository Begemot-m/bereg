"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { MoodEgg } from "@/components/mood-egg";
import { asset } from "@/lib/asset";
import { APP_NAME } from "@/lib/brand";
import { select, success, tap } from "@/lib/haptics";
import { completeOnboarding, tgUser } from "@/lib/profile";
import { setRole, type Role } from "@/lib/role";

const EASE = [0.16, 1, 0.3, 1] as const;

// ——— Постер: крупная капс-подача + слот под картинку/скриншот ———

type Poster = {
  key: string;
  tone: string;      // фон постера
  dark?: boolean;    // тёмный фон → белый текст
  mark: string;      // цвет подчёркивания акцентного слова
  kicker: string;    // мелкая подпись сверху
  head: ReactNode;   // заголовок капсом (с <U> для акцента)
  img?: string;      // путь к картинке/скриншоту в /public (можно заменить)
  fallback: ReactNode;
};

// Акцентное слово с рукописным подчёркиванием.
function U({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      {children}
      <svg className="pointer-events-none absolute -bottom-1.5 left-0 w-full" height="12" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden>
        <path d="M2 7 Q 48 13 98 5" stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}

// Слот под изображение: если файла нет — показываем схематичный экран в рамке телефона.
function Shot({ src, tone, children }: { src?: string; tone: string; children: ReactNode }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={asset(src)} alt="" onError={() => setBroken(true)} className="max-h-full w-auto object-contain drop-shadow-[0_24px_44px_rgba(32,28,24,0.4)]" />
    );
  }
  return <Phone tone={tone}>{children}</Phone>;
}

export function Onboarding() {
  const [phase, setPhase] = useState<"intro" | "role" | "benefits">("intro");
  const [role, setLocalRole] = useState<Role | null>(null);
  const [i, setIndex] = useState(0);
  const tg = tgUser();

  const posters = phase === "intro" ? INTRO : phase === "benefits" && role ? ROLE_POSTERS[role] : [];
  const cur = posters[i];
  const dark = phase === "role" ? false : cur?.dark;
  const tone = phase === "role" ? "var(--purple-soft)" : cur?.tone ?? "var(--amber)";

  const total = phase === "role" ? 0 : posters.length;
  const finish = () => { success(); completeOnboarding(); };

  const next = () => {
    if (phase === "intro") {
      if (i < INTRO.length - 1) { select(); setIndex(i + 1); }
      else { select(); setPhase("role"); setIndex(0); }
    } else if (phase === "benefits") {
      if (i < posters.length - 1) { select(); setIndex(i + 1); }
      else finish();
    }
  };
  const back = () => {
    tap();
    if (phase === "intro") { if (i > 0) setIndex(i - 1); }
    else if (phase === "role") { setPhase("intro"); setIndex(INTRO.length - 1); }
    else if (phase === "benefits") {
      if (i > 0) setIndex(i - 1);
      else { setPhase("role"); setLocalRole(null); setIndex(0); }
    }
  };

  const ink = dark ? "#fff" : "var(--ink)";
  const muted = dark ? "rgba(255,255,255,.72)" : "var(--muted)";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" data-accent="purple" style={{ background: tone, transition: "background-color .45s ease" }}>
      <div className="mx-auto flex h-full w-full max-w-md flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+22px)] pt-[calc(env(safe-area-inset-top)+18px)]">
        {/* Верх: прогресс + пропустить */}
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[13px] font-black stroke" style={{ background: dark ? "#fff" : "var(--ink)", color: dark ? "var(--ink)" : "var(--bg)" }}>{APP_NAME.charAt(0)}</span>
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: Math.max(total, 1) }).map((_, k) => (
              <span key={k} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ background: total && k <= i ? ink : dark ? "rgba(255,255,255,.28)" : "rgba(32,28,24,.16)" }} />
            ))}
          </div>
          <button onClick={finish} className="shrink-0 text-[11px] font-black" style={{ color: muted }}>Пропустить</button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={phase === "role" ? "role" : `${phase}-${i}`}
            initial={{ opacity: 0, x: 26 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -26 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="flex flex-1 flex-col"
          >
            {phase === "role" ? (
              <RolePicker firstName={tg?.first_name} onPick={(picked) => { select(); setLocalRole(picked); setRole(picked); setPhase("benefits"); setIndex(0); }} />
            ) : cur ? (
              <div className="flex flex-1 flex-col">
                <p className="mt-7 text-[11px] font-black uppercase tracking-[.18em]" style={{ color: muted }}>{cur.kicker}</p>
                <h1 className="font-tight mt-3 text-[33px] font-black uppercase leading-[1.05] tracking-[-0.01em]" style={{ color: ink }}>{cur.head}</h1>
                <div className="flex min-h-0 flex-1 items-center justify-center py-4">
                  <Shot src={cur.img} tone={cur.tone}>{cur.fallback}</Shot>
                </div>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>

        {/* Низ: назад + стрелка вперёд (постеры) */}
        {phase !== "role" && (
          <div className="flex items-center justify-between">
            <button onClick={back} className="flex h-11 items-center gap-1.5 px-2 text-[13px] font-black" style={{ color: muted }} aria-label="Назад">
              <span className="text-[18px]">‹</span> Назад
            </button>
            <motion.button
              onClick={next}
              whileTap={{ scale: 0.9 }}
              className="flex h-14 w-14 items-center justify-center rounded-full stroke-lg"
              style={{ background: dark ? "#fff" : "var(--ink)", color: dark ? "var(--ink)" : "#fff", boxShadow: "0 12px 24px -10px rgba(32,28,24,.5)" }}
              aria-label={phase === "benefits" && i === posters.length - 1 ? "Начать" : "Дальше"}
            >
              <span className="text-[24px] leading-none">→</span>
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}

function RolePicker({ firstName, onPick }: { firstName?: string; onPick: (role: Role) => void }) {
  const roles: { role: Role; title: string; desc: string; icon: IconName; fill: string }[] = [
    { role: "psychologist", title: "Я психолог", desc: "Веду практику: клиенты, записи, задания", icon: "users", fill: "fill-green" },
    { role: "client", title: "Я в терапии или ищу специалиста", desc: "Отслеживать состояние и работать с психологом", icon: "heart", fill: "fill-purple" },
    { role: "guest", title: "Просто смотрю", desc: "Осмотрюсь, роль выберу позже", icon: "compass", fill: "fill-amber" },
  ];
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="font-tight mt-8 text-[30px] font-black leading-[1.08]">{firstName ? `${firstName}, кто` : "Кто"} вы<br />здесь?</h1>
      <p className="mt-3 text-[13.5px] font-semibold leading-snug text-[var(--muted)]">Дальше покажем то, что важно именно вам. Роль можно сменить в любой момент.</p>
      <div className="mt-6 space-y-3">
        {roles.map((item, k) => (
          <motion.button
            key={item.role}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 + k * 0.07, duration: 0.4, ease: EASE }}
            onClick={() => onPick(item.role)}
            className={`chunk ${item.fill} flex w-full items-center gap-3.5 p-4 text-left transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] stroke" style={{ background: "#fff" }}>
              <Icon name={item.icon} width={22} weight="regular" color="var(--ink)" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-black leading-tight">{item.title}</span>
              <span className="mt-0.5 block text-[12px] font-semibold leading-snug" style={{ color: "rgba(32,28,24,.62)" }}>{item.desc}</span>
            </span>
            <span className="text-[18px] font-black text-[var(--muted-2)]">›</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// Рамка телефона под схематичный экран (fallback, пока нет реального скриншота).
function Phone({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <div className="w-[204px] overflow-hidden rounded-[28px] bg-white p-2 stroke-lg" style={{ boxShadow: "0 26px 46px -24px rgba(32,28,24,.5)" }}>
      <div className="overflow-hidden rounded-[21px]" style={{ background: tone }}>
        <div className="flex items-center gap-1 px-2.5 pb-1.5 pt-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--ink)] opacity-40" />
          <span className="h-1 w-8 rounded-full bg-[var(--ink)] opacity-20" />
        </div>
        <div className="min-h-[224px] rounded-t-[16px] bg-[#fffdf7] p-2.5" style={{ borderTop: "1.5px solid rgba(32,28,24,.14)" }}>{children}</div>
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

// ——— Схематичные экраны (fallback) ———

const MoodScreen = (
  <div className="space-y-2">
    <Box tone="var(--amber-soft)" edge="var(--amber-edge)">
      <div className="flex items-center gap-1.5">
        <MoodEgg value={4.4} size={30} still />
        <div className="flex-1 space-y-1"><Bar w="90%" h={6} tone="rgba(32,28,24,.3)" /><Bar w="60%" h={5} /></div>
      </div>
    </Box>
    <div className="flex justify-center"><MoodEgg value={4.6} size={58} still /></div>
    <div className="flex items-end justify-center gap-[3px]">
      {[10, 16, 12, 20, 26, 22, 30].map((height, index) => (
        <span key={index} className="w-[7px] rounded-full" style={{ height, background: index > 3 ? "var(--green)" : "var(--amber)", border: "1px solid rgba(32,28,24,.18)" }} />
      ))}
    </div>
    <div className="flex flex-wrap justify-center gap-1">
      {["радость", "опора", "интерес"].map((label) => (
        <span key={label} className="rounded-full px-1.5 py-0.5 text-[7px] font-black" style={{ background: "var(--green)", border: "1px solid var(--green-edge)" }}>{label}</span>
      ))}
    </div>
  </div>
);

const CatalogScreen = (
  <div className="space-y-2">
    <div className="flex gap-1">
      {["тревога", "онлайн", "до 4000"].map((label) => (
        <span key={label} className="rounded-full px-1.5 py-0.5 text-[7px] font-black" style={{ background: "var(--salmon-soft)", border: "1px solid var(--salmon-edge)" }}>{label}</span>
      ))}
    </div>
    {[0, 1].map((row) => (
      <Box key={row}>
        <div className="flex gap-1.5">
          <span className="h-[38px] w-[32px] shrink-0 rounded-[8px]" style={{ background: row ? "var(--purple-soft)" : "var(--green-soft)", border: "1.5px solid rgba(32,28,24,.16)" }} />
          <div className="flex-1 space-y-1 pt-0.5">
            <Bar w="80%" h={6} tone="rgba(32,28,24,.32)" />
            <Bar w="55%" h={5} />
            <Bar w="68%" h={5} />
          </div>
        </div>
      </Box>
    ))}
    <div className="rounded-full py-1 text-center text-[8px] font-black text-white" style={{ background: "var(--ink)" }}>Записаться</div>
  </div>
);

const ToolsScreen = (
  <div className="space-y-2">
    <Bar w="55%" h={7} tone="rgba(32,28,24,.3)" />
    <div className="grid grid-cols-2 gap-1.5">
      {["var(--green)", "var(--amber)", "var(--purple)", "var(--coral)"].map((color, index) => (
        <div key={index} className="rounded-[10px] p-1.5" style={{ background: color, border: "1.5px solid rgba(32,28,24,.18)" }}>
          <span className="block h-4 w-4 rounded-[6px] bg-white" style={{ border: "1.5px solid rgba(32,28,24,.18)" }} />
          <span className="mt-2 block"><Bar w="86%" h={5} tone="rgba(32,28,24,.32)" /></span>
          <span className="mt-1 block"><Bar w="58%" h={4} /></span>
        </div>
      ))}
    </div>
  </div>
);

const DynamicsScreen = (
  <div className="space-y-2">
    <Box>
      <Bar w="62%" h={6} tone="rgba(32,28,24,.3)" />
      <svg viewBox="0 0 100 34" className="mt-1.5 w-full" style={{ height: 34 }}>
        <path d="M2 26 C 14 26, 18 14, 30 16 S 48 26, 58 18 S 76 6, 96 9" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </Box>
    <Box>
      <div className="grid grid-cols-7 gap-[3px]">
        {Array.from({ length: 21 }).map((_, index) => (
          <span key={index} className="aspect-square rounded-[3px]" style={{ background: ["var(--mood-1)", "var(--mood-3)", "var(--mood-4)", "var(--mood-5)"][index % 4], border: "1px solid rgba(32,28,24,.14)" }} />
        ))}
      </div>
    </Box>
  </div>
);

const ScheduleScreen = (
  <div className="space-y-2">
    <div className="flex justify-between">
      {["пн", "вт", "ср", "чт", "пт"].map((day, index) => (
        <span key={day} className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[7px] font-black" style={{ background: index === 2 ? "var(--ink)" : "#fff", color: index === 2 ? "#fff" : "var(--muted)", border: "1.5px solid rgba(32,28,24,.16)" }}>{day}</span>
      ))}
    </div>
    {([["10:00", "var(--green-soft)"], ["13:30", "var(--amber-soft)"], ["18:00", "#fff"]] as const).map(([time, tone]) => (
      <div key={time} className="flex items-center gap-1.5 rounded-[10px] p-1.5" style={{ background: tone, border: "1.5px solid rgba(32,28,24,.16)" }}>
        <span className="text-[8px] font-black">{time}</span>
        <span className="flex-1"><Bar w="70%" h={5} /></span>
      </div>
    ))}
    <div className="rounded-full py-1 text-center text-[8px] font-black" style={{ background: "var(--amber)", border: "1.5px solid var(--amber-edge)" }}>Открыть окна</div>
  </div>
);

const ClientCardScreen = (
  <div className="space-y-2">
    <div className="flex items-center gap-1.5">
      <span className="h-7 w-7 rounded-full" style={{ background: "var(--purple-soft)", border: "1.5px solid rgba(32,28,24,.18)" }} />
      <div className="flex-1 space-y-1"><Bar w="70%" h={6} tone="rgba(32,28,24,.32)" /><Bar w="44%" h={4} /></div>
    </div>
    <div className="grid grid-cols-2 gap-1.5">
      <Box tone="var(--green-soft)" edge="var(--green-edge)"><span className="block text-center text-[13px] font-black leading-none">12</span><span className="mt-1 block text-center text-[6px] font-black uppercase text-[var(--muted)]">встреч</span></Box>
      <Box tone="var(--purple-soft)" edge="var(--purple-edge)"><span className="block text-center text-[13px] font-black leading-none">9 ч</span><span className="mt-1 block text-center text-[6px] font-black uppercase text-[var(--muted)]">всего</span></Box>
    </div>
    <Box>
      <svg viewBox="0 0 100 24" className="w-full" style={{ height: 24 }}>
        <path d="M2 18 C 16 18, 22 8, 34 11 S 54 18, 66 10 S 84 5, 98 7" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </Box>
    <div className="space-y-1">
      {[0, 1].map((row) => (
        <div key={row} className="flex items-center gap-1.5 rounded-[9px] bg-white p-1.5" style={{ border: "1.5px solid rgba(32,28,24,.16)" }}>
          <span className="h-3 w-3 rounded-[4px]" style={{ background: row ? "var(--green)" : "#fff", border: "1.5px solid rgba(32,28,24,.2)" }} />
          <Bar w="72%" h={5} />
        </div>
      ))}
    </div>
  </div>
);

const ProfileScreen = (
  <div className="space-y-1.5">
    <Box tone="var(--amber-soft)" edge="var(--amber-edge)">
      <Bar w="72%" h={6} tone="rgba(32,28,24,.32)" />
      <span className="mt-1.5 block h-2 rounded-full bg-white" style={{ border: "1.5px solid rgba(32,28,24,.16)" }}>
        <span className="block h-full rounded-full" style={{ width: "62%", background: "var(--amber)" }} />
      </span>
    </Box>
    {([["Фото и основное", true], ["Запросы клиентов", true], ["Методы работы", true], ["Условия встречи", false], ["Опыт и образование", false]] as const).map(([label, done]) => (
      <div key={label} className="flex items-center gap-1.5 rounded-[9px] bg-white p-1.5" style={{ border: "1.5px solid rgba(32,28,24,.16)" }}>
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-black" style={{ background: done ? "var(--green)" : "#fff", border: "1.5px solid rgba(32,28,24,.2)" }}>{done ? "✓" : ""}</span>
        <span className="text-[7.5px] font-black">{label}</span>
      </div>
    ))}
  </div>
);

// ——— Постеры ———

const INTRO: Poster[] = [
  {
    key: "intro-quality", tone: "var(--amber)", mark: "var(--coral-edge)", kicker: `${APP_NAME} · терапия и прогресс`,
    head: <>КАЧЕСТВЕННАЯ<br /><U color="var(--coral-edge)">РАБОТА</U> В ТЕРАПИИ</>,
    img: "/onboarding/intro-1.webp", fallback: ClientCardScreen,
  },
  {
    key: "intro-progress", tone: "var(--ink)", dark: true, mark: "var(--amber)", kicker: "видно, что меняется",
    head: <>ВИДНО КАЖДЫЙ<br />ШАГ <U color="var(--amber)">ПРОГРЕССА</U></>,
    img: "/onboarding/intro-2.webp", fallback: DynamicsScreen,
  },
];

const ROLE_POSTERS: Record<Role, Poster[]> = {
  psychologist: [
    {
      key: "psy-practice", tone: "var(--green)", mark: "var(--purple-edge)", kicker: "для психолога",
      head: <>ВСЯ ПРАКТИКА<br />В <U color="var(--purple-edge)">ОДНОМ</U> ЭКРАНЕ</>,
      img: "/onboarding/psy-1.webp", fallback: ScheduleScreen,
    },
    {
      key: "psy-between", tone: "var(--purple)", mark: "var(--green-edge)", kicker: "карточка клиента",
      head: <>ВИДНО, ЧТО<br /><U color="var(--green-edge)">МЕЖДУ</U> ВСТРЕЧАМИ</>,
      img: "/onboarding/psy-2.webp", fallback: ClientCardScreen,
    },
    {
      key: "psy-catalog", tone: "var(--amber)", mark: "var(--purple-edge)", kicker: "каталог · 500 ₽",
      head: <>КЛИЕНТЫ<br />НАХОДЯТ ВАС <U color="var(--purple-edge)">САМИ</U></>,
      img: "/onboarding/psy-3.webp", fallback: ProfileScreen,
    },
  ],
  client: [
    {
      key: "cl-mood", tone: "var(--amber)", mark: "var(--coral-edge)", kicker: "для вас",
      head: <>ОТМЕЧАЙТЕ,<br />КАК ВЫ <U color="var(--coral-edge)">СЕГОДНЯ</U></>,
      img: "/onboarding/cl-1.webp", fallback: MoodScreen,
    },
    {
      key: "cl-dynamics", tone: "var(--purple)", mark: "var(--green-edge)", kicker: "прогресс",
      head: <>ВИДНО, КАК<br /><U color="var(--green-edge)">МЕНЯЕТСЯ</U> ТЕРАПИЯ</>,
      img: "/onboarding/cl-2.webp", fallback: DynamicsScreen,
    },
    {
      key: "cl-tools", tone: "var(--coral)", mark: "var(--ink)", kicker: "между сессиями",
      head: <>ОПОРА, КОГДА<br /><U color="var(--ink)">ТЯЖЕЛО</U></>,
      img: "/onboarding/cl-3.webp", fallback: ToolsScreen,
    },
    {
      key: "cl-catalog", tone: "var(--green)", mark: "var(--purple-edge)", kicker: "каталог",
      head: <>НАЙДИТЕ<br /><U color="var(--purple-edge)">СВОЕГО</U> СПЕЦИАЛИСТА</>,
      img: "/onboarding/cl-4.webp", fallback: CatalogScreen,
    },
  ],
  guest: [
    {
      key: "guest-catalog", tone: "var(--green)", mark: "var(--purple-edge)", kicker: "осмотритесь",
      head: <>ПОСМОТРИТЕ<br /><U color="var(--purple-edge)">КАТАЛОГ</U></>,
      img: "/onboarding/cl-4.webp", fallback: CatalogScreen,
    },
    {
      key: "guest-tools", tone: "var(--coral)", mark: "var(--ink)", kicker: "без обязательств",
      head: <>ПОПРОБУЙТЕ<br /><U color="var(--ink)">ИНСТРУМЕНТЫ</U></>,
      img: "/onboarding/cl-3.webp", fallback: ToolsScreen,
    },
  ],
};
