"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { PageHead, SectionTitle } from "@/components/blocks";
import { HelpDeck, SCHEDULE_HELP } from "@/components/help-deck";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { ProfileEditor } from "@/components/profile-editor";
import { WorkHoursEditor } from "@/components/work-hours";
import { Badge, Button, Card, Textarea } from "@/components/ui";
import { APP_NAME, CENTER, TAGLINE } from "@/lib/brand";
import { select, tap } from "@/lib/haptics";
import { resetOnboarding } from "@/lib/profile";
import { ROLE_LABEL, useRole, type Role } from "@/lib/role";
import { getSubscription, startSubscription } from "@/lib/subscription";
import { sendSupport } from "@/lib/support";

const ROLES: Role[] = ["psychologist", "client"];

export default function CabinetPage() {
  const [role, switchRole] = useRole();
  const [editHours, setEditHours] = useState(false);
  const [help, setHelp] = useState(false);
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });

  const subscribe = useMutation({
    mutationFn: startSubscription,
    onSuccess: (r) => { if (r.confirmation_url) window.location.href = r.confirmation_url; },
  });

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
                  <button
                    key={item}
                    onClick={() => { select(); switchRole(item); }}
                    className={`rounded-[13px] px-3 py-2 text-[13px] font-extrabold transition-all duration-200 ${role === item ? "bg-[var(--ink)] text-white" : "text-[var(--muted)] hover:bg-white/60"}`}
                    aria-pressed={role === item}
                  >
                    {ROLE_LABEL[item]}
                  </button>
                ))}
              </div>
            )}
          />
      </PageHead>

      <Reveal y={10}>
      <div className="-mx-4 min-h-[64vh] rounded-t-[30px] px-4 pb-6 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)", borderTop: "var(--bw-lg) solid var(--edge-neutral)" }}>

      {/* Расписание (только психолог) — единый блок, разворачивается вниз */}
      {role === "psychologist" && (
        <div className="chunk mb-6 overflow-hidden">
          <button onClick={() => { tap(); setEditHours(!editHours); }} className="flex w-full items-center gap-3 p-4 text-left">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl stroke" style={{ background: "var(--head-soft)" }}><Icon name="clock" width={18} /></span>
            <span className="flex-1">
              <span className="block text-[14px] font-bold">Моё расписание</span>
              <span className="block text-[12px] text-[var(--muted)]">Настроить часы работы</span>
            </span>
            <span className="text-[var(--muted-2)] transition-transform duration-300" style={{ transform: editHours ? "rotate(90deg)" : "none" }}>›</span>
          </button>
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ${editHours ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            style={{ transitionTimingFunction: "var(--ease-out)" }}
            aria-hidden={!editHours}
            inert={!editHours}
          >
            <div className="min-h-0 overflow-hidden">
            <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--edge-neutral)" }}>
              <div className="mb-3 flex justify-start">
                <button onClick={() => { tap(); setHelp(true); }} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold stroke" style={{ background: "var(--head-soft)" }}>
                  <Icon name="spark" width={14} /> Как настроить?
                </button>
              </div>
              <WorkHoursEditor onSaved={() => setEditHours(false)} />
            </div>
            </div>
          </div>
        </div>
      )}

      {help && <HelpDeck title="Как настроить расписание" pages={SCHEDULE_HELP} onClose={() => setHelp(false)} />}

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
      </Reveal>
    </div>
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
