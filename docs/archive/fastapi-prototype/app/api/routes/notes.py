from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models import Note
from app.schemas.note import NoteCreate, NoteOut, NoteUpdate

router = APIRouter(prefix="/notes", tags=["notes"])


async def _get_owned_note(note_id: int, user_id: int, db: DbSession) -> Note:
    note = await db.get(Note, note_id)
    # Проверка владения ресурсом — защита от IDOR: чужую заметку не отдаём.
    if note is None or note.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


@router.get("", response_model=list[NoteOut])
async def list_notes(user: CurrentUser, db: DbSession) -> list[Note]:
    result = await db.execute(
        select(Note).where(Note.user_id == user.id).order_by(Note.updated_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
async def create_note(payload: NoteCreate, user: CurrentUser, db: DbSession) -> Note:
    note = Note(user_id=user.id, title=payload.title, body=payload.body)
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.patch("/{note_id}", response_model=NoteOut)
async def update_note(
    note_id: int, payload: NoteUpdate, user: CurrentUser, db: DbSession
) -> Note:
    note = await _get_owned_note(note_id, user.id, db)
    if payload.title is not None:
        note.title = payload.title
    if payload.body is not None:
        note.body = payload.body
    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(note_id: int, user: CurrentUser, db: DbSession) -> None:
    note = await _get_owned_note(note_id, user.id, db)
    await db.delete(note)
    await db.commit()
