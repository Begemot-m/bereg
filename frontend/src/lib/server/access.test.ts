import { describe, expect, mock, test } from "bun:test";

type Row = { status: string } | null;

let row: Row = null;
// Статус переехал к пользователю; анкета осталась запасным источником на время
// перехода, поэтому в тесте есть обе таблицы.
let userRow: { psyStatus: string } | null = null;
mock.module("./prisma", () => ({
  prisma: {
    psyProfile: { findUnique: async () => row },
    user: { findUnique: async () => userRow },
  },
}));

const { psyApproved } = await import("./access");

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
