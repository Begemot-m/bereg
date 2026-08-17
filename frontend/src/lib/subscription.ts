import { apiFetch } from "@/lib/api";
import { PRO_PRICE_RUB } from "@/lib/pricing";

// Тариф один: Хроника PRO. Место в каталоге в него не входит — оно бесплатное
// у всех, чью анкету одобрили. PRO снимает лимит трёх клиентов, и каждому
// после верификации даются 14 пробных дней.
export type PlanId = "pro";
export type SubStatus = "free" | "trial" | "active" | "pending" | "expired";
export type Subscription = {
  status: SubStatus;
  trialEndsAt: string | null;
  trialStarted: boolean;      // прошла ли верификация — с неё стартует триал
  currentPeriodEnd: string | null;
  pro: boolean;
  catalog: boolean;           // карточка сейчас видна в каталоге
  catalogUntil: string | null; // докуда идут пробные дни после одобрения анкеты
  pendingPlan: PlanId | null;
  /** Цена месяца для этого человека: со скидкой она ниже базовой. */
  priceRub?: number;
  /** Что перечеркнуть рядом со скидкой. null — скидки нет. */
  fullPriceRub?: number | null;
  /** Модерация отказала в каталоге — платформа остаётся, подписка дешевле. */
  catalogDeclined?: boolean;
};

export const PLAN_PRICE: Record<PlanId, number> = { pro: PRO_PRICE_RUB };
export const rub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;

/** Цена месяца для конкретного человека: со скидкой за отказ в каталоге — ниже. */
export const monthlyPrice = (sub?: Subscription | null) => sub?.priceRub ?? PLAN_PRICE.pro;
/** Что перечеркнуть рядом с ценой; null — перечёркивать нечего. */
export const crossedPrice = (sub?: Subscription | null) => sub?.fullPriceRub ?? null;

// Бесплатный тариф «Старт»: до 3 клиентов, дальше — PRO.
export const FREE_CLIENT_LIMIT = 3;

// Сколько длится пробный PRO после одобрения анкеты. Дублирует константу
// сервера — там источник правды, здесь только тексты.
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

// Сколько дней осталось от пробных 14 после верификации. Отдельно от
// `trialDaysLeft`: тот читает `trialEndsAt`, который сервер обнуляет, как
// только триал кончился, — а тут нужен сам факт «шли и вышли».
export function trialWindowLeft(sub: Subscription, now = Date.now()): number {
  if (!sub.catalogUntil) return 0;
  return Math.max(0, Math.ceil((new Date(sub.catalogUntil).getTime() - now) / 86_400_000));
}

// Сколько дней осталось от оплаченного (или подаренного) периода PRO.
export function paidDaysLeft(sub: Subscription, now = Date.now()): number {
  if (!sub.currentPeriodEnd) return 0;
  return Math.max(0, Math.ceil((new Date(sub.currentPeriodEnd).getTime() - now) / 86_400_000));
}

export const getSubscription = () => apiFetch<Subscription>("/subscription");

// Создаёт платёж и возвращает ссылку на оплату ЮKassa (в демо — возврат в кабинет).
export const startSubscription = (plan: PlanId) =>
  apiFetch<{ confirmation_url: string | null }>("/billing/subscribe", { method: "POST", body: JSON.stringify({ plan }) });

// Спрашивает у ЮKassa, прошёл ли платёж. Нужен на странице возврата: вебхук
// может опоздать, и без этого человек смотрел бы на «ждём подтверждения».
export const confirmSubscription = () =>
  apiFetch<{ activated: boolean; canceled?: boolean }>("/billing/confirm", { method: "POST" });
