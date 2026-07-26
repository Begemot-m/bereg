import { SignJWT, jwtVerify } from "jose";

import { env } from "@/lib/server/env";

// Access-токен живёт минуты и не хранится в базе: его дешевле перевыпустить,
// чем проверять. Долгоживущий refresh — не JWT, а случайная строка с хэшем
// в базе (см. server/sessions.ts): только так его можно отозвать.

const key = () => new TextEncoder().encode(env.jwtSecret);

export async function createAccessToken(userId: number, sessionId: string): Promise<string> {
  return new SignJWT({ type: "access", sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${env.accessTtlSeconds}s`)
    .sign(key());
}

export type AccessClaims = { userId: number; sessionId: string };

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, key());
  if (payload.type !== "access") throw new Error("wrong token type");
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) throw new Error("bad subject");
  return { userId, sessionId: String(payload.sid ?? "") };
}
