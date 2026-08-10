import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

/**
 * Демо-сборка на Pages повторяет прод слово в слово: пускать её в индекс —
 * значит соревноваться с самим собой за одни и те же запросы. Поэтому демо
 * закрыто целиком, а на боевом домене открыты публичные разделы и закрыт
 * личный кабинет.
 */
export default function robots(): MetadataRoute.Robots {
  if (DEMO) return { rules: [{ userAgent: "*", disallow: "/" }] };

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/billing", "/cabinet", "/clients", "/schedule", "/sessions", "/therapy"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
