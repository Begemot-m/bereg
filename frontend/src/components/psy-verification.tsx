"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Button, Input } from "@/components/ui";
import { success, tap } from "@/lib/haptics";
import { profileCompletionPercent } from "@/components/profile-editor";
import { displayName, displayPhoto, useProfile } from "@/lib/profile";
import {
  CATALOG_MIN_PERCENT, EMPTY_FORM, useSubmitCatalogVerification, useSubmitVerification, useVerification,
  type DiplomaFile, type VerificationForm,
} from "@/lib/psy-verification";

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

const MAX_DIPLOMA_MB = 5;

// Заявка на размещение в каталоге. Отдельно от «подтверждения практики»:
// здесь проверяют не человека, а готовность карточки — заполненность,
// фото, цену и документ об образовании.
export function CatalogVerification() {
  const profile = useProfile();
  const { data: verification } = useVerification();
  const submit = useSubmitCatalogVerification();
  const [diploma, setDiploma] = useState<DiplomaFile | null>(null);
  const [fileError, setFileError] = useState("");

  const percent = profileCompletionPercent(profile);
  const photo = profile?.photos?.[0] ?? profile?.photo ?? displayPhoto();
  const price = Number(profile?.sessionPrice ?? 0);
  const status = verification?.status ?? "none";

  const checks = [
    { ok: percent >= CATALOG_MIN_PERCENT, title: `Профиль заполнен на ${CATALOG_MIN_PERCENT}%`, note: `Сейчас ${percent}%` },
    { ok: Boolean(photo), title: "Фотография", note: photo ? "Загружена" : "Добавьте фото в шаге «Фото и основное»" },
    { ok: price > 0, title: "Стоимость сессии", note: price > 0 ? `${price.toLocaleString("ru-RU")} ₽` : "Укажите цену в шаге «Условия встречи»" },
    { ok: Boolean(diploma), title: "Подтверждение образования", note: diploma ? diploma.name : "Диплом или сертификат — фото или PDF" },
  ];
  const ready = checks.every((item) => item.ok);

  const pickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFileError("");
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) { setFileError("Подойдёт фото (JPG, PNG, HEIC) или PDF."); return; }
    if (file.size > MAX_DIPLOMA_MB * 1024 * 1024) { setFileError(`Файл больше ${MAX_DIPLOMA_MB} МБ — сожмите или сфотографируйте заново.`); return; }
    const reader = new FileReader();
    reader.onload = () => { setDiploma({ name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result) }); tap(); };
    reader.onerror = () => setFileError("Не удалось прочитать файл. Попробуйте другой.");
    reader.readAsDataURL(file);
  };

  const send = () => {
    if (!ready || !profile) return;
    success();
    submit.mutate({
      name: profile.name || displayName(),
      education: profile.education.join("; "),
      method: profile.primaryMethod || profile.approach,
      experienceYears: Number(profile.experienceYears) || 0,
      sessionPrice: price,
      city: profile.location.city,
      format: profile.format,
      publicLink: profile.links[0]?.url ?? "",
      about: profile.about,
      photo,
      profilePercent: percent,
      diploma,
    });
  };

  if (status === "approved") {
    return (
      <section className="chunk mt-4 flex items-start gap-3 p-4" style={{ background: "var(--green-soft)" }}>
        <span className="ico h-10 w-10 shrink-0" style={{ background: "#fff" }}><Icon name="check" width={19} weight="bold" color="var(--green)" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-tight text-[16px] font-black leading-tight">Профиль в каталоге</p>
          <p className="t-sub mt-1">Верификация пройдена — вас находят по фильтрам и можно приглашать клиентов.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="chunk mt-4 p-4">
      <div className="flex items-start gap-3">
        <span className="ico h-10 w-10 shrink-0" style={{ background: "#fff" }}><Icon name="therapy" width={19} weight="bold" color="var(--edge)" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-tight text-[17px] font-black leading-tight">Пройти верификацию для размещения в каталоге</p>
          <p className="t-sub mt-1">Мы проверяем заявку вручную. Обычно это занимает пару дней.</p>
        </div>
      </div>

      {status === "review" ? (
        <div className="card-soft mt-3 flex items-start gap-2.5 p-3" style={{ background: "var(--amber-soft)" }}>
          <span className="ico h-8 w-8 shrink-0" style={{ background: "#fff" }}><Icon name="clock" width={15} weight="bold" color="var(--amber-edge)" /></span>
          <p className="t-sub min-w-0 flex-1">Заявка отправлена и ждёт проверки. Профиль можно дозаполнять — изменения подтянутся.</p>
        </div>
      ) : (
        <>
          {status === "rejected" && verification?.rejectReason && (
            <p className="card-soft mt-3 p-3 text-[12px] font-bold" style={{ background: "var(--salmon-soft)" }}>{verification.rejectReason}</p>
          )}

          <ul className="mt-3 space-y-1.5">
            {checks.map((item) => (
              <li key={item.title} className="card-soft flex items-center gap-2.5 p-2.5" style={{ background: item.ok ? "var(--green-soft)" : "var(--surface-2)" }}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-white">
                  <Icon name={item.ok ? "check" : "clock"} width={14} weight="bold" color={item.ok ? "var(--green)" : "var(--muted-2)"} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-black leading-tight">{item.title}</span>
                  <span className="t-cap block">{item.note}</span>
                </span>
              </li>
            ))}
          </ul>

          <label className="btn btn-white mt-3 w-full cursor-pointer py-2.5 text-[12px]">
            <Icon name="plus" width={14} weight="bold" color="var(--ink)" />
            {diploma ? "Заменить документ" : "Приложить диплом — фото или PDF"}
            <input type="file" accept="image/*,application/pdf" onChange={pickFile} className="hidden" />
          </label>
          {diploma && (
            <div className="card-soft mt-2 flex items-center gap-2.5 p-2.5">
              <span className="ico h-8 w-8 shrink-0"><Icon name="book" width={15} weight="bold" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-black">{diploma.name}</span>
                <span className="t-cap block">{Math.round(diploma.size / 1024)} КБ</span>
              </span>
              <button onClick={() => { tap(); setDiploma(null); }} className="x-close h-7 w-7 text-[15px]" aria-label="Убрать файл">✕</button>
            </div>
          )}
          {fileError && <p className="card-soft mt-2 p-2.5 text-[12px] font-bold" style={{ background: "var(--salmon-soft)" }}>{fileError}</p>}

          <Button className="mt-3 w-full" disabled={!ready || submit.isPending} onClick={send}>
            {submit.isPending ? "Отправляем…" : status === "rejected" ? "Отправить снова" : "Отправить на верификацию"}
          </Button>
          {!ready && <p className="t-cap mt-2 text-center">Отправить можно, когда все четыре пункта закрыты.</p>}
        </>
      )}
    </section>
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
