import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Для GitHub Pages: STATIC_EXPORT=1 включает статическую сборку в /out,
// basePath = имя репозитория (сайт живёт на begemot-m.github.io/<repo>/).
const isStatic = process.env.STATIC_EXPORT === "1";
const repo = process.env.PAGES_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: here,
  // Базовый путь доступен в клиенте для ссылок на public-ассеты (картинки маскотов).
  // Метка сборки: видна в кабинете, чтобы отличать свежую версию от той,
  // что вебвью достал из кеша, — иначе «не применилось» не проверить.
  env: {
    NEXT_PUBLIC_BASE_PATH: repo ? `/${repo}` : "",
    NEXT_PUBLIC_BUILD: new Date().toISOString(),
  },
  ...(isStatic
    ? {
        output: "export",
        basePath: repo ? `/${repo}` : undefined,
        assetPrefix: repo ? `/${repo}/` : undefined,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
