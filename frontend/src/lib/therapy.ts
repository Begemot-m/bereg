import { apiFetch } from "@/lib/api";
import type { Mood } from "@/lib/clients";

export const BALANCE_KEYS = ["health", "emotions", "relationships", "work", "finance", "rest", "growth", "environment"] as const;
export type BalanceKey = (typeof BALANCE_KEYS)[number];
export type BalanceScores = Record<BalanceKey, number>;
export type BalanceResult = { scores: BalanceScores; completedAt: string };
export type TherapyState = { moods: Mood[]; balance: BalanceResult | null; tutorialSeen: boolean };

export const BALANCE_META: Record<BalanceKey, { label: string; question: string; color: string }> = {
  health: { label: "Здоровье и энергия", question: "Насколько вам хватает сил на обычные дела?", color: "var(--green)" },
  emotions: { label: "Эмоциональное состояние", question: "Насколько устойчивым было ваше эмоциональное состояние?", color: "var(--coral)" },
  relationships: { label: "Отношения", question: "Насколько вас устраивали близость и поддержка в отношениях?", color: "var(--purple)" },
  work: { label: "Работа или учёба", question: "Насколько вас удовлетворяли работа или учёба?", color: "var(--amber)" },
  finance: { label: "Финансы и безопасность", question: "Насколько спокойно вы чувствовали себя в вопросах денег и безопасности?", color: "var(--green)" },
  rest: { label: "Отдых", question: "Насколько вам удавалось отдыхать и восстанавливаться?", color: "var(--purple)" },
  growth: { label: "Развитие и смысл", question: "Насколько вы ощущали развитие, смысл и движение вперёд?", color: "var(--coral)" },
  environment: { label: "Повседневная среда", question: "Насколько удобной и поддерживающей была ваша повседневная среда?", color: "var(--amber)" },
};

export const getMyTherapy = () => apiFetch<TherapyState>("/my/therapy");
export const updateMyTherapy = (patch: { mood?: number; balance?: BalanceScores; tutorialSeen?: boolean }) =>
  apiFetch<TherapyState>("/my/therapy", { method: "PATCH", body: JSON.stringify(patch) });
export const getClientTherapy = (clientId: number) => apiFetch<TherapyState>(`/clients/${clientId}/therapy`);

export function balanceAverage(balance: BalanceResult | null): number {
  if (!balance) return 0;
  return Math.round(BALANCE_KEYS.reduce((sum, key) => sum + balance.scores[key], 0) / BALANCE_KEYS.length * 10);
}
