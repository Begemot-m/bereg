#!/usr/bin/env bash
#
# Разовая настройка бэкапов. Запускать на сервере ТАМ ЖЕ, где лежат deploy.sh,
# backup.sh и .env — скрипт работает с тем же .env, что и они:
#   cd /opt/bereg && ./setup-backup.sh
# Если файлы разложены клоном репозитория, путь будет ./deploy/setup-backup.sh.
#
# Скрипт идемпотентен: уже заданные значения не трогает, дописывает только
# недостающие. Повторный запуск безопасен и ничего не перезатирает.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"
ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Нет $DIR/$ENV_FILE — сначала создайте его из .env.example"
  exit 1
fi

value_of() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2-; }

# Значение считается заданным, только если оно непустое: в .env.example
# ключи лежат пустыми, и «строка есть» ещё ничего не значит.
ensure() {
  local key="$1" val="$2" cur
  cur="$(value_of "$key")"
  if [ -n "$cur" ]; then
    echo "  = $key уже задан, не трогаю"
    return
  fi
  if grep -qE "^$key=" "$ENV_FILE"; then
    sed -i "s|^$key=.*|$key=$val|" "$ENV_FILE"
  else
    echo "$key=$val" >> "$ENV_FILE"
  fi
  echo "  + $key добавлен"
}

echo "[setup] правлю $DIR/$ENV_FILE"
ensure BACKUP_PASSPHRASE "$(openssl rand -base64 32)"
ensure BACKUP_DIR "$DIR/backups"
ensure BACKUP_KEEP_DAYS "30"

chmod 600 "$ENV_FILE"
mkdir -p "$(value_of BACKUP_DIR)"

echo
echo "════════════════════════════════════════════════════════════"
echo " СОХРАНИТЕ ЭТОТ ПАРОЛЬ ВНЕ СЕРВЕРА (менеджер паролей, не в git):"
echo
echo "   BACKUP_PASSPHRASE=$(value_of BACKUP_PASSPHRASE)"
echo
echo " Им зашифрованы копии базы. Потеряете пароль вместе с сервером —"
echo " расшифровать дампы будет нечем, и они превратятся в мусор."
echo "════════════════════════════════════════════════════════════"
echo
echo "Дальше: ./deploy/backup.sh manual — пробный бэкап, посмотрите глазами."
