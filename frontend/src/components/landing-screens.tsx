"use client";

import { Icon, type IconName } from "@/components/icons";
import { APP_NAME } from "@/lib/brand";

/**
 * Нарисованные копии разделов для лендинга. Не скриншоты: снимок телефона на
 * широком блоке — это полоска в треть высоты, где не прочесть ни имени, ни
 * времени. Здесь та же раскладка собрана вёрсткой, поэтому растягивается на всю
 * ширину, остаётся читаемой на телефоне и не устаревает при смене шрифта.
 */

// Меню повторяет приложение: у специалиста и у клиента разделы разные.
const NAV: Record<"psy" | "client", { key: string; label: string; icon: IconName }[]> = {
  psy: [
    { key: "home", label: "Главная", icon: "home" },
    { key: "clients", label: "Клиенты", icon: "users" },
    { key: "sessions", label: "Сессии", icon: "calendar" },
    { key: "tools", label: "Инструменты", icon: "tools" },
  ],
  client: [
    { key: "home", label: "Главная", icon: "home" },
    { key: "catalog", label: "Каталог", icon: "compass" },
    { key: "therapy", label: "Терапия", icon: "therapy" },
    { key: "tools", label: "Инструменты", icon: "tools" },
  ],
};

const CARD = "rounded-[14px] md:rounded-[18px]";
const BORDER = "1px solid var(--hairline)";

type ScreenProps = { accent: string; compact?: boolean };

