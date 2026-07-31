# Методика

Платформа для психологов и клиентов: Telegram Mini App и обычная веб-версия на
одном коде. Психолог ведёт клиентов и расписание, клиент записывается на сессии и
работает с материалами между встречами.

## Стек

- Next.js 15, App Router, TypeScript;
- Prisma и PostgreSQL;
- Tailwind CSS v4, Motion, Phosphor Icons;
- Bun;
- Docker для продакшена и локальной базы.

Рабочее приложение целиком находится в `frontend/`. Серверные API-роуты лежат в
`frontend/src/app/api`, Prisma-схема — в `frontend/prisma`.

## Быстрый старт

Демо работает без базы и бэкенда:

```bash
cd frontend
bun install
bun run demo
```

Полный локальный режим:

```bash
docker compose up -d postgres
cd frontend
bun install
bun run db:migrate
bun run dev
```

Перед коммитом:

```bash
cd frontend
bun run check
```

## Навигация по проекту

- `AGENTS.md` — единая точка входа для Claude Code и Codex;
- `HANDOFF.md` — состояние продукта и незавершённые задачи;
- `PERFORMANCE-HANDOFF.md` — текущая работа по производительности;
- `FEATURE-FLOW.md` — правила добавления фич с данными;
- `DESIGN.md` — дизайн-система;
- `BACKEND.md` — Prisma, API и база;
- `RELEASE.md` и `UPDATES.md` — деплой и обновления;
- `deploy/` — продакшен-конфигурация, выкладка и бэкапы.

Корневой `docker-compose.yml` поднимает только локальный PostgreSQL.
`deploy/docker-compose.yml` используется на сервере.

## Работа через Claude Code и Codex

Git — единственный источник правды между компьютерами и агентами. В начале
каждой задачи выполняйте `git pull --ff-only` и `git status`. После проверки
изменения нужно закоммитить и отправить в `master`. Подробный порядок описан в
`AGENTS.md`.
