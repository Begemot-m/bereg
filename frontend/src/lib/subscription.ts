import { apiFetch } from "@/lib/api";

export type PlanId = "tools" | "promo" | "bundle";
export type Subscription = {
  status: "trial" | "active" | "pending" | "expired";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  tools: boolean; // доступ к инструментарию
  promo: boolean; // продвижение в каталоге
  pendingPlan: PlanId | null;
};

export const PLAN_PRICE: Record<PlanId, number> = { tools: 990, promo: 1990, bundle: 2490 };
export const rub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;

export function trialDaysLeft(sub: Subscription): number {
  if (!sub.trialEndsAt) return 0;
  return Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86_400_000));
}

export const getSubscription = () => apiFetch<Subscription>("/subscription");

// Создаёт платёж и возвращает ссылку на оплату ЮKassa (в демо — возврат в кабинет).
export const startSubscription = (plan: PlanId) =>
  apiFetch<{ confirmation_url: string | null }>("/billing/subscribe", { method: "POST", body: JSON.stringify({ plan }) });
