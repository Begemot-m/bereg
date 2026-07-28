"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Arrow, PageHead, SectionTitle } from "@/components/blocks";
import { CareModule } from "@/components/care-module";
import { Icon, type IconName } from "@/components/icons";
import { InviteBanner } from "@/components/invite";
import { Reveal } from "@/components/motion";
import { ProfileEditor } from "@/components/profile-editor";
import { resetTours } from "@/components/room-tour";
import { SubscriptionBanner } from "@/components/subscription-block";
import { Card } from "@/components/ui";
import { resetLocalData } from "@/lib/demo";
import { select, tap } from "@/lib/haptics";
import { resetOnboarding } from "@/lib/profile";
import { ROLE_LABEL, useRole, type Role } from "@/lib/role";

const ROLES: Role[] = ["psychologist", "client"];

// Когда собрана эта версия. Если после деплоя тут старая дата — вебвью
// показывает страницу из кеша, а не новую сборку.
function buildLabel(): string {
  const raw = process.env.NEXT_PUBLIC_BUILD;
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export default function CabinetPage() {
  const [role, switchRole] = useRole();
  const router = useRouter();
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
      <div className="-mx-4 min-h-[64vh] space-y-6 rounded-t-[18px] px-4 pb-6 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)" }}>

        {/* Управление — под роль */}
        <div className="space-y-3">
          <SectionTitle>{psy ? "Практика" : "Забота о себе"}</SectionTitle>
          {psy ? (
            <>
              <SubscriptionBanner variant="psy" />
              <ActionRow icon="clock" title="График и правила приёма" sub="Рабочие часы, напоминания, запрет отмены — в разделе «Сессии»" onClick={() => { tap(); router.push("/sessions"); }} />
            </>
          ) : (
            <SubscriptionBanner variant="client" />
          )}
        </div>

        {/* Приватность и данные */}
        <div>
          <SectionTitle>Приватность и данные</SectionTitle>
          <Card className="space-y-1">
            <ActionRow icon="compass" title="Пройти знакомство заново" sub="Онбординг и экскурсия по разделам" onClick={() => { resetTours(); resetOnboarding(); }} />
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
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px]" style={{ background: "var(--olive-soft)", border: "var(--bw) solid var(--olive-edge)" }}><Icon name="therapy" width={22} weight="bold" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-black">Методика</p>
              <p className="text-[11.5px] font-semibold text-[var(--muted)]">Демо-прототип · центр «Амур и Психея». Данные живут только на этом устройстве.</p>
              <p className="tnum mt-1 text-[10.5px] font-black text-[var(--muted-2)]">Сборка от {buildLabel()}</p>
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
    <div className="grid grid-cols-2 gap-1 rounded-[11px] p-1 stroke" style={{ background: "rgba(255,255,255,.5)" }}>
      {ROLES.map((item) => {
        const active = role === item;
        return (
          <button key={item} onClick={() => { select(); onSwitch(item); }} className="relative flex items-center justify-center gap-1.5 rounded-[8px] px-3 py-2 text-[13px] font-extrabold transition-colors duration-200" style={{ color: active ? "#fff" : "var(--muted)" }} aria-pressed={active}>
            {active && <motion.span layoutId="role-pill" className="absolute inset-0 rounded-[8px] bg-[var(--ink)]" transition={{ type: "spring", stiffness: 480, damping: 34 }} />}
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
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px]" style={tone ? { background: `var(--${tone}-soft)`, border: `var(--bw) solid var(--${tone}-edge)` } : { background: "var(--head-soft)", border: "var(--bw) solid var(--stroke)" }}><Icon name={icon} width={18} color={tone ? `var(--${tone}-edge)` : undefined} /></span>
        <span className="flex-1">
          <span className="font-tight block text-[14px] font-bold">{title}</span>
          <span className="t-cap block">{subtitle}</span>
        </span>
        <span className="arrow" style={{ transform: open ? "rotate(90deg)" : "none" }}>›</span>
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
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-[8px] px-1.5 py-2 text-left transition-colors hover:bg-[var(--head-soft)] active:scale-[0.99]">
      <span className="ico h-9 w-9 shrink-0" style={danger ? { background: "var(--salmon)" } : undefined}><Icon name={icon} width={17} color={danger ? "#fff" : "var(--edge)"} /></span>
      <span className="min-w-0 flex-1">
        <span className={`font-tight block text-[13.5px] font-bold ${danger ? "text-[var(--salmon-edge)]" : ""}`}>{title}</span>
        <span className="t-cap block">{sub}</span>
      </span>
      <Arrow />
    </button>
  );
}

