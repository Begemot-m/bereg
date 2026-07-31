from datetime import datetime

from pydantic import BaseModel, Field


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = ""


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = None


class NoteOut(BaseModel):
    id: int
    title: str
    body: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
