"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { Button, Input, Textarea } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { select, success, tap } from "@/lib/haptics";
import { completeOnboarding, savePsyProfile, tgUser } from "@/lib/profile";
import { setRole, type Role } from "@/lib/role";

const EASE = [0.16, 1, 0.3, 1] as const;

type Step = "role" | "value" | "psy-form" | "psy-review";

// УТП под каждую роль: сплошные блоки, иконка + суть.
const VALUE: Record<Role, { title: string; lead: string; blocks: { icon: IconName; title: string; desc: string; fill: string }[] }> = {
  psychologist: {
    title: "Ведите практику\nбез хаоса",
    lead: "Записи, клиенты и прогресс — в одном месте вместо пяти чатов и таблиц.",
    blocks: [
      { icon: "calendar", title: "Управление записью", desc: "Задайте рабочие окна — клиенты записываются в свободные сами", fill: "sage" },
      { icon: "chart", title: "Прогресс клиента", desc: "Видно, как человек живёт между сессиями: настроение, задания, заметки", fill: "iris" },
      { icon: "bell", title: "Напоминания", desc: "Клиенту приходит уведомление накануне — меньше неявок", fill: "ink" },
    ],
  },
  client: {
    title: "Работа над собой\nпо шагам",
    lead: "Записывайтесь к специалисту, выполняйте задания и видьте свой прогресс.",
    blocks: [
      { icon: "compass", title: "Свой специалист", desc: "Каталог психологов с подходами и свободными окнами", fill: "sage" },
      { icon: "note", title: "Задания и настроение", desc: "Отмечайте состояние между сессиями — психолог видит динамику", fill: "iris" },
      { icon: "bell", title: "Не забудете", desc: "Напоминание о сессии придёт накануне", fill: "ink" },
    ],
  },
  guest: {
    title: "Осмотритесь\nспокойно",
    lead: "Загляните в каталог и инструменты. Роль всегда можно выбрать позже.",
    blocks: [
      { icon: "compass", title: "Каталог специалистов", desc: "Подходы, темы, цены и рейтинг", fill: "sage" },
      { icon: "heart", title: "Инструменты самопомощи", desc: "Практики и дневники — скоро", fill: "iris" },
      { icon: "user", title: "Роль по желанию", desc: "Станьте клиентом или психологом в кабинете", fill: "ink" },
    ],
  },
};

