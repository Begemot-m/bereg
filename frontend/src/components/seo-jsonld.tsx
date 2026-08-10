import { BOT_NAME, CENTER, CENTER_URL } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";
import { FAQ_ITEMS, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

/**
 * Микроразметка для поисковиков. Серверный компонент: попадает в HTML сразу,
 * не дожидаясь гидрации, — иначе роботы, которые не исполняют JS, не увидят
 * ничего. Схемы описывают ровно то, что есть на странице: организацию, сайт,
 * само приложение и блок вопросов.
 */
export function SeoJsonLd() {
  const graph = [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      email: LEGAL.email,
      taxID: LEGAL.inn,
      legalName: LEGAL.operator,
      sameAs: [`https://t.me/${BOT_NAME}`, CENTER_URL],
      parentOrganization: { "@type": "Organization", name: CENTER, url: CENTER_URL },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "ru-RU",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      applicationCategory: "HealthApplication",
      applicationSubCategory: "Психологическая помощь и ведение практики",
      operatingSystem: "Telegram, Web",
      url: SITE_URL,
      installUrl: `https://t.me/${BOT_NAME}`,
      description: SITE_DESCRIPTION,
      inLanguage: "ru-RU",
      offers: { "@type": "Offer", price: "0", priceCurrency: "RUB", availability: "https://schema.org/InStock" },
      featureList: [
        "Каталог проверенных психологов и подбор специалиста по запросу",
        "Онлайн-запись в свободные окна и напоминания о встрече",
        "Расписание и рабочие часы психолога",
        "Карточки клиентов: история встреч, заметки и домашние задания",
        "Дневник настроения и динамика состояния",
        "Практики самопомощи между сессиями",
      ],
    },
    {
      "@type": "MedicalWebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "ru-RU",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@type": "MedicalSpecialty", name: "Психология и психотерапия" },
      audience: { "@type": "Audience", audienceType: "Психологи и люди, ищущие психологическую помощь" },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      // Схема собирается из наших же констант, посторонней строки тут не бывает.
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }) }}
    />
  );
}
