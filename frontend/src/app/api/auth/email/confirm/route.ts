import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/server/audit";
import { env } from "@/lib/server/env";
import { consumeEmailToken } from "@/lib/server/otp";
import { prisma } from "@/lib/server/prisma";
import { LIMITS, limited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const stop = limited(req, "email-confirm", LIMITS.auth);
  if (stop) return stop;

  const token = req.nextUrl.searchParams.get("token") ?? "";
  const target = new URL("/cabinet", env.appUrl);
  if (token.length < 32) {
    target.searchParams.set("email_confirmed", "0");
    return NextResponse.redirect(target);
  }

  const result = await consumeEmailToken(token);
  const user = result.ok ? await prisma.user.findUnique({ where: { email: result.email } }) : null;
  if (!result.ok || !user || user.deletedAt) {
    target.searchParams.set("email_confirmed", "0");
    return NextResponse.redirect(target);
  }

  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  await audit(req, { userId: user.id, action: "email.verify" });
  target.searchParams.set("email_confirmed", "1");
  return NextResponse.redirect(target);
}
