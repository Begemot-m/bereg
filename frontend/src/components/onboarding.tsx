"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { MoodEgg } from "@/components/mood-egg";
import { Button } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { select, success, tap } from "@/lib/haptics";
import { completeOnboarding, tgUser } from "@/lib/profile";
import { setRole, type Role } from "@/lib/role";

const EASE = [0.16, 1, 0.3, 1] as const;

type Slide = { key: string; title: string; lead: string; icon: IconName; tone: string; screen: ReactNode; note?: string };

export function Onboarding() {
  const [role, setLocalRole] = useState<Role | null>(null);
  const [index, setIndex] = useState(0);
  const tg = tgUser();
  const slides = role ? SLIDES[role] : [];
  const last = index === slides.length - 1;

  const finish = () => { success(); completeOnboarding(); };
  const next = () => { if (last) finish(); else { select(); setIndex(index + 1); } };
  const back = () => { tap(); if (index === 0) { setLocalRole(null); setIndex(0); } else setIndex(index - 1); };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--page)" }} data-accent="purple">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-8 pt-7">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[15px] font-black text-[var(--bg)] stroke" style={{ background: "var(--ink)" }}>{APP_NAME.charAt(0)}</span>
          <div className="flex flex-1 gap-1.5">
            {(role ? slides : [null]).map((_, itemIndex) => (
              <span key={itemIndex} className="h-2 flex-1 rounded-full stroke transition-colors duration-300" style={{ background: role && itemIndex <= index ? "var(--purple)" : "#fff" }} />
            ))}
          </div>
          {role && <button onClick={finish} className="shrink-0 text-[11px] font-black text-[var(--muted-2)] hover:text-[var(--ink)]">Пропустить</button>}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={role ? `${role}-${index}` : "role"}
            initial={{ opacity: 0, x: 22 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -22 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="flex flex-1 flex-col"
          >
            {!role ? (
              <RoleStep firstName={tg?.first_name} onPick={(picked) => { select(); setLocalRole(picked); setRole(picked); setIndex(0); }} />
            ) : (
              <SlideView slide={slides[index]} />
            )}
          </motion.div>
        </AnimatePresence>

        {role && (
          <div className="mt-6 flex gap-2">
            <Button variant="soft" onClick={back}>Назад</Button>
            <Button className="flex-1" onClick={next}>{last ? "Начать" : "Дальше"}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleStep({ firstName, onPick }: { firstName?: string; onPick: (role: Role) => void }) {
  const roles: { role: Role; title: string; desc: string; icon: IconName; fill: string }[] = [
    { role: "psychologist", title: "Я психолог", desc: "Веду практику: клиенты, записи, задания", icon: "users", fill: "fill-green" },
    { role: "client", title: "Я в терапии или ищу специалиста", desc: "Отслеживать состояние и работать с психологом", icon: "heart", fill: "fill-purple" },
    { role: "guest", title: "Просто смотрю", desc: "Осмотрюсь, роль выберу позже", icon: "compass", fill: "fill-amber" },
  ];
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="font-tight text-[31px] font-extrabold leading-[1.06]">
        {firstName ? `${firstName}, это` : "Это"} {APP_NAME} —<br />среда психологической<br />помощи
      </h1>
      <p className="mt-3 text-[14px] font-semibold leading-snug text-[var(--muted)]">
        Психолог ведёт практику, человек находит своего специалиста, и между встречами обе стороны видят, что на самом деле меняется.
      </p>
      <p className="mt-5 text-[11px] font-black uppercase tracking-[.1em] text-[var(--muted-2)]">Кто вы здесь?</p>
      <div className="mt-2.5 space-y-3">
        {roles.map((item, itemIndex) => (
          <motion.button
            key={item.role}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 + itemIndex * 0.07, duration: 0.4, ease: EASE }}
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

function SlideView({ slide }: { slide: Slide }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex justify-center py-1"><Phone tone={slide.tone}>{slide.screen}</Phone></div>
      <div className="mt-5 flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] stroke" style={{ background: slide.tone }}><Icon name={slide.icon} width={20} weight="bold" /></span>
        <h2 className="font-tight text-[23px] font-black leading-[1.08]">{slide.title}</h2>
      </div>
      <p className="mt-2.5 text-[13.5px] font-semibold leading-relaxed text-[var(--muted)]">{slide.lead}</p>
      {slide.note && (
        <p className="mt-3 rounded-[14px] px-3 py-2.5 text-[11.5px] font-bold leading-relaxed" style={{ background: "var(--surface-2)", border: "var(--bw) solid var(--edge-neutral)" }}>{slide.note}</p>
      )}
    </div>
  );
}

// Схематичный экран приложения — понятнее скриншота и не устаревает при правках вёрстки.
function Phone({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <div className="w-[188px] overflow-hidden rounded-[26px] bg-white p-2 stroke-lg" style={{ boxShadow: "0 24px 44px -26px rgba(32,28,24,.5)" }}>
      <div className="overflow-hidden rounded-[19px]" style={{ background: tone }}>
        <div className="flex items-center gap-1 px-2.5 pb-1.5 pt-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--ink)] opacity-40" />
          <span className="h-1 w-8 rounded-full bg-[var(--ink)] opacity-20" />
        </div>
        <div className="min-h-[214px] rounded-t-[16px] bg-[#fffdf7] p-2.5" style={{ borderTop: "1.5px solid rgba(32,28,24,.14)" }}>{children}</div>
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

// ——— Экраны-макеты ———

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

const ChecklistScreen = (
  <div className="space-y-1">
    {["Фото и имя", "Запросы, с которыми работаете", "Основной метод", "Формат и город", "Цена и длительность", "Опыт и образование", "Рассказ о себе"].map((label, index) => (
      <div key={label} className="flex items-center gap-1.5 rounded-[9px] bg-white p-1.5" style={{ border: `1.5px solid ${index < 2 ? "var(--green-edge)" : "rgba(32,28,24,.16)"}` }}>
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-black" style={{ background: index < 2 ? "var(--green)" : "#fff", border: "1.5px solid rgba(32,28,24,.2)" }}>{index < 2 ? "✓" : ""}</span>
        <span className="text-[7.5px] font-black">{label}</span>
      </div>
    ))}
  </div>
);

// ——— Слайды по ролям ———

const SLIDES: Record<Role, Slide[]> = {
  psychologist: [
    {
      key: "schedule",
      title: "Практика без пяти чатов",
      lead: "Вы задаёте рабочие окна — клиенты сами занимают свободные. Перенос и отмена приходят уведомлением, а не сообщением, которое легко потерять.",
      icon: "calendar", tone: "var(--green-soft)", screen: ScheduleScreen,
    },
    {
      key: "client",
      title: "Видно, что между встречами",
      lead: "В карточке клиента — сколько встреч и часов пройдено, как менялось состояние, что с домашними заданиями. Опора и для сессии, и для супервизии.",
      icon: "users", tone: "var(--purple-soft)", screen: ClientCardScreen,
    },
    {
      key: "profile",
      title: "Клиенты находят вас по параметрам",
      lead: "Каталог подбирает специалиста под запрос человека. Каждое поле анкеты — это фильтр: запрос, метод, формат, город, бюджет, опыт, язык.",
      icon: "compass", tone: "var(--amber-soft)", screen: ProfileScreen,
      note: "Заполнять прямо сейчас не нужно. Осмотритесь, а анкету откроете в Кабинете, когда будет время — черновик сохраняется сам.",
    },
    {
      key: "todo",
      title: "Что понадобится для каталога",
      lead: "Семь коротких шагов: Кабинет → «Редактировать профиль». Пока анкета не закончена, профиль виден только вам — в каталог он не попадает.",
      icon: "check", tone: "var(--green-soft)", screen: ChecklistScreen,
      note: "Начать лучше с рабочих окон в разделе «Сессии»: без них клиент не сможет записаться, даже найдя вас.",
    },
  ],
  client: [
    {
      key: "mood",
      title: "Отмечайте, как вы сегодня",
      lead: "Полминуты в день: покрутите диск и выберите, что именно чувствуете. Эмоции — базовые, из научной классификации, а не «хорошо / плохо».",
      icon: "mood", tone: "var(--amber-soft)", screen: MoodScreen,
    },
    {
      key: "catalog",
      title: "Найдите своего специалиста",
      lead: "Короткий подбор по запросу, формату, бюджету и опыту — и вы видите тех, кто действительно подходит, с ближайшими свободными окнами.",
      icon: "compass", tone: "var(--salmon-soft)", screen: CatalogScreen,
    },
    {
      key: "tools",
      title: "Инструменты между сессиями",
      lead: "Дыхание, работа с мыслями, заземление, короткие опросники — тогда, когда тяжело, а до встречи ещё несколько дней.",
      icon: "tools", tone: "var(--coral-soft)", screen: ToolsScreen,
    },
    {
      key: "dynamics",
      title: "Видно, как меняется терапия",
      lead: "График настроения, календарь по дням и частые эмоции. Терапевт видит ту же картину — на сессии не приходится вспоминать, каким был месяц.",
      icon: "chart", tone: "var(--purple-soft)", screen: DynamicsScreen,
    },
  ],
  guest: [
    {
      key: "catalog",
      title: "Посмотрите каталог",
      lead: "Специалисты с подходами, ценами и свободными окнами. Без обязательств — просто чтобы понять, кто вообще есть.",
      icon: "compass", tone: "var(--salmon-soft)", screen: CatalogScreen,
    },
    {
      key: "tools",
      title: "Попробуйте инструменты",
      lead: "Практики самопомощи доступны сразу: дыхание, работа с мыслями, заземление.",
      icon: "tools", tone: "var(--coral-soft)", screen: ToolsScreen,
    },
    {
      key: "role",
      title: "Роль можно сменить в любой момент",
      lead: "В Кабинете переключитесь на психолога или клиента — интерфейс перестроится под вас.",
      icon: "user", tone: "var(--purple-soft)", screen: ProfileScreen,
    },
  ],
};
