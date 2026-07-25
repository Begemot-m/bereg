"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { APP_NAME } from "@/lib/brand";
import { select, success, tap } from "@/lib/haptics";
import { completeOnboarding, tgUser } from "@/lib/profile";
import { setRole, type Role } from "@/lib/role";

const EASE = [0.16, 1, 0.3, 1] as const;

const SKIN = "#f0c7a4";
const HAIR = "#2a2620";

type Poster = {
  key: string;
  tone: string;
  eyebrow: string;
  head: ReactNode;
  text: string;
  art: ReactNode;
};

export function Onboarding() {
  const [step, setStep] = useState(0);
  const tg = tgUser();
  const last = POSTERS.length;
  const poster = POSTERS[step];
  const tone = poster?.tone ?? "var(--purple)";

  const next = () => { select(); setStep(step + 1); };
  const back = () => { tap(); setStep(Math.max(0, step - 1)); };
  const skip = () => { select(); setStep(last); };

  const pick = (role: Role) => {
    success();
    setRole(role);
    completeOnboarding();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" data-accent="purple" style={{ background: "var(--bg)" }}>
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {poster ? (
              <>
                <Tone tone={tone}>
                  <Progress step={step} total={last + 1} onSkip={skip} />
                  <div className="flex flex-1 flex-col justify-center pb-2 text-center">
                    <p className="text-[11px] font-black uppercase tracking-[.2em]" style={{ color: "rgba(32,28,24,.6)" }}>{poster.eyebrow}</p>
                    <h1 className="font-tight mt-3 text-[38px] font-black leading-[1.02]">{poster.head}</h1>
                    <p className="mx-auto mt-4 max-w-[30ch] text-[14.5px] font-semibold leading-snug" style={{ color: "rgba(32,28,24,.72)" }}>{poster.text}</p>
                  </div>
                </Tone>

                <div className="relative flex flex-1 flex-col items-center justify-start pt-9">
                  <motion.button
                    onClick={next}
                    whileTap={{ scale: 0.94 }}
                    className="relative z-10 inline-flex h-[54px] items-center gap-2 rounded-full px-9 text-[16px] font-black text-white"
                    style={{ background: "var(--ink)", boxShadow: "0 14px 26px -12px rgba(32,28,24,.55)" }}
                  >
                    {step === last - 1 ? "С чего начнём" : "Дальше"}
                    <span className="text-[19px] leading-none">→</span>
                  </motion.button>

                  {step > 0 && (
                    <button onClick={back} className="relative z-10 mt-3 h-9 px-3 text-[13px] font-black" style={{ color: "rgba(32,28,24,.44)" }}>
                      ‹ Назад
                    </button>
                  )}

                  <span aria-hidden className="pointer-events-none absolute bottom-[-96px] left-1/2 h-[340px] w-[460px] -translate-x-1/2 rounded-full opacity-40" style={{ background: tone }} />

                  <div className="pointer-events-none absolute inset-x-0 bottom-0">
                    <div className="mx-auto w-full max-w-md overflow-hidden pb-[calc(var(--safe-bottom)+16px)]">{poster.art}</div>
                  </div>
                </div>
              </>
            ) : (
              <Pick firstName={tg?.first_name} onPick={pick} onBack={back} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ——— Каркас постера: цветное поле с волнистым нижним краем ———

function Tone({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <div className="relative flex shrink-0 flex-col px-7 pb-6 pt-[calc(var(--safe-top)+18px)]" style={{ background: tone, minHeight: "42%" }}>
      {children}
      <svg
        className="absolute inset-x-0 top-full block h-[54px] w-full"
        viewBox="0 0 390 54"
        preserveAspectRatio="none"
        aria-hidden
        style={{ marginTop: -1 }}
      >
        <path d="M0 0 H390 V12 C338 44, 296 6, 232 24 C168 42, 92 58, 0 26 Z" fill={tone} />
      </svg>
    </div>
  );
}

function Progress({ step, total, onSkip }: { step: number; total: number; onSkip?: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[13px] font-black" style={{ background: "var(--ink)", color: "var(--bg)" }}>
        {APP_NAME.charAt(0)}
      </span>
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: total }).map((_, k) => (
          <span key={k} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ background: k <= step ? "var(--ink)" : "rgba(32,28,24,.2)" }} />
        ))}
      </div>
      {onSkip ? (
        <button onClick={onSkip} className="shrink-0 text-[11px] font-black" style={{ color: "rgba(32,28,24,.55)" }}>Пропустить</button>
      ) : (
        <span className="w-[62px]" />
      )}
    </div>
  );
}

