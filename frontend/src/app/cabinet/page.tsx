"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Arrow, PageHead, SectionTitle, ArrowGlyph } from "@/components/blocks";
import { CareModule } from "@/components/care-module";
import { Icon, type IconName } from "@/components/icons";
import { InviteBanner } from "@/components/invite";
import { Reveal } from "@/components/motion";
import { ProfileEditor } from "@/components/profile-editor";
import { resetTours } from "@/components/room-tour";
import { SubscriptionBanner } from "@/components/subscription-block";
import { Card, Input } from "@/components/ui";
import { isEmail, useAccountEmail } from "@/lib/account";
import { useMe } from "@/lib/me";
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
      <div className="-mx-4 min-h-[64vh] space-y-6 rounded-t-[27px] px-4 pb-6 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)" }}>

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

        {/* Учётная запись */}
        <div>
          <SectionTitle>Учётная запись</SectionTitle>
          <EmailLink />
        </div>

        {/* Видно только владельцу платформы */}
        <AdminEntry />

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
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]" style={{ background: "var(--olive-soft)", border: "var(--bw) solid var(--olive-edge)" }}><Icon name="therapy" width={22} weight="bold" /></span>
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

// Вход в админку. Обычный пользователь этого блока не видит и по прямой
// ссылке ничего не получит: роуты админки отвечают 403.
function AdminEntry() {
  const me = useMe();
  if (!me.data?.isAdmin) return null;

  return (
    <div>
      <SectionTitle>Платформа</SectionTitle>
      <Link href="/admin" onClick={tap} className="card flex items-center gap-3 p-3.5 transition-transform active:scale-[0.99]">
        <span className="ico ico-accent h-11 w-11 shrink-0"><Icon name="gear" width={20} weight="bold" color="#fff" /></span>
        <span className="min-w-0 flex-1">
          <span className="t-micro block">Только для вас</span>
          <span className="t-head mt-0.5 block leading-tight">Админка</span>
          <span className="t-cap mt-0.5 block">Сводка, пользователи, выдача доступа</span>
        </span>
        <Arrow />
      </Link>
    </div>
  );
}

// Привязка почты: вход не только из Telegram. В демо — на устройстве.
function EmailLink() {
  const [email, setEmail] = useAccountEmail();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const ok = isEmail(draft);

  if (email && !editing) {
    return (
      <Card className="flex items-center gap-3">
        <span className="ico h-11 w-11 shrink-0"><Icon name="check" width={20} weight="bold" color="var(--edge)" /></span>
        <div className="min-w-0 flex-1">
          <p className="t-cap">Почта привязана</p>
          <p className="font-tight truncate text-[14px] font-bold">{email}</p>
        </div>
        <button onClick={() => { tap(); setDraft(email); setEditing(true); }} className="btn btn-white shrink-0 px-3 py-1.5 text-[12px]">Изменить</button>
      </Card>
    );
  }

  return (
    <Card>
      <p className="t-cap">Привяжите почту, чтобы входить не только через Telegram.</p>
      <div className="mt-2.5 flex gap-2">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          enterKeyHint="done"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="you@example.com"
        />
        <button
          disabled={!ok}
          onClick={() => { tap(); setEmail(draft); setEditing(false); }}
          className="btn btn-accent shrink-0 px-3.5 py-2 text-[12px]"
        >
          Привязать
        </button>
      </div>
      {email && (
        <div className="mt-2 flex items-center justify-between">
          <button onClick={() => { setEditing(false); setDraft(""); }} className="text-[12px] font-bold text-[var(--muted)]">Отмена</button>
          <button onClick={() => { if (confirm("Отвязать почту?")) { setEmail(null); setEditing(false); setDraft(""); } }} className="text-[12px] font-bold" style={{ color: "var(--danger)" }}>Отвязать</button>
        </div>
      )}
      {draft && !ok && <p className="mt-1.5 text-[11px] font-semibold" style={{ color: "var(--danger)" }}>Похоже, в адресе опечатка</p>}
    </Card>
  );
}

// Переключатель роли: скользящая тёмная плашка (layoutId) + иконки.
function RoleSwitch({ role, onSwitch }: { role: Role; onSwitch: (r: Role) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-[17px] p-1 stroke" style={{ background: "rgba(255,255,255,.5)" }}>
      {ROLES.map((item) => {
        const active = role === item;
        return (
          <button key={item} onClick={() => { select(); onSwitch(item); }} className="relative flex items-center justify-center gap-1.5 rounded-[12px] px-3 py-2 text-[13px] font-extrabold transition-colors duration-200" style={{ color: active ? "#fff" : "var(--muted)" }} aria-pressed={active}>
            {active && <motion.span layoutId="role-pill" className="absolute inset-0 rounded-[12px] bg-[var(--ink)]" transition={{ type: "spring", stiffness: 480, damping: 34 }} />}
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
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={tone ? { background: `var(--${tone}-soft)`, border: `var(--bw) solid var(--${tone}-edge)` } : { background: "var(--head-soft)", border: "var(--bw) solid var(--stroke)" }}><Icon name={icon} width={18} color={tone ? `var(--${tone}-edge)` : undefined} /></span>
        <span className="flex-1">
          <span className="font-tight block text-[14px] font-bold">{title}</span>
          <span className="t-cap block">{subtitle}</span>
        </span>
        <span className="arrow" style={{ transform: open ? "rotate(90deg)" : "none" }}><ArrowGlyph /></span>
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
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-[12px] px-1.5 py-2 text-left transition-colors hover:bg-[var(--head-soft)] active:scale-[0.99]">
      <span className="ico h-9 w-9 shrink-0" style={danger ? { background: "var(--salmon)" } : undefined}><Icon name={icon} width={17} color={danger ? "#fff" : "var(--edge)"} /></span>
      <span className="min-w-0 flex-1">
        <span className={`font-tight block text-[13.5px] font-bold ${danger ? "text-[var(--salmon-edge)]" : ""}`}>{title}</span>
        <span className="t-cap block">{sub}</span>
      </span>
      <Arrow />
    </button>
  );
}

