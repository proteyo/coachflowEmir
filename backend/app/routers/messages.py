"""
GET  /messages              — conversation between current_user and ?partner_id=
POST /messages              — send message
POST /messages/{id}/read    — mark as read

Rules:
- Client can use messages normally.
- Coach can read/send/mark messages only with active subscription.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_active_coach_subscription
from app.db.database import get_db
from app.models.message import Message
from app.models.user import User
from app.schemas.other import MessageIn, MessageOut
from app.services.mappers import message_out

router = APIRouter(prefix="/messages", tags=["Messages"])


async def _ensure_coach_subscription_if_needed(
    current_user: User,
    db: AsyncSession,
) -> None:
    """
    If current user is coach, require active subscription.
    Clients are not checked here because subscription belongs to coach accounts.
    """
    if current_user.role == "coach":
        await require_active_coach_subscription(current_user, db)


@router.get("", response_model=list[MessageOut])
async def list_messages(
    partner_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_coach_subscription_if_needed(current_user, db)

    if partner_id:
        query = select(Message).where(
            or_(
                and_(
                    Message.sender_id == current_user.id,
                    Message.receiver_id == partner_id,
                ),
                and_(
                    Message.sender_id == partner_id,
                    Message.receiver_id == current_user.id,
                ),
            )
        )
    else:
        query = select(Message).where(
            or_(
                Message.sender_id == current_user.id,
                Message.receiver_id == current_user.id,
            )
        )

    query = query.order_by(Message.created_at.asc())

    res = await db.execute(query)

    return [message_out(message) for message in res.scalars().all()]


@router.post("", response_model=MessageOut, status_code=201)
async def send_message(
    data: MessageIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_coach_subscription_if_needed(current_user, db)

    res = await db.execute(select(User).where(User.id == data.receiver_id))
    receiver = res.scalar_one_or_none()

    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    message = Message(
        id=f"msg_{uuid.uuid4().hex[:12]}",
        sender_id=current_user.id,
        receiver_id=data.receiver_id,
        content=data.content,
        message_type=data.message_type,
        voice_url=data.voice_url,
        voice_duration_ms=data.voice_duration_ms,
        read=False,
    )

    db.add(message)

    await db.commit()
    await db.refresh(message)

    return message_out(message)


@router.post("/{message_id}/read", response_model=MessageOut)
async def mark_read(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_coach_subscription_if_needed(current_user, db)

    res = await db.execute(select(Message).where(Message.id == message_id))
    message = res.scalar_one_or_none()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    message.read = True

    db.add(message)

    await db.commit()
    await db.refresh(message)

    return message_out(message)