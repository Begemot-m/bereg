import { beforeEach, describe, expect, mock, test } from "bun:test";

type Sub = {
  status: string;
  yookassaPaymentId: string | null;
  paymentMethodId: string | null;
  currentPeriodEnd: Date | null;
} | null;

let subRow: Sub = null;
let updated: Record<string, unknown> | null = null;
let recorded: unknown[] = [];

mock.module("./prisma", () => ({
  prisma: {
    subscription: {
      findUnique: async () => subRow,
      upsert: async (args: { update: Record<string, unknown> }) => {
        updated = args.update;
        return {};
      },
      updateMany: async () => ({ count: 1 }),
    },
    payment: { createMany: async (args: { data: unknown[] }) => void recorded.push(...args.data) },
  },
}));

const { activatePayment, nextPeriodEnd } = await import("./billing");

const paid = (over: Partial<Parameters<typeof activatePayment>[0]> = {}) => ({
  id: "pay-1",
  status: "succeeded",
  paid: true,
  paymentMethodId: "pm-1",
  metadata: { psychologistId: "7", kind: "initial" },
  amount: 99000,
  currency: "RUB",
  ...over,
});

beforeEach(() => {
  subRow = null;
  updated = null;
  recorded = [];
});

describe("nextPeriodEnd", () => {
  const now = new Date("2026-08-11T10:00:00Z");

  test("без подписки считает 30 дней от сегодня", () => {
    expect(nextPeriodEnd(null, now).toISOString()).toBe("2026-09-10T10:00:00.000Z");
  });

  test("оплата вперёд приклеивается к остатку, а не съедает его", () => {
    const end = new Date("2026-08-25T10:00:00Z");
    expect(nextPeriodEnd(end, now).toISOString()).toBe("2026-09-24T10:00:00.000Z");
  });

  test("истёкший период не продлевается задним числом", () => {
    const end = new Date("2026-07-01T10:00:00Z");
    expect(nextPeriodEnd(end, now).toISOString()).toBe("2026-09-10T10:00:00.000Z");
  });
});

describe("activatePayment", () => {
  test("оплаченный платёж открывает PRO и пишется в историю", async () => {
    expect(await activatePayment(paid())).toBe("activated");
    expect(updated).toMatchObject({ status: "active", plan: "pro", paymentMethodId: "pm-1" });
    expect(recorded).toHaveLength(1);
  });

  test("повтор того же платежа доступ не переоткрывает", async () => {
    subRow = { status: "active", yookassaPaymentId: "pay-1", paymentMethodId: "pm-1", currentPeriodEnd: null };
    expect(await activatePayment(paid())).toBe("already");
    expect(updated).toBeNull();
  });

  test("неоплаченный платёж ничего не меняет", async () => {
    expect(await activatePayment(paid({ status: "pending", paid: false }))).toBe("not_paid");
    expect(updated).toBeNull();
    expect(recorded).toHaveLength(0);
  });

  test("чужой платёж не открывает доступ проверяющему", async () => {
    expect(await activatePayment(paid(), 8)).toBe("foreign");
    expect(updated).toBeNull();
  });

  test("рекуррент без способа оплаты не затирает сохранённый", async () => {
    subRow = { status: "pending", yookassaPaymentId: "pay-0", paymentMethodId: "pm-1", currentPeriodEnd: null };
    await activatePayment(paid({ id: "pay-2", paymentMethodId: null, metadata: { psychologistId: "7", kind: "renewal" } }));
    expect(updated).not.toHaveProperty("paymentMethodId");
  });
});
