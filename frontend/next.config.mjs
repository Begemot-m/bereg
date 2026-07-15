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
