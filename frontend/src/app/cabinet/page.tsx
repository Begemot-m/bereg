"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Arrow, PageHead, SectionTitle, ArrowGlyph } from "@/components/blocks";
import { CareModule } from "@/components/care-module";
import { Icon, type IconName } from "@/components/icons";
import { InviteBanner } from "@/components/invite";
import { Reveal } from "@/components/motion";
import { ProfileEditor } from "@/components/profile-editor";
import { RemindersModule } from "@/components/reminders";
import { resetTours } from "@/components/room-tour";
import { SubscriptionBanner } from "@/components/subscription-block";
import { Card, Input } from "@/components/ui";
import { bindAccountEmail, confirmAccountEmail, getAccountEmail, isEmail, unbindAccountEmail } from "@/lib/account";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/me";
import { DEMO, resetLocalData } from "@/lib/demo";
import { select, tap } from "@/lib/haptics";
import { resetOnboarding } from "@/lib/profile";
import { getRoleIntent, ROLE_LABEL, useRole, type Role } from "@/lib/role";

const ROLES: Role[] = ["psychologist", "client"];
const PSY_APPLY_LINK = "https://t.me/+79117230099";

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
    <div className="stroke-mid">
      <PageHead title="Личный кабинет">
        <ProfileEditor
          key={role}
          embedded
          professional={psy}
          roleControl={<RoleControl role={role} onSwitch={switchRole} />}
        />
      </PageHead>

      <Reveal y={10}>
      <div className="-mx-4 min-h-[64vh] space-y-6 rounded-t-[27px] px-4 pb-6 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)" }}>

        {/* Управление — под роль */}
        <div className="space-y-3">
          <SectionTitle>{psy ? "Практика" : "Забота о себе"}</SectionTitle>
          {psy ? (
            <SubscriptionBanner variant="psy" />
          ) : (
            <div className="card-soft flex items-start gap-3 p-4" style={{ background: "var(--purple-soft)" }}>
              <span className="ico ico-white h-11 w-11 shrink-0"><Icon name="spark" width={21} weight="bold" color="var(--purple-edge)" /></span>
              <div className="min-w-0">
                <p className="t-micro" style={{ color: "var(--purple-edge)" }}>Хроника PRO</p>
                <p className="t-body mt-1">Скоро появятся расширенные инструменты для самостоятельной работы по подписке PRO.</p>
              </div>
            </div>
          )}
        </div>

        {!psy && (
          <div>
            <SectionTitle>Напоминания о сессиях</SectionTitle>
            <RemindersModule />
          </div>
        )}

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
          <div className="card-soft mb-3 flex items-start gap-3 p-4">
            <span className="ico ico-white h-11 w-11 shrink-0"><Icon name="lock" width={21} weight="bold" color="var(--edge)" /></span>
            <p className="t-body">Ваши данные конфиденциальны. Чувствительные сведения хранятся в зашифрованном виде. При желании вы можете удалить все сведения о себе и использовании сервиса.</p>
          </div>
          <Card className="space-y-1">
            <ActionRow
              icon="book"
              title="Политика обработки данных"
              sub="Что храним, зачем и сколько"
              onClick={() => router.push("/policy")}
            />
            <ActionRow icon="compass" title="Пройти знакомство заново" sub="Онбординг и экскурсия по разделам" onClick={() => { resetTours(); resetOnboarding(); }} />
            <ActionRow icon="gear" title="Очистить данные на устройстве" sub="Удалить все сведения о себе" danger onClick={() => { if (confirm("Удалить все данные на этом устройстве?")) { resetLocalData(); location.reload(); } }} />
            <DeleteAccountRow />
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
              <p className="text-[14px] font-black">Хроника</p>
              <p className="text-[11.5px] font-semibold text-[var(--muted)]">Платформа центра «Амур и Психея».</p>
              <p className="tnum mt-1 text-[10.5px] font-black text-[var(--muted-2)]">Сборка от {buildLabel()}</p>
            </div>
          </Card>
        </div>

      </div>
      </Reveal>
    </div>
  );
}

// Удаление аккаунта. Двойное подтверждение не для красоты: действие
// необратимо, а дневник и заметки стираются сразу.
function DeleteAccountRow() {
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!confirm("Удалить аккаунт? Дневник, заметки и колесо будут стёрты безвозвратно.")) return;
    if (!confirm("Точно? Это нельзя отменить.")) return;
    setBusy(true);
    try {
      await apiFetch("/my/account", { method: "DELETE" });
      location.href = "/";
    } catch {
      alert("Не получилось. Попробуйте ещё раз или напишите в отдел заботы.");
      setBusy(false);
    }
  };

  if (DEMO) return null;
  return (
    <ActionRow
      icon="user"
      title={busy ? "Удаляем…" : "Удалить аккаунт"}
      sub="Стирает данные и закрывает доступ"
      danger
      onClick={remove}
    />
  );
}

