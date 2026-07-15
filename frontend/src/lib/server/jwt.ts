import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-insecure-secret-change-me",
);

const ACCESS_TTL = "30m";
const REFRESH_TTL = "30d";

async function sign(userId: number, type: "access" | "refresh", ttl: string): Promise<string> {
  return new SignJWT({ type })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secret);
}

export const createAccessToken = (userId: number) => sign(userId, "access", ACCESS_TTL);
export const createRefreshToken = (userId: number) => sign(userId, "refresh", REFRESH_TTL);

export async function verifyToken(
  token: string,
  expectedType: "access" | "refresh",
): Promise<number> {
  const { payload } = await jwtVerify(token, secret);
  if (payload.type !== expectedType) throw new Error("wrong token type");
  return Number(payload.sub);
}
