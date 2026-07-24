"use client";

import { motion } from "motion/react";
import { useState, type ReactNode } from "react";

import { PageHead, SectionTitle } from "@/components/blocks";
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
import { resetLocalData } from "@/lib/demo";
import { select, tap } from "@/lib/haptics";
import { resetOnboarding } from "@/lib/profile";
import { ROLE_LABEL, useRole, type Role } from "@/lib/role";

const ROLES: Role[] = ["psychologist", "client"];

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
          roleControl={<RoleSwitch role={role} onSwitch={switchRole} />}
        />
      </PageHead>

      <Reveal y={10}>
      <div className="-mx-4 min-h-[64vh] space-y-6 rounded-t-[30px] px-4 pb-6 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)", borderTop: "var(--bw-lg) solid var(--edge-neutral)" }}>

        {/* Управление — под роль */}
        <div className="space-y-3">
          <SectionTitle>{psy ? "Практика" : "Забота о себе"}</SectionTitle>
          {psy ? (
            <>
              <Foldable icon="clock" title="Настроить график" subtitle="Дни, свободные окна и длительность встреч">
                <WorkHoursEditor onSaved={() => {}} />
              </Foldable>
              <Foldable icon="spark" title="Подписка Клубок PRO" subtitle="990 ₽/мес · кабинет, статистика, каталог" tone="purple">
                <SubscriptionBlock variant="psy" />
              </Foldable>
              <Foldable icon="bell" title="Напоминания о сессиях" subtitle="Единые правила и Telegram-бот">
                <RemindersModule />
              </Foldable>
              <CancelLockRow />
            </>
          ) : (
            <Foldable icon="therapy" title="Подписка Клубок+" subtitle="390 ₽/мес · настроение, колесо, практики" tone="purple">
              <SubscriptionBlock variant="client" />
            </Foldable>
          )}
        </div>

        {/* Приватность и данные */}
        <div>
          <SectionTitle>Приватность и данные</SectionTitle>
          <Card className="space-y-1">
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
              <p className="text-[14px] font-black">Клубок</p>
              <p className="text-[11.5px] font-semibold text-[var(--muted)]">Демо-прототип · центр «Амур и Психея». Данные живут только на этом устройстве.</p>
            </div>
          </Card>
        </div>

      </div>
      </Reveal>
    </div>
  );
}

// Переключатель роли: скользящая тёмная плашка (layoutId) + иконки.
function RoleSwitch({ role, onSwitch }: { role: Role; onSwitch: (r: Role) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-[18px] p-1 stroke" style={{ background: "rgba(255,255,255,.5)" }}>
      {ROLES.map((item) => {
        const active = role === item;
        return (
          <button key={item} onClick={() => { select(); onSwitch(item); }} className="relative flex items-center justify-center gap-1.5 rounded-[13px] px-3 py-2 text-[13px] font-extrabold transition-colors duration-200" style={{ color: active ? "#fff" : "var(--muted)" }} aria-pressed={active}>
            {active && <motion.span layoutId="role-pill" className="absolute inset-0 rounded-[13px] bg-[var(--ink)]" transition={{ type: "spring", stiffness: 480, damping: 34 }} />}
            <span className="relative z-[1] flex items-center gap-1.5"><Icon name={item === "psychologist" ? "therapy" : "user"} width={15} weight="bold" color={active ? "#fff" : "var(--muted)"} /> {ROLE_LABEL[item]}</span>
          </button>
        );
      })}
    </div>
  );
}

// Сворачиваемая секция-карточка: компактная шапка, раскрывается вниз.
function Foldable({ icon, title, subtitle, children, defaultOpen = false, tone }: { icon: IconName; title: string; subtitle: string; children: ReactNode; defaultOpen?: boolean; tone?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="chunk overflow-hidden" style={tone ? { borderColor: `var(--${tone}-edge)` } : undefined}>
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={tone ? { background: `var(--${tone}-soft)`, border: `var(--bw) solid var(--${tone}-edge)` } : { background: "var(--head-soft)", border: "var(--bw) solid var(--stroke)" }}><Icon name={icon} width={18} color={tone ? `var(--${tone}-edge)` : undefined} /></span>
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

// Запрет отмены сессий — остаётся в «Практике».
function CancelLockRow() {
  const [days, setDays] = useCancelLockDays();
  return (
    <div className="rounded-[16px] bg-[var(--surface-2)] p-3.5" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl stroke bg-white"><Icon name="clock" width={17} weight="bold" /></span>
          <span className="text-[13px] font-black">Запрет отмены сессий</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => { select(); setDays(Math.max(0, days - 1)); }} className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-[18px] font-black stroke" aria-label="Меньше">−</button>
          <span className="flex h-8 min-w-[64px] items-center justify-center rounded-[10px] px-2 text-[12px] font-black" style={{ background: days ? "var(--head-soft)" : "#fff", border: `var(--bw) solid ${days ? "var(--edge)" : "var(--edge-neutral)"}` }}>{days === 0 ? "выкл" : `${days} дн.`}</span>
          <button onClick={() => { select(); setDays(Math.min(7, days + 1)); }} className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-[18px] font-black stroke" aria-label="Больше">+</button>
        </div>
      </div>
      <p className="mt-2 text-[11px] font-medium text-[var(--muted-2)]">{days === 0 ? "Клиент может отменить сессию в любое время." : `Клиент не сможет отменить менее чем за ${days} дн. до сессии — только через вас.`}</p>
    </div>
  );
}
