"use client";

import { apiFetch } from "@/lib/api";
import { DEMO } from "@/lib/demo";
import { getRole } from "@/lib/role";

const DEVICE_KEY = "bereg_device";
/** Один заход на раздел раз в пять минут: иначе метания по табам раздувают базу. */
const REPEAT_MS = 5 * 60_000;

const sent = new Map<string, number>();

/** Анонимный идентификатор браузера. Персональных данных не содержит. */
function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? String(Math.random()).slice(2)) as string;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** Раздел по адресу страницы: /clients/17 → clients, / → home. */
export function sectionOf(pathname: string): string {
  const first = pathname.split("?")[0].split("/").filter(Boolean)[0];
  if (!first) return "home";
  if (first === "cabinet") return "cabinet";
  return first;
}

/**
 * Отметить заход в раздел. В демо не шлём ничего: там нет сервера, а сводку
 * админки рисуют моки.
 */
export function trackSection(pathname: string) {
  if (DEMO || typeof window === "undefined") return;
  const section = sectionOf(pathname);
  const now = Date.now();
  const last = sent.get(section) ?? 0;
  if (now - last < REPEAT_MS) return;
  sent.set(section, now);

  void apiFetch("/track", {
    method: "POST",
    body: JSON.stringify({ section, device: deviceId(), role: getRole() }),
  }).catch(() => {
    // Статистика — не то, ради чего стоит показывать человеку ошибку.
    sent.delete(section);
  });
}
