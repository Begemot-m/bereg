import { beforeEach, describe, expect, mock, test } from "bun:test";

type Row = { status: string } | null;

let row: Row = null;
// Статус переехал к пользователю; анкета осталась запасным источником на время
// перехода, поэтому в тесте есть обе таблицы.
let userRow: { psyStatus?: string; createdAt?: Date; deletedAt?: Date | null; blockedAt?: Date | null } | null = null;
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

  test("удалённый и заблокированный не считаются одобренными", async () => {
    // Ссылка-приглашение подписана вечно: без этой проверки она заводила
    // клиенту связь с тем, кого на платформе уже нет.
    row = { status: "approved" };
    userRow = { psyStatus: "approved", deletedAt: new Date() };
    expect(await psyApproved(1)).toBe(false);
    userRow = { psyStatus: "approved", blockedAt: new Date() };
    expect(await psyApproved(1)).toBe(false);
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

  test("до верификации триал не начат, но и не сгорел", async () => {
    // Регистрация была давно; отсчёт от неё сгорал прямо в очереди модерации.
    const acc = await access(1);
    expect(acc.pro).toBe(false);
    expect(acc.trialStarted).toBe(false);
    expect(acc.trialEndsAt).toBeNull();
  });

  test("верификация включает 14 дней PRO", async () => {
    psyRow = { status: "approved", reviewedAt: days(-1) };
    const acc = await access(1);
    expect(acc.pro).toBe(true);
    expect(acc.reason).toBe("trial");
    expect(acc.trialStarted).toBe(true);
    expect(acc.trialEndsAt!.getTime()).toBeGreaterThan(Date.now());
  });

  test("через 14 дней после верификации триал кончается", async () => {
    psyRow = { status: "approved", reviewedAt: days(-15) };
    const acc = await access(1);
    expect(acc.pro).toBe(false);
    expect(acc.reason).toBe("none");
    expect(acc.trialStarted).toBe(true);
  });

  test("счётчик идёт от своей даты одобрения, а не с сегодняшнего дня", async () => {
    // Тем, кто верифицирован до релиза, пробные дни не начинаются заново:
    // одобрили десять дней назад — осталось четыре.
    psyRow = { status: "approved", reviewedAt: days(-10) };
    const acc = await access(1);
    const left = Math.round((acc.trialEndsAt!.getTime() - Date.now()) / 86_400_000);
    expect(left).toBe(4);
  });

  test("других пробных периодов нет: после 14 дней доступ только по подписке", async () => {
    // Заявка из каталога когда-то включала свои 30 дней — этой ветки больше
    // нет, пробный PRO у человека ровно один и уже истёк.
    psyRow = { status: "approved", reviewedAt: days(-90) };
    userRow = { createdAt: days(-200) };
    const acc = await access(1);
    expect(acc.pro).toBe(false);
    expect(acc.reason).toBe("none");
    expect(acc.trialEndsAt).toBeNull();
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

  test("после одобрения карточка стоит бесплатно", async () => {
    psyRow = { status: "approved", reviewedAt: days(-5) };
    expect((await access(1)).catalog).toBe(true);
  });

  test("кончившиеся пробные дни карточку не снимают", async () => {
    psyRow = { status: "approved", reviewedAt: days(-15) };
    const acc = await access(1);
    expect(acc.pro).toBe(false);
    expect(acc.catalog).toBe(true);
  });

  test("без подписки и через год анкета в каталоге", async () => {
    psyRow = { status: "approved", reviewedAt: days(-400) };
    expect((await access(1)).catalog).toBe(true);
  });

  test("PRO на размещение не влияет", async () => {
    psyRow = { status: "approved", reviewedAt: days(-90) };
    subRow = { status: "active", currentPeriodEnd: days(20) };
    expect((await access(1)).catalog).toBe(true);
  });
});

// Тем же правилом каталог отсекает чужие анкеты: деньги решают, кто в выдаче,
// поэтому расчёт проверяется отдельно от чтения базы.
describe("правило размещения", () => {
  test("неодобренная анкета в каталог не идёт", () => {
    expect(catalogPlacement({ status: "review", reviewedAt: days(-1) }).placed).toBe(false);
    expect(catalogPlacement({ status: "rejected", reviewedAt: days(-1) }).reason).toBe("not_approved");
  });

  test("одобренная анкета стоит в каталоге бесплатно", () => {
    const p = catalogPlacement({ status: "approved", reviewedAt: days(-13) });
    expect(p.placed).toBe(true);
    expect(p.reason).toBe("free");
  });

  test("размещение не кончается вместе с пробными днями", () => {
    const p = catalogPlacement({ status: "approved", reviewedAt: days(-400) });
    expect(p.placed).toBe(true);
    expect(p.reason).toBe("free");
  });

  test("оплаченный PRO на размещение не влияет — только на пометку", () => {
    const p = catalogPlacement({ status: "approved", reviewedAt: days(-40), subStatus: "active", currentPeriodEnd: days(10) });
    expect(p.placed).toBe(true);
    expect(p.reason).toBe("paid");
  });

  test("истёкшая подписка не считается оплатой, но карточку не снимает", () => {
    const p = catalogPlacement({ status: "approved", reviewedAt: days(-40), subStatus: "active", currentPeriodEnd: days(-1) });
    expect(p.placed).toBe(true);
    expect(p.reason).toBe("free");
  });

  test("неоплаченная заявка на подписку — не оплата", () => {
    const p = catalogPlacement({ status: "approved", reviewedAt: days(-40), subStatus: "pending", currentPeriodEnd: null });
    expect(p.placed).toBe(true);
    expect(p.reason).toBe("free");
  });

  test("одобрение без даты не даёт пробных дней, но каталог даёт", () => {
    const p = catalogPlacement({ status: "approved", reviewedAt: null });
    expect(p.placed).toBe(true);
    expect(p.freeUntil).toBeNull();
  });
});
