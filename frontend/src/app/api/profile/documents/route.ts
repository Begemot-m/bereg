import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/server/audit";
import { newStorageKey, saveFile } from "@/lib/server/files";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

// Пять мегабайт на файл: фотография диплома с телефона укладывается, а скан
// целого альбома сертификатов модератору всё равно не нужен.
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENTS = 6;
const ALLOWED = /^(image\/(jpeg|png|heic|heif|webp)|application\/pdf)$/;

export type DocumentRow = {
  id: number;
  kind: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
};

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const docs = await prisma.psyDocument.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, kind: true, name: true, mime: true, size: true, createdAt: true },
    });
    return NextResponse.json({ documents: docs.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 422 });
    if (file.size === 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "file too large" }, { status: 413 });
    if (!ALLOWED.test(file.type)) return NextResponse.json({ error: "unsupported type" }, { status: 415 });

    const count = await prisma.psyDocument.count({ where: { userId: user.id } });
    if (count >= MAX_DOCUMENTS) return NextResponse.json({ error: "too many documents" }, { status: 409 });

    const kind = form.get("kind") === "certificate" ? "certificate" : "diploma";
    const storageKey = newStorageKey();
    await saveFile(storageKey, Buffer.from(await file.arrayBuffer()));

    const doc = await prisma.psyDocument.create({
      data: {
        userId: user.id,
        kind,
        name: (file.name || "документ").slice(0, 120),
        mime: file.type,
        size: file.size,
        storageKey,
      },
      select: { id: true, kind: true, name: true, mime: true, size: true, createdAt: true },
    });

    // В аудит — сам факт и метаданные. Содержимое документа в журнал не попадает.
    await audit(req, { userId: user.id, action: "psy.document.upload", meta: { documentId: doc.id, kind } });
    return NextResponse.json({ document: { ...doc, createdAt: doc.createdAt.toISOString() } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
