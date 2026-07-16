"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { PageHead, SectionTitle } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { ProfileEditor } from "@/components/profile-editor";
import { WorkHoursEditor } from "@/components/work-hours";
import { Badge, Button, Card, Disclosure, Textarea } from "@/components/ui";
import { APP_NAME, CENTER, TAGLINE } from "@/lib/brand";
import { select, tap } from "@/lib/haptics";
import { displayName, displayPhoto, resetOnboarding, useProfile } from "@/lib/profile";
import { ROLE_LABEL, useRole, type Role } from "@/lib/role";
import { getSubscription, startSubscription } from "@/lib/subscription";
import { sendSupport } from "@/lib/support";

const ROLES: Role[] = ["guest", "client", "psychologist"];

export default function CabinetPage() {
  const [role, switchRole] = useRole();
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [editHours, setEditHours] = useState(false);
  const profile = useProfile();
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });

  useEffect(() => {
    setName(displayName());
    setPhoto(displayPhoto());
  }, [role, profile]);

  const subscribe = useMutation({
    mutationFn: startSubscription,
    onSuccess: (r) => { if (r.confirmation_url) window.location.href = r.confirmation_url; },
  });

  return (
    <div>
      <Reveal><PageHead title="Личный кабинет" /></Reveal>

      {/* Профиль */}
      <Reveal delay={0.03}>
        <div className="mb-6">
          {role === "psychologist" ? (
            <ProfileEditor />
          ) : (
            <Card className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[16px] stroke" style={{ background: "var(--head-soft)" }}>
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xl font-extrabold">{(name || ROLE_LABEL[role]).charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{name || ROLE_LABEL[role]}</p>
                <p className="text-[13px] font-semibold text-[var(--muted)]">{ROLE_LABEL[role]} · привязка к Telegram</p>
              </div>
            </Card>
          )}
        </div>
      </Reveal>

      {/* Рабочие окна (только психолог) */}
      {role === "psychologist" && (
        <div className="mb-6 space-y-3">
          <SettingRow icon="clock" title="Свободные окна" hint="Часы приёма по дням недели" open={editHours} onClick={() => { tap(); setEditHours(!editHours); }} />
          <Disclosure open={editHours} zoom>
            <Card>
              <p className="mb-3 text-[12px] text-[var(--muted)]">Это шаблон на каждую неделю: в отмеченные часы клиенты видят свободные окна и записываются. Можно менять в любой момент.</p>
              <WorkHoursEditor onSaved={() => setEditHours(false)} />
            </Card>
          </Disclosure>
        </div>
      )}

      {/* Роль */}
      <div className="mb-6">
        <SectionTitle>Роль</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => { select(); switchRole(r); }}
              className={`rounded-2xl px-3 py-3 text-[13px] font-semibold transition-colors duration-200 ${role === r ? "bg-[var(--ink)] text-[var(--bg)]" : "bg-white text-[var(--muted)]"}`}
              style={{ border: role === r ? "none" : "1px solid var(--hairline)" }}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Подписка */}
      <div className="mb-6">
        <SectionTitle>Подписка</SectionTitle>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-tight text-2xl font-extrabold">{sub?.plan === "pro" ? "PRO" : "Бесплатно"}</p>
              <p className="text-[12px] text-[var(--muted)]">
                {sub?.status === "active" ? "активна" : sub?.status === "pending" ? "ожидает оплаты" : "базовый доступ"}
              </p>
            </div>
            {sub?.status === "active" ? <Badge tone="active">активна</Badge> : <Badge tone="accent">990 ₽/мес</Badge>}
          </div>
          {sub?.status !== "active" && (
            <div className="mt-4">
              <p className="mb-3 text-[13px] text-[var(--muted)]">
                Расширенные модули и место в каталоге. Базовый инструмент — бесплатный навсегда.
              </p>
              <Button onClick={() => subscribe.mutate()} disabled={subscribe.isPending} arrow className="w-full">
                {subscribe.isPending ? "Готовим оплату" : "Оформить Pro"}
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Настройки */}
      <div className="mb-6">
        <SectionTitle>Настройки</SectionTitle>
        <Card className="space-y-3">
          <ToggleRow label="Напоминания о сессиях" defaultOn />
          <ToggleRow label="Уведомления о заданиях" defaultOn />
          <button
            onClick={() => { tap(); resetOnboarding(); }}
            className="w-full pt-1 text-left text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Пройти знакомство заново
          </button>
        </Card>
      </div>

      {/* Отдел заботы */}
      <div className="mb-6">
        <SectionTitle>Отдел заботы</SectionTitle>
        <SupportBlock />
      </div>

      {/* Центр */}
      <Reveal>
        <div className="rounded-2xl p-5" style={{ background: "var(--a-tint)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Платформу создал центр</p>
          <p className="font-tight mt-1 text-xl font-extrabold" style={{ color: "var(--a1)" }}>{CENTER}</p>
          <p className="mt-2 text-[13px] text-[var(--muted)]">{TAGLINE}. {APP_NAME} — инструмент центра для качественной помощи и самопомощи.</p>
        </div>
      </Reveal>
    </div>
  );
}

function SettingRow({ icon, title, hint, open, onClick }: { icon: "note" | "clock"; title: string; hint: string; open: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl bg-[var(--surface)] px-4 py-3.5 text-left transition-[transform,box-shadow] duration-200 active:scale-[0.99]" style={{ boxShadow: "var(--shadow)" }}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--a-tint)" }}>
        <Icon name={icon} width={18} color="var(--a1)" />
      </span>
      <span className="flex-1">
        <span className="block text-[14px] font-bold">{title}</span>
        <span className="block text-[12px] text-[var(--muted)]">{hint}</span>
      </span>
      <span className="text-[var(--muted-2)] transition-transform duration-300" style={{ transform: open ? "rotate(90deg)" : "none" }}>›</span>
    </button>
  );
}

function ToggleRow({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <button onClick={() => { select(); setOn(!on); }} className="flex w-full items-center justify-between">
      <span className="text-[13px]">{label}</span>
      <span className={`flex h-6 w-10 items-center rounded-full p-0.5 transition-colors duration-200 ${on ? "" : "bg-[#e2e0d8]"}`} style={on ? { background: "var(--a1)" } : undefined}>
        <span
          className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-4" : ""}`}
          style={{ transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)" }}
        />
      </span>
    </button>
  );
}

function SupportBlock() {
  const [kind, setKind] = useState("Вопрос");
  const [text, setText] = useState("");
  const send = useMutation({ mutationFn: () => sendSupport(kind, text.trim()), onSuccess: () => setText("") });
  return (
    <Card className="space-y-2.5">
      <div className="flex gap-1.5">
        {["Вопрос", "Жалоба", "Идея"].map((k) => (
          <button
            key={k}
            onClick={() => { select(); setKind(k); }}
            className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-colors duration-200 ${kind === k ? "bg-[var(--ink)] text-[var(--bg)]" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}
          >
            {k}
          </button>
        ))}
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Вопрос, жалоба или идея нового инструмента…" />
      {send.isSuccess ? (
        <p className="text-[13px] font-semibold text-[var(--good)]">Спасибо! Обращение отправлено.</p>
      ) : (
        <div className="flex justify-end">
          <Button size="sm" disabled={send.isPending || !text.trim()} onClick={() => send.mutate()} arrow>Отправить</Button>
        </div>
      )}
    </Card>
  );
}
