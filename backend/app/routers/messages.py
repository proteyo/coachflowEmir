"""
Messages API.

Endpoints:
GET  /messages                    — conversation between current_user and ?partner_id=
POST /messages                    — send message
POST /messages/read-conversation  — mark all incoming messages from partner as read
POST /messages/{id}/read          — mark one message as read
GET  /messages/unread-count       — unread messages count for current user

Rules:
- Client can use messages normally.
- Coach can read/send/mark messages only with active subscription.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, select, update
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


async def _ensure_user_exists(user_id: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


async def _get_conversation_messages(
    current_user_id: str,
    partner_id: str,
    db: AsyncSession,
) -> list[Message]:
    """
    Returns all messages between current user and partner ordered by creation time.
    """
    result = await db.execute(
        select(Message)
        .where(
            or_(
                and_(
                    Message.sender_id == current_user_id,
                    Message.receiver_id == partner_id,
                ),
                and_(
                    Message.sender_id == partner_id,
                    Message.receiver_id == current_user_id,
                ),
            )
        )
        .order_by(Message.created_at.asc())
    )

    return list(result.scalars().all())


async def _mark_conversation_as_read(
    current_user_id: str,
    partner_id: str,
    db: AsyncSession,
    *,
    commit: bool = True,
) -> int:
    """
    Marks all unread messages that were sent by partner to current user.

    Example:
    - Client sends message to coach.
    - Coach opens chat OR sends a reply.
    - Client's messages become read=True.
    - When client polls the chat, he sees two check marks and "прочитано".
    """

    count_result = await db.execute(
        select(func.count(Message.id)).where(
            and_(
                Message.sender_id == partner_id,
                Message.receiver_id == current_user_id,
                Message.read == False,  # noqa: E712
            )
        )
    )

    unread_count = int(count_result.scalar() or 0)

    if unread_count == 0:
        return 0

    await db.execute(
        update(Message)
        .where(
            and_(
                Message.sender_id == partner_id,
                Message.receiver_id == current_user_id,
                Message.read == False,  # noqa: E712
            )
        )
        .values(read=True)
    )

    if commit:
        await db.commit()

    return unread_count


@router.get("", response_model=list[MessageOut])
async def list_messages(
    partner_id: str | None = Query(
        default=None,
        description="Conversation partner id. If not provided, returns all current user's messages.",
    ),
    mark_as_read: bool = Query(
        default=True,
        description="If true and partner_id is provided, marks partner messages as read.",
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_coach_subscription_if_needed(current_user, db)

    if partner_id:
        await _ensure_user_exists(partner_id, db)

        if partner_id == current_user.id:
            raise HTTPException(
                status_code=400,
                detail="You cannot open conversation with yourself",
            )

        if mark_as_read:
            await _mark_conversation_as_read(
                current_user_id=current_user.id,
                partner_id=partner_id,
                db=db,
                commit=True,
            )

        messages = await _get_conversation_messages(
            current_user_id=current_user.id,
            partner_id=partner_id,
            db=db,
        )

        return [message_out(message) for message in messages]

    result = await db.execute(
        select(Message)
        .where(
            or_(
                Message.sender_id == current_user.id,
                Message.receiver_id == current_user.id,
            )
        )
        .order_by(Message.created_at.asc())
    )

    messages = list(result.scalars().all())

    return [message_out(message) for message in messages]


@router.post("", response_model=MessageOut, status_code=201)
async def send_message(
    data: MessageIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_coach_subscription_if_needed(current_user, db)

    receiver = await _ensure_user_exists(data.receiver_id, db)

    if receiver.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot send a message to yourself",
        )

    message_type = data.message_type or "text"
    content = (data.content or "").strip()

    if message_type not in ("text", "voice"):
        raise HTTPException(status_code=400, detail="Invalid message type")

    if message_type == "text" and not content:
        raise HTTPException(status_code=400, detail="Message content is required")

    if message_type == "voice" and not data.voice_url:
        raise HTTPException(status_code=400, detail="Voice URL is required")

    # ВАЖНО ДЛЯ ДВУХ ГАЛОЧЕК:
    # Если пользователь пишет ответ в открытом чате, это означает,
    # что он уже увидел входящие сообщения от собеседника.
    # Поэтому перед созданием нового сообщения помечаем все входящие
    # сообщения от receiver как прочитанные.
    await _mark_conversation_as_read(
        current_user_id=current_user.id,
        partner_id=receiver.id,
        db=db,
        commit=False,
    )

    message = Message(
        id=f"msg_{uuid.uuid4().hex[:12]}",
        sender_id=current_user.id,
        receiver_id=receiver.id,
        content=content or "Voice message",
        message_type=message_type,
        voice_url=data.voice_url,
        voice_duration_ms=data.voice_duration_ms,
        read=False,
    )

    db.add(message)

    await db.commit()
    await db.refresh(message)

    return message_out(message)


@router.post("/read-conversation")
async def mark_conversation_read(
    partner_id: str = Query(
        ...,
        description="The user whose messages should be marked as read.",
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_coach_subscription_if_needed(current_user, db)

    await _ensure_user_exists(partner_id, db)

    if partner_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot mark conversation with yourself as read",
        )

    read_count = await _mark_conversation_as_read(
        current_user_id=current_user.id,
        partner_id=partner_id,
        db=db,
        commit=True,
    )

    messages = await _get_conversation_messages(
        current_user_id=current_user.id,
        partner_id=partner_id,
        db=db,
    )

    return {
        "ok": True,
        "readCount": read_count,
        "messages": [message_out(message) for message in messages],
    }


@router.post("/{message_id}/read", response_model=MessageOut)
async def mark_read(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_coach_subscription_if_needed(current_user, db)

    result = await db.execute(select(Message).where(Message.id == message_id))
    message = result.scalar_one_or_none()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if not message.read:
        message.read = True
        db.add(message)

        await db.commit()
        await db.refresh(message)

    return message_out(message)


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_coach_subscription_if_needed(current_user, db)

    result = await db.execute(
        select(func.count(Message.id)).where(
            and_(
                Message.receiver_id == current_user.id,
                Message.read == False,  # noqa: E712
            )
        )
    )

    return {"count": int(result.scalar() or 0)}