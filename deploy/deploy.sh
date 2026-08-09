#!/usr/bin/env bash
#
# Выкатка новой версии. Запускается на сервере из /opt/bereg.
#   ./deploy.sh ghcr.io/begemot-m/bereg:sha-abc1234
#
# Порядок важен: бэкап → миграции → запуск → проверка. Если проверка не
# прошла, откатываемся на образ, который работал до этого.

set -euo pipefail

IMAGE="${1:?Укажите образ: ./deploy.sh ghcr.io/…/bereg:tag}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PREV_FILE=".previous-image"
CURRENT="$(grep -E '^APP_IMAGE=' .env 2>/dev/null | cut -d= -f2- || true)"

log() { echo "[$(date +%H:%M:%S)] $*"; }

log "Тянем образ $IMAGE"
docker pull "$IMAGE"

# 1. Бэкап именно сейчас, а не «есть ночной». Миграция может быть последним,
#    что видела эта версия базы.
log "Бэкап базы перед миграцией"
./backup.sh pre-deploy || { log "БЭКАП НЕ СДЕЛАН — выкатка остановлена"; exit 1; }

# 1.5. Каталог для документов верификации. Создаём сами: если его сделает
#      docker при монтировании, владельцем станет root, а приложение в
#      контейнере работает от uid 1001 и не сможет туда писать.
mkdir -p uploads
chown -R 1001:1001 uploads 2>/dev/null || sudo chown -R 1001:1001 uploads
chmod 700 uploads

# 2. Миграции отдельным одноразовым контейнером: если они упадут, текущая
#    версия приложения продолжает работать.
log "Применяем миграции"
docker run --rm --env-file .env "$IMAGE" \
  node_modules/prisma/build/index.js migrate deploy

# 3. Запоминаем, куда откатываться, и поднимаем новую версию.
[ -n "$CURRENT" ] && echo "$CURRENT" > "$PREV_FILE"
log "Запускаем $IMAGE"
sed -i.bak "s|^APP_IMAGE=.*|APP_IMAGE=$IMAGE|" .env || echo "APP_IMAGE=$IMAGE" >> .env
docker compose up -d app caddy bot

# 4. Проверка живости: не «контейнер поднялся», а «отвечает и видит базу».
log "Проверяем health"
for i in $(seq 1 30); do
  if docker compose exec -T app curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    log "Готово: $IMAGE"
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done

# 5. Не ответил — возвращаем предыдущий образ.
log "HEALTH НЕ ПРОШЁЛ — откатываемся"
if [ -s "$PREV_FILE" ]; then
  PREV="$(cat "$PREV_FILE")"
  sed -i.bak "s|^APP_IMAGE=.*|APP_IMAGE=$PREV|" .env
  docker compose up -d app bot
  log "Откат на $PREV выполнен"
else
  log "Предыдущий образ неизвестен — откат вручную"
fi
exit 1
