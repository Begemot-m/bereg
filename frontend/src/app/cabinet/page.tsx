"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { PageHead, SectionTitle } from "@/components/blocks";
import { CareModule } from "@/components/care-module";
import { Icon, type IconName } from "@/components/icons";
import { InviteBanner } from "@/components/invite";
import { Reveal } from "@/components/motion";
import { ProfileEditor } from "@/components/profile-editor";
import { RemindersModule } from "@/components/reminders";
import { SubscriptionBlock } from "@/components/subscription-block";
import { Card } from "@/components/ui";
import { APP_NAME, CENTER, TAGLINE } from "@/lib/brand";
import { useCancelLockDays } from "@/lib/cancel-policy";
import { select, tap } from "@/lib/haptics";
import { resetOnboarding } from "@/lib/profile";
import { ROLE_LABEL, useRole, type Role } from "@/lib/role";

const ROLES: Role[] = ["psychologist", "client"];

export default function CabinetPage() {
  const [role, switchRole] = useRole();

  return (
    <div>
      <PageHead title="Личный кабинет">
        <ProfileEditor
          key={role}
          embedded
          professional={role === "psychologist"}
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

        {role === "psychologist" && (
          <Link href="/sessions" onClick={tap} className="group flex items-center gap-3 rounded-[18px] p-3.5 transition-transform active:scale-[0.99]" style={{ background: "var(--green-soft)", border: "var(--bw-lg) solid var(--green-edge)" }}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-white" style={{ border: "var(--bw) solid var(--green-edge)" }}><Icon name="clock" width={19} weight="bold" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[13px] font-black">Рабочие часы — в Сессиях</span><span className="block text-[11px] font-semibold text-[var(--muted)]">Настройте дни, окна и длительность встреч</span></span>
            <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-white transition-transform group-hover:rotate-12" style={{ border: "var(--bw) solid var(--green-edge)" }}><Icon name="gear" width={17} weight="bold" /></span>
          </Link>
        )}

        {role === "psychologist" && (
          <Foldable icon="spark" title="Подписка" subtitle="Тарифы, триал и продвижение">
            <SubscriptionBlock variant="psy" />
          </Foldable>
        )}

        {role === "psychologist" && (
          <Foldable icon="bell" title="Напоминания о сессиях" subtitle="Единые правила и настройка по клиентам">
            <RemindersModule />
          </Foldable>
        )}

        {/* Настройки */}
        <div>
          <SectionTitle>Настройки</SectionTitle>
          <Card className="space-y-3">
            <ToggleRow label="Уведомления о заданиях" defaultOn />
            <ToggleRow label="Тихие часы (22:00–8:00)" />
            {role === "psychologist" && <CancelLockRow />}
            <button onClick={() => { tap(); resetOnboarding(); }} className="w-full pt-1 text-left text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
              Пройти знакомство заново
            </button>
          </Card>
        </div>

        {/* Приглашения */}
        <div>
          <SectionTitle>Приглашайте друзей</SectionTitle>
          <InviteBanner variant={role === "psychologist" ? "psy" : "client"} />
        </div>

        {/* Отдел заботы */}
        <div>
          <SectionTitle>Отдел заботы</SectionTitle>
          <CareModule />
        </div>

        {/* Центр */}
        <div className="chunk overflow-hidden">
          <div className="flex items-center gap-3 p-4" style={{ background: "var(--ink)" }}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] text-[18px] font-black text-[var(--ink)]" style={{ background: "var(--amber)" }}>{APP_NAME.charAt(0)}</span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(255,255,255,.6)]">Платформу создал центр</p>
              <p className="font-tight text-[18px] font-black text-white">{CENTER}</p>
            </div>
          </div>
          <p className="p-4 text-[13px] leading-relaxed text-[var(--muted)]">{TAGLINE}. {APP_NAME} — инструмент центра для качественной помощи и самопомощи.</p>
        </div>
      </div>
      </Reveal>
    </div>
  );
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

function CancelLockRow() {
  const [days, setDays] = useCancelLockDays();
  return (
    <div className="border-t pt-3" style={{ borderColor: "var(--edge-neutral)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px]">Запрет отмены сессий</span>
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

function ToggleRow({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <button onClick={() => { select(); setOn(!on); }} className="flex w-full items-center justify-between">
      <span className="text-[13px]">{label}</span>
      <span className={`flex h-6 w-10 items-center rounded-full p-0.5 transition-colors duration-200 ${on ? "" : "bg-[#e2e0d8]"}`} style={on ? { background: "var(--a1)" } : undefined}>
        <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-4" : ""}`} style={{ transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)" }} />
      </span>
    </button>
  );
}
