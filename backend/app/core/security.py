from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()


def _create_token(subject: str, ttl: timedelta, token_type: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + ttl,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: int) -> str:
    return _create_token(
        str(user_id), timedelta(minutes=settings.access_token_ttl_minutes), "access"
    )


def create_refresh_token(user_id: int) -> str:
    return _create_token(
        str(user_id), timedelta(days=settings.refresh_token_ttl_days), "refresh"
    )


def decode_token(token: str, expected_type: str) -> int:
    """Возвращает user_id или бросает JWTError."""
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != expected_type:
        raise JWTError("wrong token type")
    return int(payload["sub"])
