#!/usr/bin/env bash
#
# Бэкап базы. Вызывается ночью по расписанию и перед каждой миграцией.
#   ./backup.sh nightly
#   ./backup.sh pre-deploy
#
# Копия шифруется и кладётся на диск сервера (Beget). Это защита от неудачной
# миграции: откатиться можно за минуту, не дожидаясь поддержки хостинга.
#
# ВАЖНО, без иллюзий: копия рядом с продом не спасёт, если потеряется сам
# сервер или аккаунт. За этот сценарий отвечают автоматические бэкапы
# управляемой базы Beget — их надо хотя бы раз восстановить руками и убедиться,
# что они рабочие. Бэкап, который никто не восстанавливал, бэкапом не является.
#
# Если однажды появится S3 у ДРУГОГО провайдера — достаточно задать
# BACKUP_S3_BUCKET в .env, и копия начнёт уезжать ещё и туда. Это и будет
# полноценный внешний бэкап.
#
# Восстановление:
#   openssl enc -d -aes-256-cbc -pbkdf2 -pass "pass:$BACKUP_PASSPHRASE" \
#     -in bereg-pre-deploy-<штамп>.sql.gz.enc | gunzip | \
#     docker run --rm -i postgres:16-alpine psql "$DATABASE_URL"

set -euo pipefail

LABEL="${1:-manual}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"
set -a; source .env; set +a

: "${DATABASE_URL:?нужен DATABASE_URL}"
: "${BACKUP_PASSPHRASE:?нужен BACKUP_PASSPHRASE}"

BACKUP_DIR="${BACKUP_DIR:-$DIR/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="bereg-${LABEL}-${STAMP}.sql.gz.enc"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "[backup] дамп → $FILE"
# Шифруем на этой машине: на диск ложится то, что без пароля не прочесть.
# Пишем во временный каталог и переносим только целый файл — иначе оборванный
# дамп осядет рядом с настоящими и однажды его примут за рабочий.
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

mv "$TMP/$FILE" "$BACKUP_DIR/$FILE"
echo "[backup] на диске: $BACKUP_DIR/$FILE ($((SIZE / 1024)) КиБ)"

# Свободное место: когда диск кончится, бэкап начнёт молча обрываться.
AVAIL_MB=$(df -Pm "$BACKUP_DIR" | awk 'NR==2 {print $4}')
if [ "${AVAIL_MB:-0}" -lt 512 ]; then
  echo "[backup] ВНИМАНИЕ: на диске осталось ${AVAIL_MB} МиБ — освободите место"
fi

# Чистим копии старше KEEP_DAYS дней.
find "$BACKUP_DIR" -maxdepth 1 -name 'bereg-*.sql.gz.enc' -type f -mtime "+${KEEP_DAYS}" -delete 2>/dev/null || true

# Необязательная вторая копия у другого провайдера.
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  # Бакет задан, а клиента нет — это опечатка в .env, а не «ну и ладно».
  # Молча пропустить нельзя: тогда все решат, что внешняя копия есть.
  if ! command -v aws >/dev/null 2>&1; then
    echo "[backup] ОШИБКА: BACKUP_S3_BUCKET задан, но команды aws нет."
    echo "[backup] Локальная копия создана, ВНЕШНЕЙ НЕТ. Либо поставьте awscli,"
    echo "[backup] либо очистите BACKUP_S3_BUCKET в .env, если S3 не используется."
    exit 1
  fi
  echo "[backup] загрузка в S3"
  aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "$BACKUP_DIR/$FILE" "s3://$BACKUP_S3_BUCKET/$FILE"

  CUTOFF="$(date -u -d "${KEEP_DAYS} days ago" +%Y%m%d)"
  aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 ls "s3://$BACKUP_S3_BUCKET/" \
    | awk '{print $4}' | grep -E '^bereg-' | while read -r name; do
        stamp="$(echo "$name" | grep -oE '[0-9]{8}T' | head -1 | tr -d 'T')"
        [ -n "$stamp" ] && [ "$stamp" -lt "$CUTOFF" ] && \
          aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 rm "s3://$BACKUP_S3_BUCKET/$name"
      done || true
else
  echo "[backup] S3 не настроен: внешних копий нет, за катастрофы отвечают бэкапы базы Beget"
fi

echo "[backup] готово: $FILE"
