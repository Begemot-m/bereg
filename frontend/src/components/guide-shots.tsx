"use client";

import { Icon, type IconName } from "@/components/icons";

/**
 * Кадры реального интерфейса для пошаговых инструкций. Отличие от
 * `landing-screens.tsx`: там нарисованы разделы целиком и «в общем», а здесь —
 * ровно тот блок, на который человека просят нажать, один в один с тем, что он
 * увидит в приложении. Поэтому и подсветка: кадр показывает не раздел, а цель.
 */

const HAIR = "1px solid var(--hairline)";

function Shot({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[16px]" style={{ background: "var(--page)", border: HAIR }}>
      <div className="px-3.5 pb-2 pt-3">
        <p className="font-tight text-[16px] font-black leading-tight">{title}</p>
        {sub && <p className="mt-0.5 text-[10.5px] font-bold" style={{ color: "var(--muted)" }}>{sub}</p>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-t-[16px] px-3 pb-3 pt-3" style={{ background: "var(--bg)" }}>
        {children}
      </div>
    </div>
  );
}

/** Обводка вокруг блока, ради которого кадр и сделан. */
function Focus({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-[18px] p-[3px]" style={{ background: "var(--purple)" }}>
      <div className="rounded-[15px] overflow-hidden">{children}</div>
    </div>
  );
}

/* ── Кабинет: заполненность анкеты ── */

function CabinetProfile() {
  return (
    <Shot title="Личный кабинет" sub="Профиль специалиста">
      <Focus>
        <div className="flex items-center gap-3 bg-white p-3">
          <Icon name="user" width={34} weight="fill" color="var(--tiffany)" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-black leading-tight">
              Профиль заполнен на <span className="tnum" style={{ color: "var(--tiffany-edge)" }}>40%</span>
            </p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white" style={{ border: "1px solid var(--tiffany-edge)" }}>
              <div className="h-full w-[40%] rounded-full" style={{ background: "var(--tiffany-edge)" }} />
            </div>
          </div>
          <span className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black text-white" style={{ background: "var(--ink)" }}>Правка</span>
        </div>
      </Focus>

      <div className="flex items-center gap-3 rounded-[15px] bg-white p-3 opacity-55">
        <Icon name="seal" width={30} weight="fill" color="var(--green)" />
        <div className="min-w-0">
          <p className="text-[11.5px] font-black leading-tight">Пройдите верификацию</p>
          <p className="mt-0.5 text-[9.5px] font-semibold leading-snug" style={{ color: "var(--muted)" }}>Чтобы профиль разместили в каталоге</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-[15px] bg-white p-3 opacity-40">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ background: "var(--purple-soft)" }}>
          <Icon name="spark" width={15} weight="fill" color="var(--purple-edge)" />
        </span>
        <p className="text-[11.5px] font-black">Хроника PRO</p>
      </div>
    </Shot>
  );
}

/* ── Кабинет: верификация ── */

function CabinetVerify() {
  return (
    <Shot title="Личный кабинет" sub="Профиль специалиста">
      <div className="flex items-center gap-3 rounded-[15px] bg-white p-3 opacity-45">
        <Icon name="user" width={30} weight="fill" color="var(--tiffany)" />
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-black leading-tight">Профиль заполнен на 100%</p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white" style={{ border: "1px solid var(--tiffany-edge)" }}>
            <div className="h-full w-full rounded-full" style={{ background: "var(--tiffany-edge)" }} />
          </div>
        </div>
      </div>

      <Focus>
        <div className="flex items-center gap-3 bg-white p-3">
          <span className="relative flex shrink-0 items-center justify-center">
            <Icon name="seal" width={34} weight="fill" color="var(--green)" />
            <span
              className="absolute -right-1 -top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full text-[9px] font-black leading-none text-white"
              style={{ background: "linear-gradient(160deg, #ff8a3d, #f4451f)", border: "2px solid #fff" }}
            >
              !
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-black leading-tight">Пройдите верификацию</span>
            <span className="mt-0.5 block text-[9.5px] font-semibold leading-snug" style={{ color: "var(--muted)" }}>
              Чтобы ваш профиль могли разместить в каталоге специалистов.
            </span>
          </span>
        </div>
      </Focus>

      <div className="rounded-[15px] bg-white p-3 opacity-40">
        <p className="text-[11px] font-black">Диплом или переподготовка · скан документа</p>
      </div>
    </Shot>
  );
}

/* ── Сессии: раскрытый «График» ── */

const RAIL = [
  { top: 6, height: 22, label: "10:00 · очно" },
  { top: 34, height: 22, label: "12:00 · онлайн" },
  { top: 62, height: 22, label: "15:00 · онлайн" },
];

function SessionsSchedule() {
  return (
    <Shot title="Сессии" sub="График приёма">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-0.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black" style={{ color: "var(--edge)" }}>
          <Icon name="gear" width={12} weight="bold" color="var(--edge)" /> Свернуть
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-[12px]" style={{ background: "var(--edge)" }}>
          <Icon name="plus" width={17} weight="bold" color="#fff" />
        </span>
        <span className="inline-flex items-center gap-1.5 justify-self-end text-[11px] font-black" style={{ color: "var(--edge)" }}>
          <Icon name="calendar" width={12} weight="bold" color="var(--edge)" /> Календарь
        </span>
      </div>

      <Focus>
        <div className="space-y-2 bg-white p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-bold" style={{ color: "var(--muted)" }}>Работаю</span>
            <span className="tnum rounded-[9px] px-2 py-1 text-[11px] font-black" style={{ background: "var(--surface-2)" }}>09:00</span>
            <span className="text-[10.5px] font-bold" style={{ color: "var(--muted)" }}>до</span>
            <span className="tnum rounded-[9px] px-2 py-1 text-[11px] font-black" style={{ background: "var(--surface-2)" }}>21:00</span>
          </div>

          <div className="relative h-6">
            <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={{ background: "var(--surface-2)" }} />
            <span className="absolute left-[46%] top-1/2 flex h-6 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: "var(--ink)" }}>50 мин</span>
          </div>

          <div className="flex gap-1">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d, i) => (
              <span
                key={d}
                className="flex-1 rounded-[8px] py-1 text-center text-[9.5px] font-black"
                style={i === 0 ? { background: "var(--green)", color: "var(--ink)" } : { background: "var(--surface-2)", color: "var(--muted)" }}
              >
                {d}
              </span>
            ))}
          </div>

          <div className="relative h-[92px] overflow-hidden rounded-[11px]" style={{ background: "var(--surface-2)" }}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="absolute inset-x-0 h-px" style={{ top: 12 + i * 24, background: "var(--hairline)" }} />
            ))}
            {RAIL.map((b) => (
              <span
                key={b.label}
                className="absolute left-1.5 right-1.5 flex items-center justify-between rounded-[8px] px-1.5"
                style={{ top: b.top, height: b.height, background: "var(--green-soft)", border: "1px solid var(--green-edge)" }}
              >
                <span className="text-[9px] font-black" style={{ color: "var(--green-edge)" }}>{b.label}</span>
                <span className="text-[9px] font-black" style={{ color: "var(--muted)" }}>✕</span>
              </span>
            ))}
          </div>

          <div className="flex gap-1">
            {["На будни", "На выходные", "Очистить"].map((t) => (
              <span key={t} className="flex-1 rounded-full py-1 text-center text-[9.5px] font-black" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{t}</span>
            ))}
          </div>

          <span className="block rounded-full py-1.5 text-center text-[11px] font-black text-white" style={{ background: "var(--ink)" }}>Сохранить расписание</span>
        </div>
      </Focus>
    </Shot>
  );
}

