import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

// Каталог открыт без входа: человек должен увидеть специалистов до регистрации.
// Отдаём только опубликованные анкеты и только публичные поля — точный адрес
// и контакты сюда не попадают, они открываются после подтверждённой записи.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const maxPrice = Number(url.searchParams.get("maxPrice") ?? 0);

  const rows = await prisma.psyProfile.findMany({
    where: {
      status: "approved",
      ...(format && format !== "any" ? { OR: [{ format }, { format: "both" }] } : {}),
      ...(maxPrice > 0 ? { sessionPrice: { lte: maxPrice } } : {}),
    },
    orderBy: { sessionPrice: "asc" },
    take: 100,
  });

  const psys = rows.map((row) => {
    const data = (row.data as Record<string, unknown>) ?? {};
    const location = (data.location ?? {}) as Record<string, unknown>;
    return {
      id: row.userId,
      name: row.name,
      method: row.primaryMethod,
      methods: data.methods ?? [],
      years: row.experienceYears,
      price: row.sessionPrice,
      minutes: row.sessionMinutes,
      format: row.format,
      topics: data.topics ?? [],
      avoids: data.avoids ?? [],
      about: data.about ?? "",
      firstSession: data.firstSession ?? "",
      education: data.education ?? [],
      languages: data.languages ?? [],
      specialistTypes: data.specialistTypes ?? [],
      style: data.style ?? "",
      quote: data.quote ?? "",
      photos: data.photos ?? [],
      portrait: (data.photos as string[] | undefined)?.[0] ?? "",
      // Из адреса — только город и район: точное место после записи.
      city: location.city ?? "",
      district: location.district ?? "",
      metro: location.metro ?? "",
    };
  });

  return NextResponse.json(psys);
}