export function Onboarding() {
  const [step, setStep] = useState<Step>("role");
  const [role, setLocalRole] = useState<Role>("client");
  const tg = tgUser();

  const finish = () => { success(); completeOnboarding(); };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--page)" }} data-accent="purple">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 py-9">
        {/* Прогресс */}
        <div className="mb-8 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[15px] font-black text-[var(--bg)] stroke" style={{ background: "var(--ink)" }}>
            {APP_NAME.charAt(0)}
          </span>
          <div className="flex flex-1 gap-1.5">
            {["role", "value", step === "psy-form" || step === "psy-review" ? "psy" : null].filter(Boolean).map((s, i) => {
              const idx = ["role", "value", "psy"].indexOf(String(step === "psy-form" || step === "psy-review" ? "psy" : step));
              return <span key={i} className="h-2 flex-1 rounded-full stroke transition-colors duration-300" style={{ background: i <= idx ? "var(--purple)" : "#fff" }} />;
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 22 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -22 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="flex flex-1 flex-col"
          >
            {step === "role" && (
              <RoleStep
                firstName={tg?.first_name}
                onPick={(r) => { select(); setLocalRole(r); setRole(r); setStep("value"); }}
              />
            )}

            {step === "value" && (
              <ValueStep
                role={role}
                onNext={() => { tap(); role === "psychologist" ? setStep("psy-form") : finish(); }}
                onBack={() => { tap(); setStep("role"); }}
              />
            )}

            {step === "psy-form" && <PsyForm defaultName={[tg?.first_name, tg?.last_name].filter(Boolean).join(" ")} onBack={() => { tap(); setStep("value"); }} onDone={() => { tap(); setStep("psy-review"); }} />}

            {step === "psy-review" && <ReviewStep onDone={finish} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function RoleStep({ firstName, onPick }: { firstName?: string; onPick: (r: Role) => void }) {
  const roles: { role: Role; title: string; desc: string; icon: IconName }[] = [
    { role: "psychologist", title: "Я психолог", desc: "Веду практику: клиенты, записи, задания", icon: "users" },
    { role: "client", title: "Я клиент", desc: "Работаю с психологом или ищу своего", icon: "heart" },
    { role: "guest", title: "Просто смотрю", desc: "Осмотрюсь, роль выберу позже", icon: "compass" },
  ];
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="font-tight text-[34px] font-extrabold leading-[1.05]">
        {firstName ? `${firstName}, добро` : "Добро"} пожаловать<br />в {APP_NAME}
      </h1>
      <p className="mt-3 text-[15px] font-semibold leading-snug text-[var(--muted)]">Кто вы здесь? От этого зависит, что вы увидите.</p>
      <div className="mt-7 space-y-3">
        {roles.map((r, i) => {
          const bgs = ["fill-green", "fill-purple", "fill-amber"];
          return (
          <motion.button
            key={r.role}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 + i * 0.08, duration: 0.4, ease: EASE }}
            onClick={() => onPick(r.role)}
            className={`chunk ${bgs[i]} flex w-full items-center gap-3.5 p-4 text-left transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] stroke" style={{ background: "#fff" }}>
              <Icon name={r.icon} width={22} weight="regular" color="var(--ink)" />
            </span>
            <span className="flex-1">
              <p className="text-[15px] font-extrabold">{r.title}</p>
              <p className="text-[12.5px] font-semibold" style={{ color: "rgba(32,28,24,.62)" }}>{r.desc}</p>
            </span>
            <span className="text-[20px] font-bold leading-none">›</span>
          </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function ValueStep({ role, onNext, onBack }: { role: Role; onNext: () => void; onBack: () => void }) {
  const v = VALUE[role];
  return (
    <div className="flex flex-1 flex-col">
      <BackButton onClick={onBack} />
      <h2 className="font-tight whitespace-pre-line text-[30px] font-extrabold leading-[1.05]">{v.title}</h2>
      <p className="mt-2.5 text-[14px] font-semibold leading-snug text-[var(--muted)]">{v.lead}</p>
      <div className="mt-6 space-y-3">
        {v.blocks.map((b, i) => {
          const dark = b.fill === "ink";
          return (
          <motion.div
            key={b.title}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.08 + i * 0.09, duration: 0.45, ease: EASE }}
            className={`chunk fill-${b.fill} flex items-center gap-3.5 p-4`}
            style={dark ? { color: "#fff" } : undefined}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] stroke" style={{ background: "#fff" }}>
              <Icon name={b.icon} width={22} weight="regular" color="var(--ink)" />
            </span>
            <span>
              <p className="text-[15px] font-extrabold">{b.title}</p>
              <p className={`text-[12.5px] font-semibold leading-snug ${dark ? "text-white/75" : ""}`} style={dark ? undefined : { color: "rgba(32,28,24,.62)" }}>{b.desc}</p>
            </span>
          </motion.div>
          );
        })}
      </div>
      <div className="mt-8">
        <Button arrow className="w-full" onClick={onNext}>{role === "psychologist" ? "Заполнить профиль" : "Начать"}</Button>
      </div>
    </div>
  );
}

function PsyForm({ defaultName, onBack, onDone }: { defaultName: string; onBack: () => void; onDone: () => void }) {
  const [name, setName] = useState(defaultName);
  const [approach, setApproach] = useState("");
  const [years, setYears] = useState("");
  const [about, setAbout] = useState("");
  const valid = name.trim() && approach.trim();
  return (
    <div className="flex flex-1 flex-col">
      <BackButton onClick={onBack} />
      <h2 className="font-tight text-[28px] font-extrabold leading-tight">Мини-профиль</h2>
      <p className="mt-2 text-[13.5px] leading-snug text-[var(--muted)]">Имя взяли из Telegram. Анкета уйдёт на проверку — после подтверждения профиль появится в каталоге.</p>
      <form
        className="mt-5 space-y-3"
        onSubmit={(e) => { e.preventDefault(); if (!valid) return; savePsyProfile({ name: name.trim(), approach: approach.trim(), experienceYears: years.trim(), about: about.trim() }); onDone(); }}
      >
        <Field label="Имя и фамилия"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Как к вам обращаться" /></Field>
        <Field label="Подход"><Input value={approach} onChange={(e) => setApproach(e.target.value)} placeholder="КПТ, ACT, гештальт…" /></Field>
        <Field label="Опыт, лет"><Input value={years} onChange={(e) => setYears(e.target.value)} inputMode="numeric" placeholder="5" /></Field>
        <Field label="О себе"><Textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3} placeholder="Пара предложений о практике" /></Field>
        <Button type="submit" arrow disabled={!valid} className="w-full">Отправить на проверку</Button>
      </form>
    </div>
  );
}

function ReviewStep({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-1 flex-col justify-center text-center">
      <motion.span
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.34, 1.4, 0.5, 1] }}
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: "var(--good-tint)" }}
      >
        <Icon name="check" width={44} weight="fill" color="var(--good)" />
      </motion.span>
      <h2 className="font-tight mt-6 text-[26px] font-extrabold">Анкета на проверке</h2>
      <p className="mx-auto mt-3 max-w-xs text-[14px] leading-snug text-[var(--muted)]">Подтвердим профиль обычно за один рабочий день. Кабинет уже доступен — можно настроить рабочие окна.</p>
      <div className="mt-9"><Button arrow className="w-full" onClick={onDone}>В кабинет</Button></div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-extrabold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mb-3 flex h-9 w-9 items-center justify-center self-start rounded-full stroke bg-white text-[16px] font-bold active:scale-90 transition-transform">‹</button>
  );
}
