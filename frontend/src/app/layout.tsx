import type { Metadata, Viewport } from "next";
import { Golos_Text, Nunito } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";

import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { PhoneShell } from "@/components/phone-shell";
import { ConsentGate } from "@/components/consent-gate";
import { DemoFrame } from "@/components/demo-frame";
import { DragScroll } from "@/components/drag-scroll";
import { TelegramInit } from "@/components/telegram-init";
import { VersionCheck } from "@/components/version-check";
import { SeoJsonLd } from "@/components/seo-jsonld";
import { Providers } from "./providers";
import { APP_NAME } from "@/lib/brand";
import { KEYWORDS, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/seo";

const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

// Заголовки — Nunito: округлая, это характер бренда.
const head = Nunito({ subsets: ["latin", "cyrillic"], weight: ["700", "800", "900"], variable: "--font-head", display: "swap" });
// Текст — Golos Text: сделан под русские интерфейсы и лучше читается в мелких
// кеглях, а у нас основная масса текста как раз 11–14 px.
// Веса до 900: в интерфейсе полно `font-black`, и без настоящего начертания
// браузер синтезирует жирный — буквы расплываются и выглядят кривыми.
const body = Golos_Text({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700", "800", "900"], variable: "--font-body", display: "swap" });

// Демо на Pages — копия прода по текстам. Пускать его в индекс нельзя:
// поисковик увидит два одинаковых сайта и размажет позиции между ними.
const INDEXABLE = !DEMO;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s — ${APP_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: KEYWORDS,
  applicationName: APP_NAME,
  category: "health",
  authors: [{ name: APP_NAME, url: SITE_URL }],
  creator: APP_NAME,
  publisher: APP_NAME,
  alternates: { canonical: "/" },
  robots: INDEXABLE
    ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } }
    : { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    locale: "ru_RU",
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: SITE_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  formatDetection: { telephone: false, email: false, address: false },
  // Иконка ярлыка на телефоне. Без неё iOS кладёт на рабочий стол уменьшенный
  // снимок страницы — по такому значку приложение не узнать.
  icons: {
    icon: [{ url: "/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f9f8f3",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Без cover браузер не отдаёт env(safe-area-inset-*) — они молча равны нулю,
  // и контент уезжает под чёлку и под кнопки Telegram.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${head.variable} ${body.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Имя CSS-файла меняется с каждой сборкой, а вебвью Telegram охотно
            кеширует HTML — тогда страница тянет исчезнувший стиль и остаётся
            голой. Просим не кешировать саму разметку (React поднимает эти
            теги в head). */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        {/* afterInteractive: скрипт Telegram навешивает стили на <html> ПОСЛЕ гидрации,
            иначе получаем hydration mismatch и падение при переходах. */}
        <SeoJsonLd />
        {/* Приложение рисуется на клиенте: без JS страница осталась бы пустой,
            и робот, который не исполняет скрипты, не понял бы, о чём сайт.
            Текст здесь — тот же, что видит гость на лендинге. */}
        <noscript>
          <h1>{SITE_TITLE}</h1>
          <p>{SITE_DESCRIPTION}</p>
          <ul>
            <li>Каталог проверенных психологов и подбор специалиста по запросу, методу, формату и бюджету</li>
            <li>Онлайн-запись в свободные окна, напоминания и переносы встреч</li>
            <li>Психологу — расписание, карточки клиентов, заметки и домашние задания</li>
            <li>Дневник настроения и практики самопомощи между сессиями</li>
          </ul>
          <p>
            <a href="/catalog">Каталог психологов</a> · <a href="/docs">Документы сервиса</a> ·{" "}
            <a href="/policy">Политика конфиденциальности</a>
          </p>
        </noscript>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
        <TelegramInit />
        <VersionCheck />
        <DragScroll />
        <Providers>
          {/* Без согласия приложение не показывается — это требование, а не
              настройка. В демо и при недоступном бэкенде гейт пропускает. */}
          <ConsentGate>
            {DEMO ? (
              <DemoFrame>
                <AppShell>{children}</AppShell>
              </DemoFrame>
            ) : (
              <PhoneShell>
                <AppShell>{children}</AppShell>
              </PhoneShell>
            )}
          </ConsentGate>
        </Providers>
      </body>
    </html>
  );
}
