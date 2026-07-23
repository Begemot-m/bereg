"use client";

import { useEffect, useState, type ReactNode } from "react";

import { ModuleCard, PageHead, SectionTitle } from "@/components/blocks";
import { CareModule } from "@/components/care-module";
import { Icon, type IconName } from "@/components/icons";
import { InviteBanner } from "@/components/invite";
import { Reveal } from "@/components/motion";
import { ProfileEditor } from "@/components/profile-editor";
import { RemindersModule } from "@/components/reminders";
import { SubscriptionBlock } from "@/components/subscription-block";
import { WorkHoursEditor } from "@/components/work-hours";
import { Card } from "@/components/ui";
import { useCancelLockDays } from "@/lib/cancel-policy";
import { exportLocalData, resetLocalData } from "@/lib/demo";
import { select, tap } from "@/lib/haptics";
import { resetOnboarding } from "@/lib/profile";
import { ROLE_LABEL, useRole, type Role } from "@/lib/role";

const ROLES: Role[] = ["psychologist", "client"];
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

export default function CabinetPage() {
  const [role, switchRole] = useRole();
  const psy = role === "psychologist";

  return (
    <div>
      <PageHead title="Личный кабинет">
        <ProfileEditor
          key={role}
          embedded
          professional={psy}
          roleControl={(
            <div className="grid grid-cols-2 gap-2 rounded-[18px] p-1 stroke" style={{ background: "rgba(255,255,255,.45)" }}>
              {ROLES.map((item) => (
                <button key={item} onClick={() => { select(); switchRole(item); }} className={`rounded-[13px] px-3 py-2 text-[13px] font-extrabold transition-all duration-200 ${role === item ? "bg-[var(--ink)] text-white" : "text-[var(--muted)] hover:bg-white/60"}`} aria-pressed={role === item}>
                  {ROLE_LABEL[item]}
                </button>
              ))}
            </div>
          )}
        />
      </PageHead>

      <Reveal y={10}>
      <div className="-mx-4 min-h-[64vh] space-y-6 rounded-t-[30px] px-4 pb-6 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)", borderTop: "var(--bw-lg) solid var(--edge-neutral)" }}>

        {/* Быстрые действия — под роль */}
        <div>
          <SectionTitle>Быстрые действия</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            {psy ? (
              <>
                <ModuleCard title="Мои клиенты" desc="Карточки и динамика" icon="users" fill="green" href="/clients" />
                <ModuleCard title="Сессии" desc="Записи и график" icon="calendar" fill="amber" href="/sessions" />
                <ModuleCard title="Каталог" desc="Профиль и коллеги" icon="compass" fill="purple" href="/catalog" />
                <ModuleCard title="Инструменты" desc="Методики и техники" icon="tools" fill="coral" href="/tools" />
              </>
            ) : (
              <>
                <ModuleCard title="Моя терапия" desc="Настроение и прогресс" icon="therapy" fill="green" href="/therapy" />
                <ModuleCard title="Практики" desc="Дыхание и медитации" icon="heart" fill="purple" href="/tools" />
                <ModuleCard title="Специалисты" desc="Каталог психологов" icon="compass" fill="amber" href="/catalog" />
                <ModuleCard title="Главная" desc="Обзор и разделы" icon="home" fill="cream" href="/" />
              </>
            )}
          </div>
        </div>

        {/* Управление — под роль */}
        <div className="space-y-3">
          <SectionTitle>{psy ? "Практика" : "Забота о себе"}</SectionTitle>
          {psy ? (
            <>
              <Foldable icon="clock" title="Настроить график" subtitle="Дни, свободные окна и длительность встреч">
                <WorkHoursEditor onSaved={() => {}} />
              </Foldable>
              <Foldable icon="spark" title="Подписка Вдох PRO" subtitle="Тарифы, триал и продвижение">
                <SubscriptionBlock variant="psy" />
              </Foldable>
              <Foldable icon="bell" title="Напоминания о сессиях" subtitle="Единые правила и настройка по клиентам">
                <RemindersModule />
              </Foldable>
            </>
          ) : (
            <Foldable icon="therapy" title="Подписка Вдох+" subtitle="Инструменты для себя между сессиями" defaultOpen>
              <SubscriptionBlock variant="client" />
            </Foldable>
          )}
        </div>

        {/* Уведомления */}
        <div>
          <SectionTitle>Уведомления</SectionTitle>
          <Card className="space-y-3">
            <NotifyGroup icon="calendar" title="Сессии" subtitle="Напоминания и изменения по записям">
              <ToggleRow label="Напоминание за сутки" storageKey="notify:session:day" defaultOn />
              <ToggleRow label="Напоминание за час" storageKey="notify:session:hour" defaultOn />
              <ToggleRow label="Перенос и отмена" storageKey="notify:session:changes" defaultOn />
            </NotifyGroup>
            <NotifyGroup icon="note" title="Задания" subtitle={psy ? "Домашняя работа между встречами" : "Домашки от терапевта"}>
              <ToggleRow label={psy ? "Клиент выполнил задание" : "Новое задание от терапевта"} storageKey="notify:task:new" defaultOn />
              <ToggleRow label="Напоминание о невыполненном" storageKey="notify:task:pending" />
            </NotifyGroup>
            {!psy && (
              <NotifyGroup icon="mood" title="Забота" subtitle="Мягкие напоминания о себе">
                <ToggleRow label="Ежедневный чек-ин настроения" storageKey="notify:care:mood" defaultOn />
                <ToggleRow label="Идеи практик на неделю" storageKey="notify:care:practice" />
              </NotifyGroup>
            )}
            <QuietHoursRow />
            {psy && <CancelLockRow />}
          </Card>
        </div>

        {/* Приватность и данные */}
        <div>
          <SectionTitle>Приватность и данные</SectionTitle>
          <Card className="space-y-1">
            <ActionRow icon="chart" title="Экспортировать мои данные" sub="Скачать всё, что хранит приложение, в JSON" onClick={downloadData} />
            <ActionRow icon="compass" title="Пройти знакомство заново" sub="Показать онбординг ещё раз" onClick={() => resetOnboarding()} />
            <ActionRow icon="gear" title="Очистить данные на устройстве" sub="Сбросить демо к исходному состоянию" danger onClick={() => { if (confirm("Очистить локальные данные и вернуть демо к началу?")) { resetLocalData(); location.reload(); } }} />
          </Card>
        </div>

        {/* Приглашения */}
        <div>
          <SectionTitle>Приглашайте друзей</SectionTitle>
          <InviteBanner variant={psy ? "psy" : "client"} />
        </div>

        {/* Отдел заботы — центр-создатель + связь */}
        <div>
          <SectionTitle>Отдел заботы</SectionTitle>
          <CareModule />
        </div>

        {/* О приложении */}
        <div>
          <SectionTitle>О приложении</SectionTitle>
          <Card className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ background: "var(--olive-soft)", border: "var(--bw) solid var(--olive-edge)" }}><Icon name="therapy" width={22} weight="bold" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-black">Берег</p>
              <p className="text-[11.5px] font-semibold text-[var(--muted)]">Демо-прототип · центр «Амур и Психея». Данные живут только на этом устройстве.</p>
            </div>
          </Card>
        </div>

      </div>
      </Reveal>
    </div>
  );
}

