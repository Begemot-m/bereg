import type { MetadataRoute } from "next";

import type { Psy } from "@/lib/catalog";
import { LEGAL_DOCS } from "@/lib/legal";
import { psySlug } from "@/lib/psy-url";
import { SITE_URL } from "@/lib/seo";

// Без этого статический экспорт демо падает: `new Date()` делает роут
// динамическим, а в `output: export` динамики быть не может.
export const dynamic = "force-static";
// В бою карту пересобираем раз в час: анкеты появляются чаще, чем релизы.
export const revalidate = 3600;

const STATIC = process.env.NEXT_PUBLIC_DEMO === "1" || process.env.STATIC_EXPORT === "1";

/** Анкеты каталога — своими адресами. Демо базы не знает, там карта без них. */
async function psyPages(): Promise<string[]> {
  if (STATIC) return [];
  try {
    const res = await fetch(`${SITE_URL}/api/catalog`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const rows = (await res.json()) as Psy[];
    return rows.map((psy) => `/catalog/${psySlug(psy.name, psy.id)}`);
  } catch {
    return [];
  }
}

/** Публичные страницы: главная, каталог, документы. Кабинет в карту не идёт. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Дата сборки, а не запроса: карту всё равно перегенерирует следующий релиз.
  const now = new Date(process.env.NEXT_PUBLIC_BUILD ?? Date.now());
  const pages: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, freq: "weekly" },
    { path: "/catalog", priority: 0.9, freq: "daily" },
    { path: "/tools", priority: 0.6, freq: "monthly" },
    { path: "/docs", priority: 0.3, freq: "yearly" },
    { path: "/policy", priority: 0.3, freq: "yearly" },
    ...LEGAL_DOCS.map((doc) => ({ path: doc.href, priority: 0.2, freq: "yearly" as const })),
    ...(await psyPages()).map((path) => ({ path, priority: 0.8, freq: "weekly" as const })),
  ];

  return pages.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.freq,
    priority: page.priority,
  }));
}
