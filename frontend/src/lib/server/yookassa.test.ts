import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { createPayment } from "./yookassa";

const realFetch = globalThis.fetch;
let bodies: Record<string, unknown>[] = [];

const ok = () =>
  new Response(
    JSON.stringify({ id: "pay-1", status: "pending", confirmation: { confirmation_url: "https://pay" } }),
    { status: 200 },
  );

const forbidden = () =>
  new Response(JSON.stringify({ code: "forbidden", description: "This store can't make recurring payments" }), {
    status: 403,
  });

function stub(...responses: (() => Response)[]) {
  let call = 0;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return responses[Math.min(call++, responses.length - 1)]();
  }) as typeof fetch;
}

const payment = {
  amountRub: 990,
  description: "Подписка Pro",
  metadata: { psychologistId: "7" },
  savePaymentMethod: true,
  returnUrl: "https://chronika.space/billing/return",
};

beforeEach(() => {
  bodies = [];
  process.env.YOOKASSA_SHOP_ID = "1432105";
  process.env.YOOKASSA_SECRET_KEY = "test-key";
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("createPayment", () => {
  test("магазин без автоплатежей: платёж всё равно создаётся, но без сохранения способа оплаты", async () => {
    stub(forbidden, ok);
    const result = await createPayment(payment);

    expect(result.confirmationUrl).toBe("https://pay");
    expect(bodies).toHaveLength(2);
    expect(bodies[0].save_payment_method).toBe(true);
    expect(bodies[1].save_payment_method).toBe(false);
  });

  test("с подключёнными автоплатежами второй попытки нет", async () => {
    stub(ok);
    await createPayment(payment);

    expect(bodies).toHaveLength(1);
    expect(bodies[0].save_payment_method).toBe(true);
  });

  test("отказ не по автоплатежам не прячется", async () => {
    stub(() => new Response("nope", { status: 401 }));
    expect(createPayment(payment)).rejects.toThrow(/401/);
  });
});
