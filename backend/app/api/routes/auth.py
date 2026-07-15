from fastapi import APIRouter, HTTPException, status
from jose import JWTError
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.config import get_settings
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.core.telegram import InitDataError, validate_init_data
from app.models import User
from app.schemas.auth import RefreshRequest, TelegramAuthRequest, TokenPair, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/telegram", response_model=TokenPair)
async def login_telegram(payload: TelegramAuthRequest, db: DbSession) -> TokenPair:
    """Вход через Telegram Mini App. Валидируем initData на сервере, апсертим пользователя."""
    try:
        tg_user = validate_init_data(
            payload.init_data,
            bot_token=settings.telegram_bot_token,
            max_age_seconds=settings.initdata_max_age_seconds,
        )
    except InitDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid initData: {exc}"
        )

    result = await db.execute(select(User).where(User.telegram_id == tg_user.telegram_id))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            telegram_id=tg_user.telegram_id,
            username=tg_user.username,
            first_name=tg_user.first_name,
        )
        db.add(user)
    else:
        user.username = tg_user.username
        user.first_name = tg_user.first_name

    await db.commit()
    await db.refresh(user)

    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: DbSession) -> TokenPair:
    try:
        user_id = decode_token(payload.refresh_token, expected_type="refresh")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> User:
    return user
