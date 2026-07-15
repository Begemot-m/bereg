from pydantic import BaseModel


class TelegramAuthRequest(BaseModel):
    # Сырой initData из window.Telegram.WebApp.initData
    init_data: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    telegram_id: int
    username: str | None
    first_name: str | None
    role: str

    model_config = {"from_attributes": True}
