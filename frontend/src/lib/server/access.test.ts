import { beforeEach, describe, expect, mock, test } from "bun:test";

type Row = { status: string } | null;

let row: Row = null;
// Статус переехал к пользователю; анкета осталась запасным источником на время
// перехода, поэтому в тесте есть обе таблицы.
let userRow: { psyStatus?: string; createdAt?: Date } | null = null;
let psyRow: { status: string; reviewedAt: Date | null } | null = null;
let subRow: { status: string; plan?: string; currentPeriodEnd: Date | null; grantedBy?: number | null } | null = null;
let firstAppt: { startsAt: Date } | null = null;

mock.module("./prisma", () => ({
  prisma: {
    // psyApproved читает анкету одним select, access — другим; различаем по
    // тому, спрашивают ли reviewedAt.
    psyProfile: {
      findUnique: async (args: { select?: Record<string, boolean> }) =>
        args?.select?.reviewedAt ? psyRow : row,
    },
    user: { findUnique: async () => userRow },
    subscription: { findUnique: async () => subRow },
    appointment: { findFirst: async () => firstAppt },
  },
}));

const { access, catalogPlacement, psyApproved } = await import("./access");

const days = (n: number) => new Date(Date.now() + n * 86_400_000);

describe("гейт на приём клиентов", () => {
  test("без анкеты клиентов брать нельзя", async () => {
    row = null;
    userRow = null;
    expect(await psyApproved(1)).toBe(false);
  });

  test("черновик, проверка и отказ не открывают доступ", async () => {
    userRow = null;
    for (const status of ["draft", "review", "rejected"]) {
      row = { status };
      expect(await psyApproved(1)).toBe(false);
    }
  });

  test("approved открывает", async () => {
    userRow = null;
    row = { status: "approved" };
    expect(await psyApproved(1)).toBe(true);
  });

  test("статус у пользователя главнее анкеты", async () => {
    // Модерация пишет в оба места; если они разошлись, права идут за тем,
    // что лежит рядом с ролью — его читает каждый запрос.
    row = { status: "approved" };
    userRow = { psyStatus: "rejected" };
    expect(await psyApproved(1)).toBe(false);
  });

  test("пустой psyStatus не считается отказом, а отправляет в анкету", async () => {
    // Записи, до которых не дошёл бэкофилл: потерять им доступ нельзя.
    row = { status: "approved" };
    userRow = { psyStatus: "none" };
    expect(await psyApproved(1)).toBe(true);
  });
});

describe("пробный PRO", () => {
  beforeEach(() => {
    userRow = { createdAt: days(-200) };
    psyRow = null;
    subRow = null;
    firstAppt = null;
  });

  test("без проведённой сессии триал не начат, но и не сгорел", async () => {
    // Регистрация была давно; раньше триал отсчитывался от неё и к первой
    // сессии успевал кончиться.
    const acc = await access(1);
    expect(acc.pro).toBe(false);
    expect(acc.trialStarted).toBe(false);
    expect(acc.trialEndsAt).toBeNull();
  });

  test("первая проведённая сессия включает 14 дней PRO", async () => {
    firstAppt = { startsAt: days(-1) };
    const acc = await access(1);
    expect(acc.pro).toBe(true);
    expect(acc.reason).toBe("trial");
    expect(acc.trialStarted).toBe(true);
    expect(acc.trialEndsAt!.getTime()).toBeGreaterThan(Date.now());
  });

  test("через 14 дней после первой сессии триал кончается", async () => {
    firstAppt = { startsAt: days(-15) };
    const acc = await access(1);
    expect(acc.pro).toBe(false);
    expect(acc.reason).toBe("none");
    expect(acc.trialStarted).toBe(true);
  });

  test("после подписки триал не возвращается", async () => {
    // Истёкшая подписка не должна отправлять человека обратно в бесплатный
    // пробный период по кругу.
    firstAppt = { startsAt: days(-1) };
    subRow = { status: "expired", currentPeriodEnd: days(-3) };
    const acc = await access(1);
    expect(acc.pro).toBe(false);
    expect(acc.reason).toBe("none");
  });

  test("оплаченная подписка даёт PRO", async () => {
    subRow = { status: "active", currentPeriodEnd: days(20) };
    const acc = await access(1);
    expect(acc.pro).toBe(true);
    expect(acc.reason).toBe("paid");
  });

  test("выданный вручную доступ помечен granted", async () => {
    subRow = { status: "active", currentPeriodEnd: days(20), grantedBy: 1 };
    expect((await access(1)).reason).toBe("granted");
  });
});

