import { describe, expect, mock, test } from "bun:test";

type Row = { status: string } | null;

let row: Row = null;
mock.module("./prisma", () => ({
  prisma: { psyProfile: { findUnique: async () => row } },
}));

const { psyApproved } = await import("./access");

describe("гейт на приём клиентов", () => {
  test("без анкеты клиентов брать нельзя", async () => {
    row = null;
    expect(await psyApproved(1)).toBe(false);
  });

  test("черновик, проверка и отказ не открывают доступ", async () => {
    for (const status of ["draft", "review", "rejected"]) {
      row = { status };
      expect(await psyApproved(1)).toBe(false);
    }
  });

  test("approved открывает", async () => {
    row = { status: "approved" };
    expect(await psyApproved(1)).toBe(true);
  });
});