function Frame({
  active,
  role = "psy",
  accent,
  compact,
  title,
  sub,
  action,
  children,
}: ScreenProps & {
  active: string;
  role?: "psy" | "client";
  title: string;
  sub: string;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex h-full w-full overflow-hidden rounded-[16px] md:rounded-[24px]"
      style={{ background: "var(--bg)", border: BORDER }}
    >
      {/* Сайдбар — как в приложении на широком экране. На телефоне он ушёл бы
          в нижние табы, поэтому здесь просто прячется. */}
      <aside
        className={`${compact ? "hidden" : "hidden md:flex"} w-[186px] shrink-0 flex-col gap-1 p-4`}
        style={{ background: "var(--surface)", borderRight: BORDER }}
      >
        <span className="font-tight px-2 pb-3 text-[15px] font-black tracking-tight">{APP_NAME}</span>
        {NAV[role].map((item) => {
          const on = item.key === active;
          return (
            <span
              key={item.key}
              className="flex items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-[13px] font-bold"
              style={on ? { background: accent, color: "var(--ink)" } : { color: "var(--muted)" }}
            >
              <Icon name={item.icon} width={16} weight="regular" color="currentColor" />
              {item.label}
            </span>
          );
        })}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3.5 md:gap-4 md:p-6">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-tight text-[17px] font-black leading-tight md:text-[22px]">{title}</h3>
            <p className="mt-0.5 truncate text-[12px] font-medium md:text-[13px]" style={{ color: "var(--muted)" }}>{sub}</p>
          </div>
          {action && (
            <span className="shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-bold md:text-[12.5px]" style={{ background: accent }}>
              {action}
            </span>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}

function Chip({ text, on, accent }: { text: string; on?: boolean; accent: string }) {
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold md:text-[12px]"
      style={on ? { background: accent } : { background: "var(--surface)", border: BORDER, color: "var(--muted)" }}
    >
      {text}
    </span>
  );
}

function Ava({ letter, tone }: { letter: string; tone: string }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-black md:h-9 md:w-9"
      style={{ background: tone }}
    >
      {letter}
    </span>
  );
}

/* ─────────────────────────── Сессии ─────────────────────────── */

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const SLOTS: { time: string; name?: string; state: "free" | "busy" | "wait" | "done" }[] = [
  { time: "10:00", name: "Анна К.", state: "done" },
  { time: "11:30", state: "free" },
  { time: "13:00", name: "Игорь М.", state: "wait" },
  { time: "14:30", name: "Мария С.", state: "busy" },
  { time: "16:00", state: "free" },
  { time: "17:30", name: "Пётр В.", state: "busy" },
];

function Sessions({ accent, compact }: ScreenProps) {
  return (
    <Frame compact={compact} active="sessions" accent={accent} title="Понедельник, 18 августа" sub="3 встречи · 1 ждёт подтверждения" action="Записать">
      <div className="flex gap-1.5">
        {DAYS.map((d, i) => (
          <span
            key={d}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-[11px] py-1.5 text-[11px] font-bold md:text-[12px]"
            style={i === 0 ? { background: accent } : { background: "var(--surface)", border: BORDER, color: "var(--muted)" }}
          >
            {d}
            <span className="text-[13px] font-black" style={{ color: "var(--ink)" }}>{18 + i}</span>
          </span>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 md:grid-cols-3">
        {SLOTS.map((s) => {
          const free = s.state === "free";
          const bg = s.state === "wait" ? "var(--amber-soft)" : s.state === "done" ? "var(--green-soft)" : "var(--surface)";
          return (
            <div
              key={s.time}
              className={`${CARD} flex flex-col items-center justify-center gap-1 px-2 py-3`}
              style={{ background: free ? "transparent" : bg, border: free ? "1px dashed var(--hairline)" : BORDER }}
            >
              {free ? (
                <>
                  <Icon name="plus" width={16} weight="bold" color="var(--muted-2)" />
                  <span className="text-[11.5px] font-bold" style={{ color: "var(--muted-2)" }}>{s.time} свободно</span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5">
                    <Ava letter={s.name!.slice(0, 1)} tone="var(--purple-soft)" />
                    <span className="text-[13px] font-black">{s.time}</span>
                  </span>
                  <span className="text-[12px] font-bold">{s.name}</span>
                  {s.state === "wait" && (
                    <span className="mt-0.5 flex items-center gap-1 text-[10.5px] font-bold" style={{ color: "var(--muted)" }}>
                      <Icon name="clock" width={12} weight="bold" color="currentColor" /> подтвердить
                    </span>
                  )}
                  {s.state === "done" && (
                    <span className="mt-0.5 flex items-center gap-1 text-[10.5px] font-bold" style={{ color: "var(--muted)" }}>
                      <Icon name="check" width={12} weight="bold" color="currentColor" /> состоялась
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

/* ─────────────────────────── Клиенты ─────────────────────────── */

const CLIENTS = [
  { name: "Анна Кравцова", note: "Следующая встреча — завтра, 11:30", tag: "активна", tone: "var(--green-soft)" },
  { name: "Игорь Мельник", note: "Записался сам, ждёт подтверждения", tag: "новый", tone: "var(--amber-soft)" },
  { name: "Мария Соколова", note: "Была 12 августа · 8 встреч", tag: "активна", tone: "var(--green-soft)" },
  { name: "Пётр Власов", note: "Без записи третью неделю", tag: "пауза", tone: "var(--coral-soft)" },
];

function Clients({ accent, compact }: ScreenProps) {
  return (
    <Frame compact={compact} active="clients" accent={accent} title="Клиенты" sub="12 карточек · 1–10 из 12" action="Пригласить">
      <div className="flex gap-1.5 overflow-hidden">
        <Chip text="Все · 12" on accent={accent} />
        <Chip text="Активные · 7" accent={accent} />
        <Chip text="Новые · 2" accent={accent} />
        <Chip text="Пауза · 3" accent={accent} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {CLIENTS.map((c) => (
          <div key={c.name} className={`${CARD} flex flex-1 items-center gap-3 px-3 py-2.5`} style={{ background: "var(--surface)", border: BORDER }}>
            <Ava letter={c.name.slice(0, 1)} tone={c.tone} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-black">{c.name}</span>
              <span className="block truncate text-[11.5px] font-medium" style={{ color: "var(--muted)" }}>{c.note}</span>
            </span>
            <span className="hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline" style={{ background: c.tone }}>{c.tag}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* ─────────────────────────── Терапия ─────────────────────────── */

const MOOD = [3, 4, 2, 5, 4, 5, 4];

function Therapy({ accent, compact }: ScreenProps) {
  return (
    <Frame compact={compact} active="therapy" role="client" accent={accent} title="Терапия" sub="Ваш специалист — Марина Соколова" action="Записаться">
      <div className={`${CARD} flex items-center gap-3 px-3 py-3`} style={{ background: accent }}>
        <Ava letter="М" tone="var(--surface)" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-black">Ближайшая встреча</span>
          <span className="block text-[11.5px] font-medium" style={{ color: "var(--muted)" }}>Четверг, 21 августа, 14:30 · онлайн</span>
        </span>
        <Icon name="video" width={18} weight="regular" color="var(--ink)" />
      </div>

      <div className="grid min-h-0 flex-1 gap-2 md:grid-cols-2">
        <div className={`${CARD} flex flex-col px-3 py-3`} style={{ background: "var(--surface)", border: BORDER }}>
          <span className="text-[12.5px] font-black">Настроение за неделю</span>
          <span className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>7 отметок подряд</span>
          <span className="mt-auto flex h-[64px] items-end gap-1.5 pt-2">
            {MOOD.map((v, i) => (
              <span key={i} className="flex-1 rounded-t-[5px]" style={{ height: `${v * 20}%`, background: i === MOOD.length - 1 ? "var(--tiffany)" : "var(--green-soft)" }} />
            ))}
          </span>
        </div>

        <div className={`${CARD} flex flex-col gap-2 px-3 py-3`} style={{ background: "var(--surface)", border: BORDER }}>
          <span className="text-[12.5px] font-black">Задания</span>
          {[
            { text: "Дневник тревоги — 5 дней", done: true },
            { text: "Колесо баланса", done: true },
            { text: "Письмо себе через год", done: false },
          ].map((t) => (
            <span key={t.text} className="flex items-center gap-2 text-[12px] font-bold" style={{ color: t.done ? "var(--muted)" : "var(--ink)" }}>
              <Icon name={t.done ? "check" : "clock"} width={15} weight={t.done ? "fill" : "regular"} color={t.done ? "var(--green)" : "var(--muted-2)"} />
              <span className={t.done ? "line-through" : ""}>{t.text}</span>
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/* ─────────────────────────── Каталог ─────────────────────────── */

const PSY = [
  { name: "Марина Соколова", role: "КПТ, схема-терапия", price: "3 000 ₽", rate: "4,9", tags: ["Тревога", "Самооценка"], tone: "var(--purple-soft)" },
  { name: "Дмитрий Орлов", role: "Гештальт", price: "2 500 ₽", rate: "4,8", tags: ["Отношения", "Кризис"], tone: "var(--tiffany-soft)" },
  { name: "Ирина Ковалёва", role: "Психоанализ", price: "4 000 ₽", rate: "5,0", tags: ["Травма", "Сон"], tone: "var(--coral-soft)" },
];

function Catalog({ accent, compact }: ScreenProps) {
  return (
    <Frame compact={compact} active="catalog" role="client" accent={accent} title="Каталог специалистов" sub="34 анкеты · свободные окна на этой неделе" action="Фильтры">
      <div className="flex gap-1.5 overflow-hidden">
        <Chip text="Тревога" on accent={accent} />
        <Chip text="Онлайн" on accent={accent} />
        <Chip text="до 3 000 ₽" accent={accent} />
        <Chip text="Сегодня" accent={accent} />
      </div>

      <div className="grid min-h-0 flex-1 gap-2 sm:grid-cols-3">
        {PSY.map((p) => (
          <div key={p.name} className={`${CARD} flex flex-col gap-2 px-3 py-3`} style={{ background: "var(--surface)", border: BORDER }}>
            <span className="flex items-center gap-2">
              <Ava letter={p.name.slice(0, 1)} tone={p.tone} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-black">{p.name}</span>
                <span className="block truncate text-[11px] font-medium" style={{ color: "var(--muted)" }}>{p.role}</span>
              </span>
            </span>
            <span className="flex flex-wrap gap-1">
              {p.tags.map((t) => (
                <span key={t} className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--bg)", border: BORDER }}>{t}</span>
              ))}
            </span>
            <span className="mt-auto flex items-center justify-between pt-1">
              <span className="text-[12.5px] font-black">{p.price}</span>
              <span className="flex items-center gap-1 text-[11.5px] font-bold" style={{ color: "var(--muted)" }}>
                <Icon name="star" width={13} weight="fill" color="var(--amber)" />{p.rate}
              </span>
            </span>
            <span className="rounded-full py-1.5 text-center text-[11.5px] font-bold" style={{ background: accent }}>Смотреть окна</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* ─────────────────────────── Инструменты ─────────────────────────── */

const TOOLS: { icon: IconName; title: string; note: string; tone: string }[] = [
  { icon: "balance", title: "Колесо баланса", note: "8 сфер жизни, снимок раз в месяц", tone: "var(--tiffany-soft)" },
  { icon: "mood", title: "Дневник настроения", note: "Отметка за минуту, график за год", tone: "var(--green-soft)" },
  { icon: "self", title: "Тест на тип личности", note: "10 шкал, отчёт в PDF", tone: "var(--purple-soft)" },
  { icon: "waves", title: "Техники самопомощи", note: "Дыхание, заземление, стоп-мысль", tone: "var(--coral-soft)" },
];

function Tools({ accent, compact }: ScreenProps) {
  return (
    <Frame compact={compact} active="tools" accent={accent} title="Инструменты" sub="Практики между встречами — и себе, и клиенту">
      <div className="grid min-h-0 flex-1 gap-2 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <div key={t.title} className={`${CARD} flex items-center gap-3 px-3 py-3`} style={{ background: "var(--surface)", border: BORDER }}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]" style={{ background: t.tone }}>
              <Icon name={t.icon} width={19} weight="regular" color="var(--ink)" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-black">{t.title}</span>
              <span className="block truncate text-[11.5px] font-medium" style={{ color: "var(--muted)" }}>{t.note}</span>
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

const SCREENS: Record<string, (p: ScreenProps) => React.ReactElement> = {
  sessions: Sessions,
  clients: Clients,
  therapy: Therapy,
  catalog: Catalog,
  tools: Tools,
};

export function LandingScreen({ tab, accent, compact }: ScreenProps & { tab: string }) {
  const Screen = SCREENS[tab] ?? Sessions;
  return <Screen accent={accent} compact={compact} />;
}
