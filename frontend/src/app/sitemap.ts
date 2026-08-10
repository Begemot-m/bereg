import type { MetadataRoute } from "next";

import { LEGAL_DOCS } from "@/lib/legal";
import { SITE_URL } from "@/lib/seo";

// Без этого статический экспорт демо падает: `new Date()` делает роут
// динамическим, а в `output: export` динамики быть не может.
export const dynamic = "force-static";

/** Публичные страницы: главная, каталог, документы. Кабинет в карту не идёт. */
export default function sitemap(): MetadataRoute.Sitemap {
  // Дата сборки, а не запроса: карту всё равно перегенерирует следующий релиз.
  const now = new Date(process.env.NEXT_PUBLIC_BUILD ?? Date.now());
  const pages: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, freq: "weekly" },
    { path: "/catalog", priority: 0.9, freq: "daily" },
    { path: "/tools", priority: 0.6, freq: "monthly" },
    { path: "/docs", priority: 0.3, freq: "yearly" },
    { path: "/policy", priority: 0.3, freq: "yearly" },
    ...LEGAL_DOCS.map((doc) => ({ path: doc.href, priority: 0.2, freq: "yearly" as const })),
  ];

  return pages.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.freq,
    priority: page.priority,
  }));
}
