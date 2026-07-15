import { NextResponse, type NextRequest } from "next/server";

import { createAccessToken, createRefreshToken, verifyToken } from "@/lib/server/jwt";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { refresh_token } = (await req.json()) as { refresh_token?: string };
  if (!refresh_token) {
    return NextResponse.json({ error: "missing refresh_token" }, { status: 400 });
  }

  let userId: number;
  try {
    userId = await verifyToken(refresh_token, "refresh");
  } catch {
    return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

  return NextResponse.json({
    access_token: await createAccessToken(user.id),
    refresh_token: await createRefreshToken(user.id),
    token_type: "bearer",
  });
}
