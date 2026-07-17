"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
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
  const [help, setHelp] = useState(false);
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
          <Disclosure open={editHours}>
            <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--edge-neutral)" }}>
              <div className="mb-3 flex justify-end">
                <button onClick={() => { tap(); setHelp(true); }} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold stroke" style={{ background: "var(--head-soft)" }}>
                  <Icon name="spark" width={14} /> Как настроить?
                </button>
              </div>
              <WorkHoursEditor onSaved={() => setEditHours(false)} />
            </div>
          </Disclosure>
        </div>
      )}

      {help && <HelpModal onClose={() => setHelp(false)} />}

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

const HELP_STEPS: { t: string; d: string }[] = [
  { t: "Задайте интервал работы", d: "Вверху выберите «с» и «до» — границы дня, внутри которых ставите окна." },
  { t: "Выберите длину сессии", d: "Ползунком по минутам. Она задаёт размер новых окон и не меняет уже поставленные." },
  { t: "Поставьте окно", d: "Тапните по времени на графике дня — появится блок нужной длины. Он магнитом прилипает к ровному часу, иначе шаг 10 минут." },
  { t: "Двигайте и удаляйте", d: "Потяните блок вверх/вниз, чтобы сдвинуть время. Тап по блоку — удалить его." },
  { t: "Скопируйте на другие дни", d: "«На будни» повторит текущий день на Пн–Пт, «На все дни» — на всю неделю. Потом можно поправить каждый день вручную." },
  { t: "Сохраните", d: "Нажмите «Сохранить». В эти окна клиенты видят свободное время и записываются к вам." },
];

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center p-3 @md:items-center" style={{ background: "rgba(32,28,24,.4)", backdropFilter: "blur(2px)" }}>
        <motion.div initial={{ y: 30, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 32 }} onClick={(e) => e.stopPropagation()} className="chunk max-h-[82vh] w-full max-w-md overflow-y-auto p-5" style={{ background: "var(--surface)" }}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-tight text-[20px] font-extrabold">Как настроить расписание</h3>
              <p className="mt-0.5 text-[12px] font-semibold text-[var(--muted)]">Шесть шагов — и график готов</p>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full stroke text-[15px] font-bold" style={{ background: "#fff" }}>✕</button>
          </div>
          <ol className="space-y-2.5">
            {HELP_STEPS.map((s, i) => (
              <li key={i} className="flex gap-3 rounded-[14px] p-3 stroke" style={{ background: "#fff" }}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full stroke text-[13px] font-black" style={{ background: "var(--head)" }}>{i + 1}</span>
                <span className="min-w-0">
                  <p className="text-[14px] font-extrabold leading-tight">{s.t}</p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--muted)]">{s.d}</p>
                </span>
              </li>
            ))}
          </ol>
          <Button className="mt-4 w-full" onClick={onClose}>Понятно</Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
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
