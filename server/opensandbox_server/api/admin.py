from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from opensandbox_server.db import get_db
from opensandbox_server.models.admin import SandboxNote, SandboxTag

router = APIRouter(prefix="/admin", tags=["Admin"])


class NoteUpsertRequest(BaseModel):
    note: str = Field(default="")


class TagCreateRequest(BaseModel):
    tag: str = Field(min_length=1, max_length=100)


@router.get("/sandboxes/{sandbox_id}/note")
def get_note(sandbox_id: str, db: Session = Depends(get_db)):
    row = db.query(SandboxNote).filter(SandboxNote.sandbox_id == sandbox_id).first()
    return {
        "sandboxId": sandbox_id,
        "note": row.note if row else "",
    }


@router.put("/sandboxes/{sandbox_id}/note")
def upsert_note(sandbox_id: str, request: NoteUpsertRequest, db: Session = Depends(get_db)):
    row = db.query(SandboxNote).filter(SandboxNote.sandbox_id == sandbox_id).first()

    if row is None:
        row = SandboxNote(sandbox_id=sandbox_id, note=request.note)
        db.add(row)
    else:
        row.note = request.note

    db.commit()
    db.refresh(row)

    return {
        "sandboxId": sandbox_id,
        "note": row.note,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/sandboxes/{sandbox_id}/tags")
def list_tags(sandbox_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(SandboxTag)
        .filter(SandboxTag.sandbox_id == sandbox_id)
        .order_by(SandboxTag.id.desc())
        .all()
    )
    return {
        "sandboxId": sandbox_id,
        "items": [{"id": row.id, "tag": row.tag} for row in rows],
    }


@router.post("/sandboxes/{sandbox_id}/tags")
def create_tag(sandbox_id: str, request: TagCreateRequest, db: Session = Depends(get_db)):
    tag_value = request.tag.strip()
    if not tag_value:
        raise HTTPException(status_code=400, detail="Tag cannot be empty")

    row = SandboxTag(sandbox_id=sandbox_id, tag=tag_value)
    db.add(row)
    db.commit()
    db.refresh(row)

    return {
        "id": row.id,
        "sandboxId": sandbox_id,
        "tag": row.tag,
    }


@router.delete("/tags/{tag_id}")
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    row = db.query(SandboxTag).filter(SandboxTag.id == tag_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Tag not found")

    db.delete(row)
    db.commit()
    return {"ok": True}