// Вход в админку. Обычный пользователь этого блока не видит и по прямой
// ссылке ничего не получит: роуты админки отвечают 403.
function AdminEntry() {
  const me = useMe();
  if (!me.data?.isAdmin || me.data.username?.replace(/^@/, "").toLowerCase() !== "mmgorba") return null;

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

function EmailLink() {
  const qc = useQueryClient();
  const account = useQuery({
    queryKey: ["account-email"],
    queryFn: getAccountEmail,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => query.state.data?.email && !query.state.data.verified ? 5000 : false,
  });
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const ok = isEmail(draft);
  const email = account.data?.email ?? null;

  const bind = useMutation({
    mutationFn: bindAccountEmail,
    onSuccess: (data) => {
      qc.setQueryData(["account-email"], data);
      setNotice(data.message ?? "Ссылка для подтверждения отправлена на почту");
      setEditing(false);
    },
    onError: () => setNotice("Не удалось отправить письмо. Попробуйте ещё раз."),
  });
  const verify = useMutation({
    mutationFn: confirmAccountEmail,
    onSuccess: (data) => { qc.setQueryData(["account-email"], data); setNotice(""); },
  });
  const unbind = useMutation({
    mutationFn: unbindAccountEmail,
    onSuccess: () => { qc.setQueryData(["account-email"], { email: null, verified: false }); setDraft(""); setEditing(false); setNotice(""); },
  });

  if (email && account.data?.verified && !editing) {
    return (
      <Card style={{ borderColor: "var(--head)" }}>
        <div className="flex items-center gap-3">
          <span className="ico ico-mid h-11 w-11 shrink-0"><Icon name="check" width={20} weight="bold" color="#fff" /></span>
          <div className="min-w-0 flex-1">
            <p className="t-head">Успешно привязана почта</p>
            <p className="t-cap truncate">{email}</p>
          </div>
          <button onClick={() => { tap(); setDraft(email); setEditing(true); }} className="btn btn-white shrink-0 px-3 py-1.5 text-[12px]">Изменить</button>
        </div>
        <p className="t-body mt-3">С этой почтой вы входите в десктопную версию на других устройствах.</p>
      </Card>
    );
  }

  if (email && !editing) {
    return (
      <Card style={{ borderColor: "var(--head)" }}>
        <div className="flex items-center gap-3">
          <span className="ico h-11 w-11 shrink-0"><Icon name="telegram" width={20} weight="bold" color="var(--edge)" /></span>
          <div className="min-w-0 flex-1">
            <p className="t-head">Подтверждение отправлено</p>
            <p className="t-cap truncate">{email}</p>
          </div>
        </div>
        <p className="t-body mt-3">{notice || "Перейдите по ссылке из письма, чтобы подтвердить адрес."}</p>
        <div className="mt-3 flex gap-2">
          {account.data?.canConfirm && <button onClick={() => { tap(); verify.mutate(); }} disabled={verify.isPending} className="btn flex-1" style={{ background: "var(--head)", borderColor: "var(--head)", color: "#fff" }}>Подтвердить</button>}
          <button onClick={() => { tap(); setDraft(email); setEditing(true); }} className="btn btn-white flex-1">Изменить</button>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ borderColor: "var(--head)" }}>
      <p className="t-cap">Привяжите почту, чтобы входить в десктопную версию на других устройствах.</p>
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
          onClick={() => { tap(); bind.mutate(draft); }}
          disabled={!ok || bind.isPending}
          className="btn shrink-0 px-3.5 py-2 text-[12px]"
          style={{ background: "var(--head)", borderColor: "var(--head)", color: "#fff" }}
        >
          {bind.isPending ? "Отправляем…" : "Привязать"}
        </button>
      </div>
      {email && (
        <div className="mt-2 flex items-center justify-between">
          <button onClick={() => { setEditing(false); setDraft(""); }} className="text-[12px] font-bold text-[var(--muted)]">Отмена</button>
          <button onClick={() => { if (confirm("Отвязать почту?")) unbind.mutate(); }} className="text-[12px] font-bold" style={{ color: "var(--danger)" }}>Отвязать</button>
        </div>
      )}
      {draft && !ok && <p className="mt-1.5 text-[11px] font-semibold" style={{ color: "var(--danger)" }}>Похоже, в адресе опечатка</p>}
      {notice && <p className="t-cap mt-2" style={{ color: "var(--danger)" }}>{notice}</p>}
    </Card>
  );
}

// Переключатель ролей видят те, у кого учётная запись психолога, и те, кто в
// онбординге выбрал психолога, — им платформа ещё пригодится в обеих ролях.
// Тот, кто вошёл клиентом и психологом не зарегистрирован, вместо тумблера
// получает заявку.
function RoleControl({ role, onSwitch }: { role: Role; onSwitch: (r: Role) => void }) {
  const me = useMe();
  const [intent, setIntent] = useState<Role | null>(null);
  useEffect(() => setIntent(getRoleIntent()), []);
  const isPsy = me.data?.role === "psychologist";
  const canSwitch = isPsy || intent === "psychologist";

  useEffect(() => {
    if (me.data && !canSwitch && role === "psychologist") onSwitch("client");
  }, [me.data, canSwitch, role]);

  if (me.isLoading) return null;
  if (canSwitch) return <RoleSwitch role={role} onSwitch={onSwitch} />;

  return (
    <a href={PSY_APPLY_LINK} target="_blank" rel="noopener noreferrer" onClick={() => tap()} className="flex items-center gap-2.5 rounded-[17px] p-3 stroke" style={{ background: "rgba(255,255,255,.5)" }}>
      <span className="ico h-9 w-9 shrink-0"><Icon name="therapy" width={17} weight="bold" color="var(--edge)" /></span>
      <span className="t-sub min-w-0 flex-1 font-bold leading-tight">Подать заявку на регистрацию в качестве психолога</span>
      <Arrow />
    </a>
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

