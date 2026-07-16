import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";

import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { DemoFrame } from "@/components/demo-frame";
import { Providers } from "./providers";
import { APP_NAME } from "@/lib/brand";

const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

const sans = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-mono", display: "swap" });

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
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* afterInteractive: скрипт Telegram навешивает стили на <html> ПОСЛЕ гидрации,
            иначе получаем hydration mismatch и падение при переходах. */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
        <Providers>
          {DEMO ? (
            <DemoFrame>
              <AppShell>{children}</AppShell>
            </DemoFrame>
          ) : (
            <AppShell>{children}</AppShell>
          )}
        </Providers>
      </body>
    </html>
  );
}
