"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Button, Input } from "@/components/ui";
import { success, tap } from "@/lib/haptics";
import { EMPTY_FORM, useSubmitVerification, type VerificationForm } from "@/lib/psy-verification";

// Заявка на подтверждение практики. Спрашиваем минимум: имя, образование,
// метод, опыт и публичный профиль — этого хватает, чтобы проверить человека
// глазами. Паспорт не просим: биометрия тянет за собой отдельный режим
// хранения, а пользы для проверки диплома от неё нет.
export function VerificationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<VerificationForm>(EMPTY_FORM);
  const submit = useSubmitVerification();
  const ready = form.fullName.trim().length > 2 && form.education.trim().length > 4;

  const set = (key: keyof VerificationForm) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[75] flex items-end justify-center bg-[rgba(32,28,24,.44)] p-3" onClick={onClose}>
          <motion.div
            initial={{ y: 42 }}
            animate={{ y: 0 }}
            exit={{ y: 42, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            onClick={(event) => event.stopPropagation()}
            className="chunk flex max-h-[min(91vh,calc(100dvh-var(--top-pad)))] w-full max-w-md flex-col overflow-hidden bg-white"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-tight text-[21px] font-black">Подтверждение практики</p>
                <p className="text-[11px] font-bold text-[var(--muted)]">Проверяем вручную, обычно за пару дней</p>
              </div>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-black stroke" aria-label="Закрыть">×</button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto border-y px-5 py-4" style={{ borderColor: "var(--edge-neutral)" }}>
              <Field label="Имя и фамилия">
                <Input value={form.fullName} onChange={set("fullName")} placeholder="Ирина Верещагина" />
              </Field>
              <Field label="Образование" hint="Вуз, программа, год выпуска">
                <Input value={form.education} onChange={set("education")} placeholder="МГУ, клиническая психология, 2016" />
              </Field>
              <Field label="Основной метод">
                <Input value={form.method} onChange={set("method")} placeholder="КПТ" />
              </Field>
              <Field label="Опыт, лет">
                <Input value={form.experienceYears} onChange={set("experienceYears")} inputMode="numeric" placeholder="7" />
              </Field>
              <Field label="Публичный профиль" hint="Сайт, канал или карточка на любой платформе">
                <Input value={form.publicLink} onChange={set("publicLink")} placeholder="https://" />
              </Field>
              <Field label="Пара слов о практике">
                <Input value={form.about} onChange={set("about")} placeholder="С чем работаете" />
              </Field>
              <p className="t-cap leading-snug">
                Скан диплома и сертификаты попросим отдельно, если по анкете останутся вопросы.
                До подтверждения кабинет открыт целиком, но анкета не показывается в каталоге
                и приглашать клиентов нельзя.
              </p>
            </div>

            <div className="flex gap-2 px-5 py-4">
              <Button
                className="flex-1"
                disabled={!ready || submit.isPending}
                onClick={() => { success(); submit.mutate(form, { onSuccess: onClose }); }}
              >
                {submit.isPending ? "Отправляем…" : "Отправить на проверку"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-tight block text-[13px] font-bold">{label}</span>
      {hint && <span className="t-cap block">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

// Полоса состояния под переключателем ролей: что сейчас с заявкой и что делать.
export function VerificationBanner({ status, reason, onOpen }: { status: string; reason: string | null; onOpen: () => void }) {
  if (status === "approved") return null;

  const view =
    status === "review"
      ? { tone: "var(--edge)", icon: "clock" as const, title: "Анкета на проверке", body: "Пока не подтвердим, вас не видно в каталоге и нельзя приглашать клиентов.", action: null }
      : status === "rejected"
        ? { tone: "var(--danger)", icon: "question" as const, title: "Нужны правки", body: reason ?? "Проверьте данные и отправьте заявку ещё раз.", action: "Отправить снова" }
        : { tone: "var(--edge)", icon: "therapy" as const, title: "Подтвердите практику", body: "Кабинет уже работает. Чтобы принимать клиентов и попасть в каталог, пройдите проверку.", action: "Заполнить анкету" };

  return (
    <div className="mt-2 rounded-[17px] p-3 stroke" style={{ background: "rgba(255,255,255,.5)", borderColor: view.tone }}>
      <div className="flex items-start gap-2.5">
        <span className="ico h-9 w-9 shrink-0"><Icon name={view.icon} width={17} weight="bold" color={view.tone} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-tight text-[13px] font-bold" style={{ color: view.tone }}>{view.title}</p>
          <p className="t-cap leading-snug">{view.body}</p>
        </div>
      </div>
      {view.action && (
        <button onClick={() => { tap(); onOpen(); }} className="btn btn-outline mt-2.5 w-full py-2 text-[12px]">{view.action}</button>
      )}
    </div>
  );
}
