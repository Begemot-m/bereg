// Одноразовые коды входа.
//
// Правила, от которых зависит, взломают вход или нет:
//   — в базе только SHA-256 хэша кода, как и у refresh-токенов;
//   — код 6 цифр из crypto, а не Math.random (тот предсказуем);
//   — жизнь 10 минут, попыток 5, после чего запись сгорает;
//   — ответ на запрос кода одинаковый для существующей и несуществующей
//     почты, иначе форма превращается в проверку «есть ли такой аккаунт».

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/server/prisma";

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const hash = (code: string) => createHash("sha256").update(code).digest();

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

async function issueSecret(email: string, secret: string, ip: string | null): Promise<string> {
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000);

  // Прошлые коды для этой почты гасим: иначе их накапливается пачка,
  // и каждый — ещё пять попыток подбора.
  await prisma.emailOtp.updateMany({
    where: { email, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.emailOtp.create({
    data: { email, codeHash: hash(secret).toString("base64"), expiresAt, ip },
  });
  return secret;
}

export async function issueCode(email: string, ip: string | null): Promise<string> {
  return issueSecret(email, generateCode(), ip);
}

export async function issueEmailToken(email: string, ip: string | null): Promise<string> {
  return issueSecret(email, randomBytes(32).toString("base64url"), ip);
}

export type CheckResult = { ok: true } | { ok: false; reason: "expired" | "wrong" | "too_many" };

export async function checkCode(email: string, code: string): Promise<CheckResult> {
  const otp = await prisma.emailOtp.findFirst({
    where: { email, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return { ok: false, reason: "expired" };
  if (otp.attempts >= MAX_ATTEMPTS) {
    await prisma.emailOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
    return { ok: false, reason: "too_many" };
  }

  // Сравнение постоянного времени: обычное === на длинных совпадениях
  // отвечает чуть дольше и по этому времени код подбирается посимвольно.
  const expected = Buffer.from(otp.codeHash, "base64");
  const given = hash(code);
  const same = expected.length === given.length && timingSafeEqual(expected, given);

  if (!same) {
    await prisma.emailOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, reason: "wrong" };
  }

  await prisma.emailOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
  return { ok: true };
}

export async function consumeEmailToken(token: string): Promise<{ ok: true; email: string } | { ok: false }> {
  const codeHash = hash(token).toString("base64");
  const otp = await prisma.emailOtp.findFirst({
    where: { codeHash, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return { ok: false };
  await prisma.emailOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
  return { ok: true, email: otp.email };
}

export const normalizeEmail = (raw: string) => raw.trim().toLowerCase();
export const looksLikeEmail = (raw: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());
