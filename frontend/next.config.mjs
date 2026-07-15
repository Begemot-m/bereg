import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Корень трейсинга — этот проект (в домашней папке есть посторонний package-lock.json).
  outputFileTracingRoot: here,
};

export default nextConfig;
