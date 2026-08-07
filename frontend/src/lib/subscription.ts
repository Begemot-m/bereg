import { apiFetch } from "@/lib/api";

// Тариф один: Хроника PRO. Размещение в каталоге в него не входит — оно
// бесплатное и бессрочное сразу после верификации. PRO покупает приоритет
// в выдаче каталога.
export type PlanId = "pro";
export type SubStatus = "free" | "trial" | "active" | "pending" | "expired";
export type Subscription = {
  status: SubStatus;
  trialEndsAt: string | null;
  trialStarted: boolean;      // была ли первая сессия — с неё стартует триал
  currentPeriodEnd: string | null;
  pro: boolean;
  catalog: boolean;           // карточка видна в каталоге (даёт верификация)
  priority: boolean;          // приоритетная выдача в каталоге
  pendingPlan: PlanId | null;
};

export const PLAN_PRICE: Record<PlanId, number> = { pro: 990 };
export const rub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;

// Бесплатный тариф «Старт»: до 3 клиентов, дальше — PRO.
export const FREE_CLIENT_LIMIT = 3;

// Сколько длится пробный PRO. Дублирует константу сервера — там источник
// правды, здесь только тексты.
export const TRIAL_DAYS = 14;

// PRO активен во время триала и при оплаченной подписке. Решение принимает
// сервер, здесь — только чтение его ответа.
export function isPro(sub?: Subscription | null): boolean {
  return Boolean(sub?.pro);
}

export function trialDaysLeft(sub: Subscription): number {
  if (!sub.trialEndsAt) return 0;
  return Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86_400_000));
}

export const getSubscription = () => apiFetch<Subscription>("/subscription");

// Создаёт платёж и возвращает ссылку на оплату ЮKassa (в демо — возврат в кабинет).
export const startSubscription = (plan: PlanId) =>
  apiFetch<{ confirmation_url: string | null }>("/billing/subscribe", { method: "POST", body: JSON.stringify({ plan }) });
