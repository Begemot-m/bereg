import crypto from "node:crypto";

// Минимальный клиент ЮKassa API v3 (без внешних пакетов).
// Docs: https://yookassa.ru/developers/api
// Боевые ключи заполняются после модерации магазина на ИП.

const API = "https://api.yookassa.ru/v3";

function auth(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) throw new Error("YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY not set");
  return "Basic " + Buffer.from(`${shopId}:${secret}`).toString("base64");
}

export type CreatePaymentInput = {
  amountRub: number;
  description: string;
  metadata: Record<string, string>;
  savePaymentMethod?: boolean; // для последующего рекуррента
  returnUrl: string;
};

export type PaymentResult = {
  id: string;
  status: string;
  confirmationUrl: string | null;
};

export async function createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
  const res = await fetch(`${API}/payments`, {
    method: "POST",
    headers: {
      Authorization: auth(),
      "Idempotence-Key": crypto.randomUUID(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: { value: input.amountRub.toFixed(2), currency: "RUB" },
      capture: true,
      description: input.description,
      metadata: input.metadata,
      save_payment_method: input.savePaymentMethod ?? false,
      confirmation: { type: "redirect", return_url: input.returnUrl },
    }),
  });

  if (!res.ok) throw new Error(`YooKassa create payment failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as {
    id: string;
    status: string;
    confirmation?: { confirmation_url?: string };
  };
  return {
    id: data.id,
    status: data.status,
    confirmationUrl: data.confirmation?.confirmation_url ?? null,
  };
}

export type PaymentDetails = {
  id: string;
  status: string; // pending | waiting_for_capture | succeeded | canceled
  paid: boolean;
  paymentMethodId: string | null;
  metadata: Record<string, string>;
};

// Авторитетно тянем платёж из API — так проверяем подлинность вебхука
// (ЮKassa не подписывает уведомления; доверяем только своему запросу).
export async function getPayment(paymentId: string): Promise<PaymentDetails> {
  const res = await fetch(`${API}/payments/${paymentId}`, {
    headers: { Authorization: auth() },
  });
  if (!res.ok) throw new Error(`YooKassa get payment failed: ${res.status}`);
  const data = (await res.json()) as {
    id: string;
    status: string;
    paid: boolean;
    payment_method?: { id?: string };
    metadata?: Record<string, string>;
  };
  return {
    id: data.id,
    status: data.status,
    paid: data.paid,
    paymentMethodId: data.payment_method?.id ?? null,
    metadata: data.metadata ?? {},
  };
}
