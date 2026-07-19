import { apiFetch } from "@/lib/api";
import type { Mood } from "@/lib/clients";

// WHO-5 — Индекс благополучия ВОЗ (5 пунктов, валидированная шкала).
// За последние две недели, каждый пункт 0–5, сумма ×4 = 0–100%.
export const WHO5_ITEMS = [
  "Я был(а) в хорошем настроении и бодр(а)",
  "Я чувствовал(а) себя спокойно и расслабленно",
  "Я чувствовал(а) себя активным(-ой) и полным(-ой) сил",
  "Я просыпался(-ась) свежим(-ей) и отдохнувшим(-ей)",
  "Мой день был наполнен интересными для меня делами",
] as const;

export const WHO5_OPTIONS = [
  { value: 5, label: "Всё время" },
  { value: 4, label: "Большую часть времени" },
  { value: 3, label: "Больше половины времени" },
  { value: 2, label: "Меньше половины времени" },
  { value: 1, label: "Изредка" },
  { value: 0, label: "Никогда" },
] as const;

export type Who5Result = { answers: number[]; completedAt: string };
export type TherapyState = { moods: Mood[]; who5: Who5Result | null; tutorialSeen: boolean };

export function who5Score(result: Who5Result | null): number {
  if (!result) return 0;
  return result.answers.reduce((sum, value) => sum + value, 0) * 4;
}

export type Who5Band = { key: string; label: string; hint: string; tone: "salmon" | "amber" | "green" };
export function who5Band(pct: number): Who5Band {
  if (pct <= 28) return { key: "low", label: "низкое", hint: "Стоит обсудить с терапевтом — по WHO-5 это повод для скрининга на депрессию.", tone: "salmon" };
  if (pct < 50) return { key: "reduced", label: "сниженное", hint: "Благополучие ниже нормы. Обратите внимание на сон, отдых и поддержку.", tone: "amber" };
  if (pct < 75) return { key: "ok", label: "нормальное", hint: "В целом устойчивое эмоциональное благополучие.", tone: "green" };
  return { key: "high", label: "высокое", hint: "Хороший уровень благополучия за последние две недели.", tone: "green" };
}

export const getMyTherapy = () => apiFetch<TherapyState>("/my/therapy");
export const updateMyTherapy = (patch: { mood?: number; who5?: number[]; tutorialSeen?: boolean }) =>
  apiFetch<TherapyState>("/my/therapy", { method: "PATCH", body: JSON.stringify(patch) });
export const getClientTherapy = (clientId: number) => apiFetch<TherapyState>(`/clients/${clientId}/therapy`);
