import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/server/access";
import { audit } from "@/lib/server/audit";
import { deleteStoredFile, readStoredFile } from "@/lib/server/files";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

// Файл отдаём только владельцу и модератору, и только через этот роут: прямой
// раздачи каталога с диска нет, иначе ссылка на чужой диплом утекала бы
// вместе с адресом.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const id = Number((await params).id);
    const doc = await prisma.psyDocument.findUnique({ where: { id } });
    if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (doc.userId !== user.id && !(await isAdmin(user.id))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const bytes = await readStoredFile(doc.storageKey);
    if (doc.userId !== user.id) {
      // Кто и когда открыл чужой документ — единственная защита от тихого
      // просмотра дипломов модератором «просто так».
      await audit(req, { userId: user.id, action: "admin.document.view", entity: "PsyDocument", entityId: String(doc.id) });
    }
    // Картинку показываем прямо в модерации, а PDF отдаём файлом: он умеет
    // исполнять свой скрипт, а открытый inline — делает это на нашем домене.
    const disposition = doc.mime === "application/pdf" ? "attachment" : "inline";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": doc.mime,
        "content-length": String(bytes.length),
        "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const id = Number((await params).id);
    const doc = await prisma.psyDocument.findUnique({ where: { id } });
    if (!doc) return NextResponse.json({ ok: true });
    if (doc.userId !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    // Сначала строка в базе, потом файл: если упадём между шагами, останется
    // сирота на диске, а не запись, которая ссылается в пустоту.
    await prisma.psyDocument.delete({ where: { id } });
    await deleteStoredFile(doc.storageKey);
    await audit(req, { userId: user.id, action: "psy.document.delete", entity: "PsyDocument", entityId: String(id) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