/* ── Клиенты: раскрытый плюсик ── */

function ClientsPlus() {
  return (
    <Shot title="Клиенты" sub="Всего: 0">
      <div className="flex items-center gap-2">
        <span className="flex flex-1 items-center gap-2 rounded-[13px] bg-white px-3 py-2" style={{ border: HAIR }}>
          <Icon name="compass" width={12} weight="bold" color="var(--muted-2)" />
          <span className="text-[10.5px] font-semibold" style={{ color: "var(--muted-2)" }}>Поиск по имени</span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]" style={{ background: "var(--ink)", transform: "rotate(45deg)" }}>
          <Icon name="plus" width={17} weight="bold" color="#fff" />
        </span>
      </div>

      <Focus>
        <div className="space-y-2 bg-white p-2.5">
          <div className="rounded-[12px] p-2.5" style={{ background: "var(--surface-2)" }}>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-[9px]" style={{ background: "var(--edge)" }}>
                <Icon name="telegram" width={13} weight="fill" color="#fff" />
              </span>
              <p className="text-[11.5px] font-black leading-none">Пригласить клиента</p>
            </div>
            <p className="mt-1.5 text-[9.5px] font-semibold leading-snug" style={{ color: "var(--muted)" }}>
              Клиент откроет приложение по ссылке и сам появится в списке — уже подключённым.
            </p>
            <div className="mt-2 flex gap-1.5">
              <span className="flex-1 rounded-full py-1 text-center text-[9.5px] font-black" style={{ background: "#fff", border: HAIR }}>Скопировать</span>
              <span className="flex-1 rounded-full py-1 text-center text-[9.5px] font-black text-white" style={{ background: "var(--edge)" }}>В Telegram</span>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-[12px] p-2.5" style={{ background: "var(--surface-2)" }}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-white">
              <Icon name="user" width={13} weight="bold" color="var(--edge)" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] font-black leading-none">Ручной ввод</span>
              <span className="mt-1 block text-[9.5px] font-semibold" style={{ color: "var(--muted)" }}>Нажмите, чтобы заполнить самостоятельно</span>
            </span>
            <span className="shrink-0 text-[11px] font-black" style={{ color: "var(--muted)" }}>↓</span>
          </div>
        </div>
      </Focus>
    </Shot>
  );
}

