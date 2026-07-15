import { apiFetch } from "@/lib/api";

export type Subscription = {
  plan: "free" | "pro";
  status: "inactive" | "pending" | "active";
  currentPeriodEnd: string | null;
};

export const getSubscription = () => apiFetch<Subscription>("/subscription");

// Создаёт платёж и возвращает ссылку на оплату ЮKassa (или бросает ошибку,
// если платежи ещё не подключены — нет боевых ключей).
export const startSubscription = () =>
  apiFetch<{ confirmation_url: string | null }>("/billing/subscribe", { method: "POST" });
