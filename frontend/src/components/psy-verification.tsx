"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import { success, tap } from "@/lib/haptics";
import { profileCompletionPercent } from "@/components/profile-editor";
import { displayName, displayPhoto, useProfile } from "@/lib/profile";
import {
  demoPrimaryDocument, MAX_DOCUMENT_MB, MAX_DOCUMENTS, useDeleteDocument, usePsyDocuments, useUploadDocument,
} from "@/lib/psy-documents";
import {
  CATALOG_MIN_PERCENT, useSubmitCatalogVerification, useVerification,
} from "@/lib/psy-verification";

// Прежняя короткая анкета «подтверждение практики» удалена: путь к проверке
// теперь один — /cabinet/verification с чек-листом и документом. Две формы с
// разными требованиями и были той самой путаницей в статусах.

// Заявка на размещение в каталоге. Отдельно от «подтверждения практики»:
// здесь проверяют не человека, а готовность карточки — заполненность,
// фото, цену и документ об образовании.
export function CatalogVerification() {
  const profile = useProfile();
  const { data: verification } = useVerification();
  const submit = useSubmitCatalogVerification();
  const { data: documents = [] } = usePsyDocuments();
  const upload = useUploadDocument();
  const removeDocument = useDeleteDocument();
  const [fileError, setFileError] = useState("");

  const percent = profileCompletionPercent(profile);
  const photo = profile?.photos?.[0] ?? profile?.photo ?? displayPhoto();
  const price = Number(profile?.sessionPrice ?? 0);
  const status = verification?.status ?? "none";

  const checks = [
    { ok: percent >= CATALOG_MIN_PERCENT, title: `Профиль заполнен на ${CATALOG_MIN_PERCENT}%`, note: `Сейчас ${percent}%` },
    { ok: Boolean(photo), title: "Фотография", note: photo ? "Загружена" : "Добавьте фото в шаге «Фото и основное»" },
    { ok: price > 0, title: "Стоимость сессии", note: price > 0 ? `${price.toLocaleString("ru-RU")} ₽` : "Укажите цену в шаге «Условия встречи»" },
    { ok: documents.length > 0, title: "Подтверждение образования", note: documents.length ? `${documents.length} ${documents.length === 1 ? "документ" : documents.length < 5 ? "документа" : "документов"}` : "Диплом или сертификат — фото или PDF" },
  ];
  const ready = checks.every((item) => item.ok);

  const pickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFileError("");
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) { setFileError("Подойдёт фото (JPG, PNG, HEIC) или PDF."); return; }
    if (file.size > MAX_DOCUMENT_MB * 1024 * 1024) { setFileError(`Файл больше ${MAX_DOCUMENT_MB} МБ — сожмите или сфотографируйте заново.`); return; }
    if (documents.length >= MAX_DOCUMENTS) { setFileError(`Больше ${MAX_DOCUMENTS} документов не нужно — уберите лишний.`); return; }
    try {
      // Файл уезжает сразу, а не ждёт отправки анкеты: до сервера он идёт
      // отдельным запросом, и держать мегабайты в форме незачем.
      await upload.mutateAsync({ file, kind: documents.length ? "certificate" : "diploma" });
      tap();
    } catch {
      setFileError("Не удалось загрузить файл. Попробуйте ещё раз.");
    }
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
      // В бою документы уже лежат на сервере и подтягиваются к анкете по
      // владельцу. В демо сервера нет — кладём первый файл в саму заявку,
      // иначе модератору в демо-админке нечего открыть.
      diploma: demoPrimaryDocument(),
    });
  };

  if (status === "approved") {
    return (
      <section className="chunk mt-4 flex items-start gap-3 p-4" style={{ background: "var(--green-soft)" }}>
        <span className="ico h-10 w-10 shrink-0" style={{ background: "#fff" }}><Icon name="check" width={19} weight="bold" color="var(--green)" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-tight text-[16px] font-black leading-tight">Профиль в каталоге</p>
          <p className="t-sub mt-1">Верификация пройдена — вас находят по фильтрам каталога.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="chunk mt-4 p-4">
      <div className="flex items-start gap-3">
        <span className="ico h-10 w-10 shrink-0" style={{ background: "#fff" }}><Icon name="check" width={19} weight="bold" color="var(--green)" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-tight text-[17px] font-black leading-tight">Пройти верификацию для размещения в каталоге</p>
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
            {upload.isPending ? "Загружаем…" : documents.length ? "Приложить ещё документ" : "Приложить диплом — фото или PDF"}
            <input type="file" accept="image/*,application/pdf" onChange={pickFile} disabled={upload.isPending} className="hidden" />
          </label>
          {documents.map((doc) => (
            <div key={doc.id} className="card-soft mt-2 flex items-center gap-2.5 p-2.5">
              <span className="ico h-8 w-8 shrink-0"><Icon name="book" width={15} weight="bold" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-black">{doc.name}</span>
                <span className="t-cap block">{doc.kind === "diploma" ? "Диплом" : "Сертификат"} · {Math.round(doc.size / 1024)} КБ</span>
              </span>
              <button onClick={() => { tap(); removeDocument.mutate(doc.id); }} className="x-close h-7 w-7 text-[15px]" aria-label={`Убрать ${doc.name}`}>✕</button>
            </div>
          ))}
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

// Состояние заявки показывает VerificationPrompt — отдельный баннер под
// переключателем ролей повторял его слово в слово.
