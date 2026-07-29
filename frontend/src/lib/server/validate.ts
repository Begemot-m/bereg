// Разбор тела запроса по схеме.
//
// Раньше каждый роут проверял поля руками: где-то полно, где-то забывали.
// Схема описывает форму один раз, а всё, что не подошло, отсекается до того,
// как попадёт в базу. Заодно ответ об ошибке становится одинаковым везде.

import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export class InvalidBody extends Error {
  constructor(readonly issues: { path: string; message: string }[]) {
    super("invalid body");
  }
}

/**
 * Прочитать и проверить JSON тела. Бросает InvalidBody — ловится общим
 * обработчиком роута рядом с AuthError.
 */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new InvalidBody([{ path: "", message: "Ожидался JSON" }]);
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new InvalidBody(
      result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return result.data;
}

/** Готовый ответ 422 с перечнем полей — клиенту понятно, что именно не так. */
export function invalidBodyResponse(error: InvalidBody) {
  return NextResponse.json(
    { error: "invalid_body", message: "Проверьте заполненные поля", issues: error.issues },
    { status: 422 },
  );
}
