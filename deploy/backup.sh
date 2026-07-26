#!/usr/bin/env bash
#
# Бэкап базы в S3. Вызывается ночью по расписанию и перед каждой миграцией.
#   ./backup.sh nightly
#   ./backup.sh pre-deploy
#
# Копии кладём к ДРУГОМУ провайдеру: если скомпрометируют аккаунт хостинга,
# бэкапы внутри того же аккаунта уйдут вместе с продом.

set -euo pipefail

LABEL="${1:-manual}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"
set -a; source .env; set +a

: "${DATABASE_URL:?нужен DATABASE_URL}"
: "${BACKUP_S3_BUCKET:?нужен BACKUP_S3_BUCKET}"
: "${BACKUP_PASSPHRASE:?нужен BACKUP_PASSPHRASE}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="bereg-${LABEL}-${STAMP}.sql.gz.enc"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "[backup] дамп → $FILE"
# Шифруем на этой машине: в хранилище уезжает то, что без пароля не прочесть.
docker run --rm postgres:16-alpine \
  pg_dump --no-owner --no-privileges "$DATABASE_URL" \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "pass:${BACKUP_PASSPHRASE}" \
  > "$TMP/$FILE"

SIZE=$(stat -c%s "$TMP/$FILE")
# Пустой дамп — это провал, а не «бэкап нулевого размера».
if [ "$SIZE" -lt 1024 ]; then
  echo "[backup] дамп подозрительно мал ($SIZE Б) — прерываю"
  exit 1
fi

echo "[backup] загрузка в S3 ($((SIZE / 1024)) КиБ)"
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "$TMP/$FILE" "s3://$BACKUP_S3_BUCKET/$FILE"

# Чистим старше 30 дней
CUTOFF="$(date -u -d '30 days ago' +%Y%m%d)"
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 ls "s3://$BACKUP_S3_BUCKET/" \
  | awk '{print $4}' | grep -E '^bereg-' | while read -r name; do
      stamp="$(echo "$name" | grep -oE '[0-9]{8}T' | head -1 | tr -d 'T')"
      [ -n "$stamp" ] && [ "$stamp" -lt "$CUTOFF" ] && \
        aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 rm "s3://$BACKUP_S3_BUCKET/$name"
    done || true

echo "[backup] готово: $FILE"