describe("бесплатное размещение в каталоге", () => {
  beforeEach(() => {
    userRow = { createdAt: days(-200) };
    psyRow = null;
    subRow = null;
    firstAppt = null;
  });

  test("до одобрения анкеты каталога нет", async () => {
    psyRow = { status: "review", reviewedAt: null };
    const acc = await access(1);
    expect(acc.catalog).toBe(false);
    expect(acc.catalogUntil).toBeNull();
  });

  test("14 дней после одобрения карточка стоит бесплатно", async () => {
    psyRow = { status: "approved", reviewedAt: days(-5) };
    const acc = await access(1);
    expect(acc.catalog).toBe(true);
    expect(acc.pro).toBe(false);
  });

  test("после 14 дней без PRO карточка снимается", async () => {
    psyRow = { status: "approved", reviewedAt: days(-15) };
    expect((await access(1)).catalog).toBe(false);
  });

  test("PRO держит карточку и после бесплатных дней", async () => {
    psyRow = { status: "approved", reviewedAt: days(-90) };
    subRow = { status: "active", currentPeriodEnd: days(20) };
    expect((await access(1)).catalog).toBe(true);
  });

  test("пробный PRO тоже держит карточку", async () => {
    psyRow = { status: "approved", reviewedAt: days(-30) };
    firstAppt = { startsAt: days(-3) };
    const acc = await access(1);
    expect(acc.pro).toBe(true);
    expect(acc.catalog).toBe(true);
  });
});

// Тем же правилом каталог отсекает чужие анкеты: деньги решают, кто в выдаче,
// поэтому расчёт проверяется отдельно от чтения базы.
describe("правило размещения", () => {
  test("неодобренная анкета в каталог не идёт", () => {
    expect(catalogPlacement({ status: "review", reviewedAt: days(-1) }).placed).toBe(false);
    expect(catalogPlacement({ status: "rejected", reviewedAt: days(-1) }).reason).toBe("not_approved");
  });

  test("первые 14 дней после одобрения — бесплатно", () => {
    const p = catalogPlacement({ status: "approved", reviewedAt: days(-13) });
    expect(p.placed).toBe(true);
    expect(p.reason).toBe("free");
  });

  test("на пятнадцатый день без оплаты карточка снимается", () => {
    const p = catalogPlacement({ status: "approved", reviewedAt: days(-15) });
    expect(p.placed).toBe(false);
    expect(p.reason).toBe("expired");
  });

  test("оплаченный PRO возвращает карточку в выдачу", () => {
    const p = catalogPlacement({ status: "approved", reviewedAt: days(-40), subStatus: "active", currentPeriodEnd: days(10) });
    expect(p.placed).toBe(true);
    expect(p.reason).toBe("paid");
  });

  test("истёкшая подписка не считается оплатой", () => {
    const p = catalogPlacement({ status: "approved", reviewedAt: days(-40), subStatus: "active", currentPeriodEnd: days(-1) });
    expect(p.placed).toBe(false);
  });

  test("неоплаченная заявка на подписку карточку не держит", () => {
    const p = catalogPlacement({ status: "approved", reviewedAt: days(-40), subStatus: "pending", currentPeriodEnd: null });
    expect(p.placed).toBe(false);
  });

  test("одобрение без даты проверки бесплатных дней не даёт", () => {
    const p = catalogPlacement({ status: "approved", reviewedAt: null });
    expect(p.placed).toBe(false);
    expect(p.freeUntil).toBeNull();
  });
});
