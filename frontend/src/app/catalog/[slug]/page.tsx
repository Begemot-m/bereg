import type { Metadata } from "next";

import { CatalogView } from "@/components/catalog-view";
import { PSYS, type Psy } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { yearsWord } from "@/lib/morph";
import { psyIdFromSlug, psySlug } from "@/lib/psy-url";
import { SITE_URL } from "@/lib/seo";

// Демо собирается статикой и базы не знает — карточки там из мока.
const STATIC = process.env.NEXT_PUBLIC_DEMO === "1" || process.env.STATIC_EXPORT === "1";

/**
 * Адреса анкет для статической сборки. В бою список пуст: анкеты заводят и
 * снимают каждый день, страница собирается по запросу.
 */
export function generateStaticParams() {
  return PSYS.map((psy) => ({ slug: psySlug(psy.name, psy.id) }));
}

async function psyById(id: number): Promise<Psy | null> {
  if (!id) return null;
  if (STATIC) return PSYS.find((psy) => psy.id === id) ?? null;
  try {
    const res = await fetch(`${SITE_URL}/api/catalog?id=${id}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const rows = (await res.json()) as Psy[];
    return rows[0] ?? null;
  } catch {
    // Анкету не достали — страница всё равно откроется, метаданные будут общими.
    return null;
  }
}

function specialistWord(psy: Psy): string {
  return psy.specialistTypes?.[0] ?? "Психолог";
}

function describe(psy: Psy): string {
  const place = psy.format === "online" ? "Онлайн" : psy.format === "offline" ? psy.city || "Очно" : psy.city ? `Онлайн и очно, ${psy.city}` : "Онлайн и очно";
  const parts = [
    `${specialistWord(psy)}, ${psy.method}`,
    `${psy.years} ${yearsWord(psy.years)} практики`,
    place,
    psy.price ? `сессия ${psy.minutes} мин — ${formatMoney(psy.price, psy.currency ?? "RUB")}` : "",
  ].filter(Boolean);
  const head = parts.join(". ");
  const helps = psy.topics.length ? ` Помогаю с темами: ${psy.topics.slice(0, 5).join(", ")}.` : "";
  return `${head}.${helps} Свободные окна и запись — в Хронике.`.slice(0, 300);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const psy = await psyById(psyIdFromSlug(slug));
  if (!psy) return { title: "Специалист", alternates: { canonical: `/catalog/${slug}` }, robots: { index: false, follow: true } };

  const title = `${psy.name} — ${specialistWord(psy).toLowerCase()}, ${psy.method}`;
  const description = describe(psy);
  const canonical = `/catalog/${psySlug(psy.name, psy.id)}`;
  const photo = psy.portrait?.startsWith("http") || psy.portrait?.startsWith("/api/") ? psy.portrait : undefined;
  return {
    title,
    description,
    alternates: { canonical },
    // Анкета до модерации открывается по прямой ссылке от специалиста, но в
    // поиске ей делать нечего: проверку документов она ещё не прошла.
    ...(psy.verified ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      type: "profile",
      url: canonical,
      title,
      description,
      ...(photo ? { images: [{ url: photo, alt: `Портрет: ${psy.name}` }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description, ...(photo ? { images: [photo] } : {}) },
  };
}

export default async function PsyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = psyIdFromSlug(slug);
  const psy = await psyById(id);

  return (
    <>
      {psy?.verified && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ProfilePage",
              mainEntity: {
                "@type": "Person",
                name: psy.name,
                jobTitle: specialistWord(psy),
                description: describe(psy),
                knowsAbout: psy.topics.slice(0, 12),
                knowsLanguage: psy.languages,
                url: `${SITE_URL}/catalog/${psySlug(psy.name, psy.id)}`,
                ...(psy.city ? { address: { "@type": "PostalAddress", addressLocality: psy.city } } : {}),
                ...(psy.price
                  ? {
                      makesOffer: {
                        "@type": "Offer",
                        itemOffered: { "@type": "Service", name: `Консультация психолога, ${psy.minutes} мин` },
                        price: psy.price,
                        priceCurrency: psy.currency ?? "RUB",
                      },
                    }
                  : {}),
              },
            }),
          }}
        />
      )}
      <CatalogView psyId={id} />
    </>
  );
}