/* ── Карточка клиента ── */

const CARD_MOOD = [3, 4, 2, 5, 4, 5, 4];
const CARD_TASKS: { text: string; done: boolean }[] = [
  { text: "Дневник тревоги — 5 дней", done: true },
  { text: "Письмо себе через год", done: false },
];

function ClientCard() {
  return (
    <Shot title="Анна Кравцова" sub="8 встреч · следующая завтра, 11:30">
      <Focus>
        <div className="space-y-2 bg-white p-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[17px] font-black" style={{ background: "var(--purple-soft)" }}>А</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-black leading-tight">Анна Кравцова</span>
              <span className="mt-0.5 flex items-center gap-1 text-[9.5px] font-bold" style={{ color: "var(--muted)" }}>
                <Icon name="check" width={10} weight="bold" color="var(--green-edge)" /> профиль подключён
              </span>
            </span>
            <span className="shrink-0 rounded-full px-2 py-1 text-[9.5px] font-black" style={{ background: "var(--green-soft)", color: "var(--green-edge)" }}>активна</span>
          </div>

          <div className="rounded-[11px] p-2" style={{ background: "var(--surface-2)" }}>
            <p className="text-[9.5px] font-black uppercase tracking-[.06em]" style={{ color: "var(--muted)" }}>Настроение между встречами</p>
            <span className="mt-1.5 flex h-[38px] items-end gap-1">
              {CARD_MOOD.map((v, i) => (
                <span key={i} className="flex-1 rounded-t-[4px]" style={{ height: `${v * 20}%`, background: i === CARD_MOOD.length - 1 ? "var(--tiffany)" : "var(--green-soft)" }} />
              ))}
            </span>
          </div>

          <div className="rounded-[11px] p-2" style={{ background: "var(--surface-2)" }}>
            <p className="text-[9.5px] font-black uppercase tracking-[.06em]" style={{ color: "var(--muted)" }}>Задания</p>
            {CARD_TASKS.map((t) => (
              <span key={t.text} className="mt-1 flex items-center gap-1.5 text-[10px] font-bold" style={{ color: t.done ? "var(--muted)" : "var(--ink)" }}>
                <Icon name={t.done ? "check" : "clock"} width={11} weight={t.done ? "fill" : "regular"} color={t.done ? "var(--green)" : "var(--muted-2)"} />
                <span className={t.done ? "line-through" : ""}>{t.text}</span>
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {(["balance", "note"] as IconName[]).map((icon, i) => (
              <span key={icon} className="flex items-center gap-1.5 rounded-[10px] px-2 py-1.5" style={{ background: "var(--surface-2)" }}>
                <Icon name={icon} width={11} weight="bold" color="var(--edge)" />
                <span className="text-[9.5px] font-black">{i === 0 ? "Колесо баланса" : "Заметки о встречах"}</span>
              </span>
            ))}
          </div>
        </div>
      </Focus>
    </Shot>
  );
}

/* ── Кабинет: переключение роли ── */

function CabinetRole() {
  return (
    <Shot title="Личный кабинет" sub="Роль в приложении">
      <Focus>
        <div className="bg-white p-2.5">
          <p className="text-[11.5px] font-black leading-tight">Я пользуюсь приложением как</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-[12px] p-1" style={{ background: "var(--surface-2)" }}>
            <span className="flex items-center justify-center gap-1.5 rounded-[10px] py-1.5 text-[10.5px] font-black" style={{ background: "var(--ink)", color: "#fff" }}>
              <Icon name="therapy" width={12} weight="bold" color="#fff" /> Специалист
            </span>
            <span className="flex items-center justify-center gap-1.5 rounded-[10px] py-1.5 text-[10.5px] font-black" style={{ color: "var(--muted)" }}>
              <Icon name="user" width={12} weight="bold" color="var(--muted)" /> Клиент
            </span>
          </div>
          <p className="mt-2 text-[9.5px] font-semibold leading-snug" style={{ color: "var(--muted)" }}>
            Разделы подстроятся: настроение, колесо баланса, задания и запись к своему специалисту.
          </p>
        </div>
      </Focus>

      <div className="grid grid-cols-3 gap-1.5 opacity-45">
        {(["mood", "balance", "tools"] as IconName[]).map((icon) => (
          <span key={icon} className="flex flex-col items-center gap-1 rounded-[12px] bg-white px-2 py-2.5">
            <Icon name={icon} width={15} weight="bold" color="var(--edge)" />
            <span className="text-[8.5px] font-black" style={{ color: "var(--muted)" }}>
              {icon === "mood" ? "Настроение" : icon === "balance" ? "Колесо" : "Практики"}
            </span>
          </span>
        ))}
      </div>
    </Shot>
  );
}

/* ── Приватность ── */

function Privacy() {
  return (
    <Shot title="Карточка клиента" sub="Видна только вам">
      <Focus>
        <div className="flex flex-col items-center gap-2 bg-white px-3 py-5">
          <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--green-soft)" }}>
            <Icon name="seal" width={26} weight="fill" color="var(--green-edge)" />
          </span>
          <p className="text-[12px] font-black">Данные зашифрованы</p>
          <p className="text-center text-[9.5px] font-semibold leading-snug" style={{ color: "var(--muted)" }}>
            Записи, заметки и настроение клиента не уходят никуда, кроме вашей карточки.
          </p>
        </div>
      </Focus>

      <div className="grid grid-cols-2 gap-1.5">
        {[
          { icon: "telegram" as IconName, text: "Вход без паролей" },
          { icon: "chart" as IconName, text: "Статистика терапии" },
        ].map((p) => (
          <span key={p.text} className="flex items-center gap-1.5 rounded-[12px] bg-white px-2 py-2">
            <Icon name={p.icon} width={12} weight="bold" color="var(--edge)" />
            <span className="text-[9.5px] font-black">{p.text}</span>
          </span>
        ))}
      </div>
    </Shot>
  );
}

/* ── Непрерывность работы ── */

function Continuity() {
  const bars = [2, 3, 3, 4, 4, 5, 5];
  return (
    <Shot title="Совместная работа" sub="Прогресс виден обеим сторонам">
      <Focus>
        <div className="bg-white p-2.5">
          <p className="text-[11.5px] font-black leading-tight">Клиент заходит каждый день</p>
          <span className="mt-2 flex h-[54px] items-end gap-1.5">
            {bars.map((v, i) => (
              <span key={i} className="flex-1 rounded-t-[5px]" style={{ height: `${v * 18}%`, background: i > 4 ? "var(--tiffany)" : "var(--green-soft)" }} />
            ))}
          </span>
          <p className="mt-2 text-[9.5px] font-semibold leading-snug" style={{ color: "var(--muted)" }}>
            Отметки настроения, задания и заметки копятся между встречами — и разговор начинается не с нуля.
          </p>
        </div>
      </Focus>
    </Shot>
  );
}

const SHOTS: Record<string, () => React.ReactElement> = {
  "cabinet-profile": CabinetProfile,
  "cabinet-verify": CabinetVerify,
  "cabinet-role": CabinetRole,
  privacy: Privacy,
  continuity: Continuity,
  "sessions-schedule": SessionsSchedule,
  "clients-plus": ClientsPlus,
  "client-card": ClientCard,
};

export function GuideShot({ name }: { name: string }) {
  const Shape = SHOTS[name] ?? CabinetProfile;
  return <Shape />;
}
