# syntax=docker/dockerfile:1

# ── Зависимости ────────────────────────────────────────────────────────────
# Отдельный слой: пересобирается только когда меняется lock-файл,
# а не на каждую правку кода.
FROM oven/bun:1.3-slim AS deps
WORKDIR /app
COPY package.json bun.lock* ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

# ── Сборка ─────────────────────────────────────────────────────────────────
FROM oven/bun:1.3-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL нужен prisma generate только как строка — к базе он не ходит.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN bunx prisma generate && bun run build \
 && bun build scripts/bot.ts --target=node --outfile dist/bot.js --external @prisma/client

# ── Рантайм ────────────────────────────────────────────────────────────────
# node, а не bun: standalone-сборка Next рассчитана на Node и это самый
# проверенный путь. Образ ~150 МБ.
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# openssl нужен Prisma, curl — health-чеку в compose
RUN apt-get update && apt-get install -y --no-install-recommends openssl curl \
 && rm -rf /var/lib/apt/lists/*

# Не работаем под root: если приложение скомпрометируют, у процесса не будет
# прав на систему.
RUN useradd --system --uid 1001 --create-home app

COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/dist ./dist
# Схема и миграции — чтобы контейнер мог сам применить migrate deploy
COPY --from=build --chown=app:app /app/prisma ./prisma
# Prisma CLI загружает транзитивные пакеты во время migrate deploy. Копирование
# только каталогов prisma/@prisma оставляло CLI без зависимостей (например
# `effect`) и первая миграция падала до обращения к базе.
COPY --from=build --chown=app:app /app/node_modules ./node_modules

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