// Скачать локальные данные приложения одним JSON-файлом.
function downloadData() {
  tap();
  const blob = new Blob([exportLocalData()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bereg-data.json";
  a.click();
  URL.revokeObjectURL(url);
}

// Сворачиваемая секция-карточка: компактная шапка, раскрывается вниз.
function Foldable({ icon, title, subtitle, children, defaultOpen = false }: { icon: IconName; title: string; subtitle: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="chunk overflow-hidden">
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl stroke" style={{ background: "var(--head-soft)" }}><Icon name={icon} width={18} /></span>
        <span className="flex-1">
          <span className="block text-[14px] font-bold">{title}</span>
          <span className="block text-[12px] text-[var(--muted)]">{subtitle}</span>
        </span>
        <span className="text-[var(--muted-2)] transition-transform duration-300" style={{ transform: open ? "rotate(90deg)" : "none" }}>›</span>
      </button>
      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} style={{ transitionTimingFunction: "var(--ease-out)" }} aria-hidden={!open} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--edge-neutral)" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// Строка-действие в списке настроек: иконка + заголовок/описание + шеврон.
function ActionRow({ icon, title, sub, onClick, danger }: { icon: IconName; title: string; sub: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-[14px] px-1.5 py-2 text-left transition-colors hover:bg-[var(--head-soft)] active:scale-[0.99]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl stroke" style={{ background: danger ? "var(--salmon-soft)" : "var(--head-soft)" }}><Icon name={icon} width={17} color={danger ? "var(--salmon-edge)" : undefined} /></span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13.5px] font-bold ${danger ? "text-[var(--salmon-edge)]" : ""}`}>{title}</span>
        <span className="block text-[11.5px] font-semibold text-[var(--muted)]">{sub}</span>
      </span>
      <span className="text-[var(--muted-2)]">›</span>
    </button>
  );
}

function CancelLockRow() {
  const [days, setDays] = useCancelLockDays();
  return (
    <div className="rounded-[16px] p-3" style={{ background: "var(--surface-2)", border: "var(--bw) solid var(--edge-neutral)" }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white" style={{ border: "var(--bw) solid var(--edge-neutral)" }}><Icon name="clock" width={16} weight="bold" /></span>
          <span className="text-[13px] font-black">Запрет отмены сессий</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => { select(); setDays(Math.max(0, days - 1)); }} className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-[18px] font-black stroke" aria-label="Меньше">−</button>
          <span className="flex h-8 min-w-[64px] items-center justify-center rounded-[10px] px-2 text-[12px] font-black" style={{ background: days ? "var(--head-soft)" : "#fff", border: `var(--bw) solid ${days ? "var(--edge)" : "var(--edge-neutral)"}` }}>{days === 0 ? "выкл" : `${days} дн.`}</span>
          <button onClick={() => { select(); setDays(Math.min(7, days + 1)); }} className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-[18px] font-black stroke" aria-label="Больше">+</button>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] font-medium text-[var(--muted-2)]">{days === 0 ? "Клиент может отменить сессию в любое время." : `Клиент не сможет отменить менее чем за ${days} дн. до сессии — только через вас.`}</p>
    </div>
  );
}

// Тихие часы: окно «не беспокоить» с двумя временами.
function QuietHoursRow() {
  const [on, setOn] = useState(false);
  const [from, setFrom] = useState("22:00");
  const [to, setTo] = useState("08:00");
  useEffect(() => {
    setOn(localStorage.getItem("quiet:on") === "1");
    const f = localStorage.getItem("quiet:from"); if (f) setFrom(f);
    const t = localStorage.getItem("quiet:to"); if (t) setTo(t);
  }, []);
  const toggle = () => { select(); setOn((cur) => { const next = !cur; localStorage.setItem("quiet:on", next ? "1" : "0"); return next; }); };
  const setF = (v: string) => { select(); setFrom(v); localStorage.setItem("quiet:from", v); };
  const setT = (v: string) => { select(); setTo(v); localStorage.setItem("quiet:to", v); };
  return (
    <div className="rounded-[16px] p-3" style={{ background: "var(--surface-2)", border: "var(--bw) solid var(--edge-neutral)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white" style={{ border: "var(--bw) solid var(--edge-neutral)" }}><Icon name="moon" width={16} weight="bold" /></span>
          <span><span className="block text-[13px] font-black leading-none">Тихие часы</span><span className="mt-0.5 block text-[11px] font-semibold text-[var(--muted)]">Без звука уведомлений ночью</span></span>
        </div>
        <Switch on={on} onToggle={toggle} />
      </div>
      {on && (
        <div className="mt-3 flex items-center gap-2">
          <TimeSelect value={from} onChange={setF} />
          <span className="text-[13px] font-black text-[var(--muted-2)]">→</span>
          <TimeSelect value={to} onChange={setT} />
          <span className="ml-auto text-[11px] font-semibold text-[var(--muted-2)]">без звука</span>
        </div>
      )}
    </div>
  );
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-[10px] bg-white px-2.5 py-1.5 text-[13px] font-black outline-none" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
      {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
    </select>
  );
}

// Группа настроек уведомлений: заголовок с иконкой + переключатели.
function NotifyGroup({ icon, title, subtitle, children }: { icon: IconName; title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-[16px] p-3" style={{ background: "var(--surface-2)", border: "var(--bw) solid var(--edge-neutral)" }}>
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white" style={{ border: "var(--bw) solid var(--edge-neutral)" }}><Icon name={icon} width={16} weight="bold" /></span>
        <span><span className="block text-[13px] font-black leading-none">{title}</span><span className="mt-0.5 block text-[11px] font-semibold text-[var(--muted)]">{subtitle}</span></span>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function ToggleRow({ label, defaultOn, storageKey }: { label: string; defaultOn?: boolean; storageKey?: string }) {
  const [on, setOn] = useState(!!defaultOn);
  useEffect(() => {
    if (!storageKey) return;
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) setOn(saved === "1");
  }, [storageKey]);
  const toggle = () => {
    select();
    setOn((cur) => { const next = !cur; if (storageKey) localStorage.setItem(storageKey, next ? "1" : "0"); return next; });
  };
  return (
    <button onClick={toggle} className="flex w-full items-center justify-between">
      <span className="text-[13px] font-semibold">{label}</span>
      <Switch on={on} onToggle={toggle} inline />
    </button>
  );
}

// Переключатель-тумблер (общий для настроек).
function Switch({ on, onToggle, inline }: { on: boolean; onToggle: () => void; inline?: boolean }) {
  const inner = (
    <span className={`flex h-6 w-10 items-center rounded-full p-0.5 transition-colors duration-200 ${on ? "" : "bg-[#e2e0d8]"}`} style={on ? { background: "var(--a1)" } : undefined}>
      <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-4" : ""}`} style={{ transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)" }} />
    </span>
  );
  if (inline) return inner;
  return <button onClick={onToggle} aria-pressed={on}>{inner}</button>;
}
