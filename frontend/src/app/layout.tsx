import type { Metadata, Viewport } from "next";
import { Golos_Text, Nunito } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";

import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { ConsentGate } from "@/components/consent-gate";
import { DemoFrame } from "@/components/demo-frame";
import { DragScroll } from "@/components/drag-scroll";
import { StartRoute } from "@/components/start-route";
import { TelegramInit } from "@/components/telegram-init";
import { VersionCheck } from "@/components/version-check";
import { Providers } from "./providers";
import { APP_NAME } from "@/lib/brand";

const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

// Заголовки — Nunito: округлая, это характер бренда.
const head = Nunito({ subsets: ["latin", "cyrillic"], weight: ["700", "800", "900"], variable: "--font-head", display: "swap" });
// Текст — Golos Text: сделан под русские интерфейсы и лучше читается в мелких
// кеглях, а у нас основная масса текста как раз 11–14 px.
const body = Golos_Text({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: `${APP_NAME} — среда для психологической помощи`,
  description: "Инструмент психолога, площадка поиска и цифровая самопомощь",
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
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
        <TelegramInit />
        <StartRoute />
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
              <AppShell>{children}</AppShell>
            )}
          </ConsentGate>
        </Providers>
      </body>
    </html>
  );
}