// ——— Последний экран: вход, а не анкета ———

const ENTRIES: { role: Role; title: string; desc: string; icon: IconName; tint: string; ink: string }[] = [
  { role: "client", title: "Ищу специалиста", desc: "Подбор за пару минут", icon: "compass", tint: "var(--olive-soft)", ink: "var(--olive-edge)" },
  { role: "client", title: "Хочу заниматься сам", desc: "Дневники и практики, бесплатно", icon: "therapy", tint: "var(--purple-soft)", ink: "var(--purple-edge)" },
  { role: "guest", title: "Просто смотрю", desc: "Осмотреться без выбора", icon: "heart", tint: "var(--amber-soft)", ink: "var(--amber-edge)" },
];

function Pick({ firstName, onPick, onBack }: { firstName?: string; onPick: (role: Role) => void; onBack: () => void }) {
  return (
    <>
      <Tone tone="var(--purple)">
        <Progress step={POSTERS.length} total={POSTERS.length + 1} />
        <div className="flex flex-1 flex-col justify-center pb-2 text-center">
          <h1 className="font-tight text-[38px] font-black leading-[1.02]">{firstName ? `${firstName}, с чего` : "С чего"}<br />начнём?</h1>
          <p className="mx-auto mt-4 max-w-[30ch] text-[14.5px] font-semibold leading-snug" style={{ color: "rgba(32,28,24,.72)" }}>
            Ничего не заполняем. Выбор можно сменить в любой момент.
          </p>
        </div>
      </Tone>

      <div className="flex flex-1 flex-col px-6 pb-[calc(var(--safe-bottom)+22px)] pt-9">
        <div className="flex flex-col gap-3">
          {ENTRIES.map((entry, k) => (
            <motion.button
              key={entry.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + k * 0.07, duration: 0.4, ease: EASE }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onPick(entry.role)}
              className="flex w-full items-center gap-4 rounded-[24px] p-4 text-left"
              style={{ background: entry.tint, boxShadow: "0 12px 26px -20px rgba(32,28,24,.5)" }}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white">
                <Icon name={entry.icon} width={23} weight="regular" color={entry.ink} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16.5px] font-black leading-tight">{entry.title}</span>
                <span className="mt-0.5 block text-[12.5px] font-semibold leading-snug" style={{ color: "rgba(32,28,24,.66)" }}>{entry.desc}</span>
              </span>
              <span className="text-[19px] font-black" style={{ color: "rgba(32,28,24,.3)" }}>›</span>
            </motion.button>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between pt-7">
          <button onClick={onBack} className="h-9 text-[13px] font-black" style={{ color: "rgba(32,28,24,.44)" }}>‹ Назад</button>
          <button onClick={() => onPick("psychologist")} className="h-9 text-[13.5px] font-black" style={{ color: "var(--olive-edge)" }}>
            Я психолог — веду практику →
          </button>
        </div>
      </div>
    </>
  );
}

// ——— Сцены. Векторы в палитре приложения, привязаны к нижнему краю. ———

function Art({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 390 280" className="-ml-[14%] block w-[128%]" aria-hidden>
      {children}
    </svg>
  );
}

const SitScene = (
  <Art>
    <path d="M158 208 C 156 152, 172 128, 195 128 C 218 128, 234 152, 232 208 Z" fill="var(--salmon)" />
    <path d="M168 152 C 142 158, 120 178, 114 200" stroke="var(--salmon)" strokeWidth="20" fill="none" strokeLinecap="round" />
    <path d="M222 152 C 248 158, 270 178, 276 200" stroke="var(--salmon)" strokeWidth="20" fill="none" strokeLinecap="round" />
    <path d="M92 250 C 92 212, 130 194, 195 194 C 260 194, 298 212, 298 250 C 298 255, 294 258, 288 258 H102 C 96 258, 92 255, 92 250 Z" fill="var(--olive)" />
    <ellipse cx="172" cy="240" rx="30" ry="13" fill="var(--olive-edge)" />
    <ellipse cx="219" cy="240" rx="30" ry="13" fill="var(--olive-edge)" />
    <circle cx="112" cy="204" r="12" fill={SKIN} />
    <rect x="262" y="176" width="38" height="28" rx="9" fill="#fff" />
    <path d="M300 183 h7 a9 9 0 0 1 0 16 h-7" fill="none" stroke="#fff" strokeWidth="6" />
    <circle cx="272" cy="206" r="12" fill={SKIN} />
    <path d="M274 168 c 6 -10, -6 -16, 0 -25" stroke="var(--olive-edge)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    <path d="M289 168 c 6 -10, -6 -16, 0 -25" stroke="var(--olive-edge)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    <circle cx="195" cy="98" r="30" fill={SKIN} />
    <path d="M165 98 a30 30 0 0 1 60 0 Z" fill={HAIR} />
    <path d="M165 98 c 0 -11, 9 -15, 18 -13" stroke={HAIR} strokeWidth="8" fill="none" strokeLinecap="round" />
    <circle cx="230" cy="82" r="12" fill={HAIR} />
  </Art>
);

const CardsScene = (
  <Art>
    <g transform="rotate(-7 148 150)">
      <rect x="44" y="86" width="208" height="122" rx="28" fill="#fff" />
      <circle cx="96" cy="130" r="26" fill="var(--coral)" />
      <rect x="136" y="114" width="84" height="12" rx="6" fill="var(--ink)" />
      <rect x="136" y="136" width="58" height="10" rx="5" fill="#d9d3c4" />
      <rect x="70" y="168" width="72" height="24" rx="12" fill="var(--olive-soft)" />
      <rect x="150" y="168" width="84" height="24" rx="12" fill="var(--amber-soft)" />
    </g>
    <g transform="rotate(5 258 208)">
      <rect x="152" y="146" width="216" height="124" rx="28" fill="#fff" />
      <circle cx="206" cy="192" r="27" fill="var(--purple)" />
      <rect x="248" y="176" width="88" height="12" rx="6" fill="var(--ink)" />
      <rect x="248" y="198" width="62" height="10" rx="5" fill="#d9d3c4" />
      <rect x="180" y="228" width="76" height="24" rx="12" fill="var(--purple-soft)" />
      <rect x="264" y="228" width="88" height="24" rx="12" fill="var(--olive-soft)" />
    </g>
    <circle cx="306" cy="102" r="34" fill="var(--olive-edge)" />
    <path d="M292 102 l10 11 l19 -22" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Art>
);

const MOOD_RING = ["var(--mood-1)", "var(--mood-2)", "var(--mood-3)", "var(--mood-4)", "var(--mood-5)"];

const WheelScene = (
  <Art>
    {MOOD_RING.map((color, i) => (
      <circle
        key={color}
        cx="195"
        cy="150"
        r="86"
        fill="none"
        stroke={color}
        strokeWidth="30"
        strokeDasharray="100 440"
        strokeDashoffset={-108 * i}
        transform="rotate(-90 195 150)"
      />
    ))}
    <circle cx="195" cy="150" r="58" fill="var(--bg)" />
    <circle cx="195" cy="150" r="34" fill="var(--olive-soft)" />
    <path d="M182 146 a5.5 5.5 0 0 1 11 0" fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
    <path d="M199 146 a5.5 5.5 0 0 1 11 0" fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
    <path d="M184 164 c 9 9, 20 9, 27 0" fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
    <rect x="40" y="200" width="74" height="56" rx="16" fill="#fff" />
    <circle cx="67" cy="228" r="14" fill="var(--purple-soft)" />
    <path d="M63 221 l11 7 l-11 7 z" fill="var(--purple-edge)" />
    <rect x="89" y="224" width="16" height="7" rx="3.5" fill="#ded8c9" />
    <rect x="276" y="200" width="76" height="56" rx="16" fill="#fff" />
    <rect x="292" y="218" width="44" height="8" rx="4" fill="#ded8c9" />
    <rect x="292" y="234" width="28" height="8" rx="4" fill="#ebe6da" />
  </Art>
);

const ReadScene = (
  <Art>
    <circle cx="196" cy="184" r="96" fill="var(--amber-soft)" opacity="0.55" />
    <rect x="46" y="222" width="104" height="22" rx="9" fill="var(--purple)" />
    <rect x="56" y="198" width="94" height="22" rx="9" fill="var(--olive)" />
    <path d="M96 198 c -22 -10, -28 -38, -10 -52 c 16 12, 20 36, 10 52 z" fill="var(--olive-edge)" />
    <path d="M112 266 H316 V212 C 286 188, 242 188, 214 212 C 186 188, 142 188, 112 212 Z" fill="#fff" />
    <path d="M214 212 V266" stroke="#e6dfd0" strokeWidth="4" strokeLinecap="round" />
    <rect x="132" y="226" width="62" height="7" rx="3.5" fill="#ded8c9" />
    <rect x="132" y="242" width="44" height="7" rx="3.5" fill="#ebe6da" />
    <rect x="234" y="226" width="62" height="7" rx="3.5" fill="#ded8c9" />
    <rect x="234" y="242" width="50" height="7" rx="3.5" fill="#ebe6da" />
    <rect x="330" y="216" width="9" height="50" rx="4.5" fill="var(--olive-edge)" />
    <ellipse cx="334" cy="266" rx="28" ry="7" fill="var(--olive-edge)" />
    <path d="M306 214 c 0 -28, 12 -44, 28 -44 c 16 0, 28 16, 28 44 z" fill="var(--peach)" />
    <ellipse cx="334" cy="214" rx="28" ry="6" fill="var(--peach-edge)" />
  </Art>
);

const POSTERS: Poster[] = [
  {
    key: "what",
    tone: "var(--amber)",
    eyebrow: APP_NAME,
    head: <>Психология<br />под рукой</>,
    text: "Найти своего специалиста, заниматься собой между встречами и понимать, как всё устроено.",
    art: SitScene,
  },
  {
    key: "find",
    tone: "var(--olive)",
    eyebrow: "Найти своего",
    head: <>Не рейтинг,<br />а совпадение</>,
    text: "Ответите на пару вопросов — покажем десять анкет вместо тысячи. С фото, голосом и честным «с чем не работаю».",
    art: CardsScene,
  },
  {
    key: "self",
    tone: "var(--purple)",
    eyebrow: "Работать самому",
    head: <>Пять минут,<br />когда тяжело</>,
    text: "Дыхание, разбор мыслей, дневник настроения, колесо баланса. Бесплатно и без специалиста.",
    art: WheelScene,
  },
  {
    key: "learn",
    tone: "var(--peach)",
    eyebrow: "Разбираться",
    head: <>Понятно,<br />как это устроено</>,
    text: "Что такое КПТ, чего ждать от первой встречи, как понять, что терапия идёт. Разборы и тесты.",
    art: ReadScene,
  },
];
