"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, apiFetchBlob } from "@/lib/api";
import { DEMO } from "@/lib/demo";
import { compressImageFile } from "@/lib/image";

// Документы верификации. В бою файл уходит на сервер и лежит на диске
// зашифрованным (api/profile/documents), в браузере от него остаются только
// метаданные. В демо сервера нет — держим data-URL в localStorage, как и всё
// остальное демо-хранилище.

export type PsyDocument = {
  id: number;
  kind: "diploma" | "certificate";
  name: string;
  mime: string;
  size: number;
  /** Только демо: содержимое файла. В бою его отдаёт роут по id. */
  dataUrl?: string;
};

export const MAX_DOCUMENT_MB = 5;
export const MAX_DOCUMENTS = 6;
const DEMO_KEY = "bereg_psy_documents";

export function documentHref(id: number): string {
  return `/api/profile/documents/${id}`;
}

function handOver(url: string, downloadName: string | null) {
  const a = document.createElement("a");
  a.href = url;
  if (downloadName) a.download = downloadName;
  else { a.target = "_blank"; a.rel = "noreferrer"; }
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Открыть документ модератору. Прямая ссылка на роут этого не умела: сессия
 * успевает протухнуть (роут отвечает 401 JSON вместо файла), а PDF он отдаёт
 * вложением — вкладка открывалась и тут же закрывалась пустой. Тянем файл
 * сами, а дальше картинку показываем во вкладке, остальное отдаём файлом.
 */
export async function openPsyDocument(doc: { id: number; name: string; mime: string; dataUrl?: string }): Promise<void> {
  const asImage = doc.mime.startsWith("image/");
  // Демо держит сам файл в браузере — сервера, у которого можно спросить, нет.
  if (doc.dataUrl) { handOver(doc.dataUrl, asImage ? null : doc.name || "документ"); return; }
  const blob = await apiFetchBlob(`/profile/documents/${doc.id}`);
  const url = URL.createObjectURL(new Blob([blob], { type: doc.mime || blob.type }));
  handOver(url, asImage ? null : doc.name || "документ");
  // Ссылку на blob держим минуту: вкладка успевает открыться, память не течёт.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function demoRead(): PsyDocument[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) ?? "[]") as PsyDocument[]; } catch { return []; }
}

function demoWrite(list: PsyDocument[]) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(list));
  } catch {
    // Скан на несколько мегабайт не влезает в квоту localStorage. Терять
    // список целиком нельзя: сохраняем метаданные без содержимого.
    localStorage.setItem(DEMO_KEY, JSON.stringify(list.map((d) => ({ ...d, dataUrl: "" }))));
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

export function usePsyDocuments() {
  return useQuery<PsyDocument[]>({
    queryKey: ["psy-documents"],
    queryFn: async () => {
      if (DEMO) return demoRead();
      const res = await apiFetch<{ documents: PsyDocument[] }>("/profile/documents");
      return res.documents;
    },
    staleTime: 30_000,
    retry: false,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file: picked, kind = "diploma" }: { file: File; kind?: PsyDocument["kind"] }) => {
      // Скан диплома с телефона — те же мегабайты. Сжимаем щадяще: текст в
      // документе должен остаться читаемым, поэтому сторона и вес больше, чем
      // у фото анкеты. PDF проходит мимо сжатия нетронутым.
      const file = await compressImageFile(picked, { maxSide: 1800, targetBytes: 700_000 });
      if (DEMO) {
        const doc: PsyDocument = {
          id: Date.now(),
          kind,
          name: file.name || "документ",
          mime: file.type,
          size: file.size,
          dataUrl: await readAsDataUrl(file),
        };
        demoWrite([...demoRead(), doc]);
        return doc;
      }
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      const res = await apiFetch<{ document: PsyDocument }>("/profile/documents", { method: "POST", body: form });
      return res.document;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["psy-documents"] }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      if (DEMO) { demoWrite(demoRead().filter((d) => d.id !== id)); return; }
      await apiFetch(`/profile/documents/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["psy-documents"] }),
  });
}

/**
 * Что показать модератору в демо: первый документ едет в заявку как раньше.
 * В бою файлы уже на сервере, и заявке дублировать их незачем.
 */
export function demoPrimaryDocument(): { name: string; type: string; size: number; dataUrl: string } | null {
  if (!DEMO) return null;
  const first = demoRead()[0];
  return first ? { name: first.name, type: first.mime, size: first.size, dataUrl: first.dataUrl ?? "" } : null;
}
