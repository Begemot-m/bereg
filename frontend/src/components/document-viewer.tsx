"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { apiFetchBlob } from "@/lib/api";
import { tap } from "@/lib/haptics";

/**
 * Просмотр диплома внутри приложения.
 *
 * Раньше документ «открывался» новой вкладкой: файл тянулся в blob, а дальше
 * шёл `<a target="_blank">` или `download`. В Telegram-вебвью и то и другое
 * почти всегда молча ничего не делает — человек нажимал и получал пустоту.
 * Поэтому картинку показываем прямо здесь, а для PDF даём честную кнопку
 * сохранения и говорим, что делать, если браузер её проглотил.
 */
export type ViewerDoc = { id: number; kind?: string; name: string; mime: string; dataUrl?: string };

async function loadDoc(doc: ViewerDoc): Promise<string> {
  if (doc.dataUrl) return doc.dataUrl;
  const blob = await apiFetchBlob(`/profile/documents/${doc.id}`);
  return URL.createObjectURL(new Blob([blob], { type: doc.mime || blob.type }));
}

export function DocumentViewer({ doc, onClose }: { doc: ViewerDoc | null; onClose: () => void }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!doc) { setSrc(""); setError(""); return; }
    let dropped = false;
    let objectUrl = "";
    setSrc(""); setError("");
    loadDoc(doc)
      .then((url) => {
        if (dropped) { if (url.startsWith("blob:")) URL.revokeObjectURL(url); return; }
        if (url.startsWith("blob:")) objectUrl = url;
        setSrc(url);
      })
      .catch(() => { if (!dropped) setError("Файл не отдался. Обновите страницу и попробуйте снова — возможно, истекла сессия."); });
    return () => { dropped = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [doc]);

  const isImage = Boolean(doc?.mime.startsWith("image/"));

  return (
    <AnimatePresence>
      {doc && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(24,22,20,.72)] p-3" onClick={onClose}>
          <motion.div
            initial={{ y: 24, scale: .98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            onClick={(event) => event.stopPropagation()}
            className="chunk flex max-h-[min(92vh,calc(100dvh-var(--top-pad)))] w-full max-w-lg flex-col overflow-hidden bg-white"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="min-w-0 flex-1 truncate text-[13px] font-black">{doc.name}</p>
              <button onClick={() => { tap(); onClose(); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[15px] font-black stroke" aria-label="Закрыть">×</button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto border-y px-4 py-4" style={{ borderColor: "var(--edge-neutral)" }}>
              {error ? (
                <p className="rounded-[13px] p-3 text-[12px] font-bold" style={{ background: "var(--salmon-soft)" }}>{error}</p>
              ) : !src ? (
                <p className="py-8 text-center text-[12px] font-bold text-[var(--muted)]">Открываем документ…</p>
              ) : isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={doc.name} className="mx-auto max-h-[65vh] w-auto max-w-full rounded-[13px] object-contain" />
              ) : (
                <div className="space-y-3">
                  <object data={src} type="application/pdf" className="h-[55vh] w-full rounded-[13px]" aria-label={doc.name}>
                    <p className="p-3 text-[12px] font-bold text-[var(--muted)]">Встроенный просмотр PDF недоступен — сохраните файл кнопкой ниже.</p>
                  </object>
                </div>
              )}
            </div>

            {src && !isImage && (
              <div className="px-4 py-3">
                <a href={src} download={doc.name || "документ.pdf"} target="_blank" rel="noreferrer" onClick={tap} className="btn w-full py-2.5 text-[12px]">Сохранить файл</a>
                <p className="mt-1.5 text-center text-[10px] font-semibold text-[var(--muted-2)]">Если Telegram не сохраняет — откройте эту страницу в браузере.</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
