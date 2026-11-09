from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user
from app.core.rate_limit import consume_limit
from app.db.database import get_db
from app.models.content_report import ContentReport
from app.models.user import User
from app.models.message import Message
from app.models.social import ChatMember, GroupMessage, Story

router = APIRouter(prefix="/safety", tags=["Safety"])


class ReportIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_type: Literal["profile", "story", "message", "group_message"]
    target_id: str = Field(min_length=1, max_length=160)
    reason: Literal["spam", "abuse", "unsafe", "other"]
    note: str = Field(default="", max_length=1000)


@router.post("/reports", status_code=202)
async def report(data: ReportIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Safety actions remain available when a subscription has ended.
    await consume_limit(db, "content-report", user.id, 10, 3600)
    if data.target_type == "profile":
        target = (await db.execute(select(User).where(User.id == data.target_id))).scalar_one_or_none()
        allowed = target is not None and target.id != user.id and target.role in ("coach", "client")
    elif data.target_type == "story":
        from app.routers.social import can_view_story
        target = (await db.execute(select(Story).where(Story.id == data.target_id))).scalar_one_or_none()
        allowed = target is not None and target.user_id != user.id and await can_view_story(target, user, db)
    elif data.target_type == "message":
        target = (await db.execute(select(Message).where(Message.id == data.target_id))).scalar_one_or_none()
        allowed = target is not None and target.receiver_id == user.id and target.sender_id != user.id and not target.deleted_for_everyone
    else:
        target = (await db.execute(select(GroupMessage).where(GroupMessage.id == data.target_id))).scalar_one_or_none()
        membership = (await db.execute(select(ChatMember.user_id).where(ChatMember.group_id == target.group_id, ChatMember.user_id == user.id))).scalar_one_or_none() if target else None
        allowed = bool(target and membership and target.sender_id != user.id)
    if not allowed:
        raise HTTPException(404, "Content unavailable")
    # Lock the reporter row to serialize duplicate reports without racing a unique constraint.
    await db.execute(select(User.id).where(User.id == user.id).with_for_update())
    existing = (await db.execute(select(ContentReport).where(ContentReport.reporter_id == user.id, ContentReport.target_type == data.target_type, ContentReport.target_id == data.target_id))).scalar_one_or_none()
    if existing:
        return {"id": existing.id}
    item = ContentReport(reporter_id=user.id, target_type=data.target_type, target_id=data.target_id, reason=data.reason, note=data.note.strip())
    db.add(item)
    await db.commit()
    return {"id": item.id}
