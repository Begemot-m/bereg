"""Валидация Telegram Mini App initData.

Алгоритм из документации Telegram:
  secret_key   = HMAC_SHA256(key="WebAppData", msg=bot_token)
  computed_hash = HMAC_SHA256(key=secret_key, msg=data_check_string)
где data_check_string — все поля кроме `hash`, отсортированные по ключу
и склеенные как "key=value" через '\n'.

Никогда не доверяем данным клиента: user берём ТОЛЬКО из проверенного initData.
"""

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from urllib.parse import parse_qsl


class InitDataError(Exception):
    pass


@dataclass
class TelegramUser:
    telegram_id: int
    username: str | None
    first_name: str | None


def validate_init_data(init_data: str, bot_token: str, max_age_seconds: int) -> TelegramUser:
    if not init_data:
        raise InitDataError("empty initData")

    pairs = dict(parse_qsl(init_data, keep_blank_values=True))

    received_hash = pairs.pop("hash", None)
    if not received_hash:
        raise InitDataError("missing hash")

    data_check_string = "\n".join(f"{k}={pairs[k]}" for k in sorted(pairs))

    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        raise InitDataError("bad signature")

    auth_date = pairs.get("auth_date")
    if auth_date is None:
        raise InitDataError("missing auth_date")
    if time.time() - int(auth_date) > max_age_seconds:
        raise InitDataError("initData expired")

    user_raw = pairs.get("user")
    if not user_raw:
        raise InitDataError("missing user")
    user = json.loads(user_raw)

    return TelegramUser(
        telegram_id=int(user["id"]),
        username=user.get("username"),
        first_name=user.get("first_name"),
    )
