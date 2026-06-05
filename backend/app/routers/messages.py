"""
Messages API.

Endpoints:
GET       /messages                         — conversation between current_user and ?partner_id=
POST      /messages                         — send message
POST      /messages/read-conversation       — mark all incoming messages from partner as read
POST      /messages/{id}/read               — mark one message as read
PATCH     /messages/{id}                    — edit own text message
POST      /messages/{id}/reaction           — toggle reaction
POST      /messages/{id}/pin                — pin/unpin message
POST      /messages/{id}/forward            — forward message
DELETE    /messages/{id}?mode=me|everyone   — delete message
POST      /messages/{id}/delete             — delete message fallback
GET       /messages/unread-count            — unread messages count for current user
WebSocket /messages/ws                      — realtime chat socket

Rules:
- Client can use messages normally.
- Coach can read/send/mark/delete messages only with active subscription.
- WebSocket uses token query param:
  /api/v1/messages/ws?partner_id=USER_ID&token=ACCESS_TOKEN
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import (
    get_current_user,
    require_active_coach_subscription,
    update_user_last_seen,
)
from app.core.security import decode_token
from app.db.database import get_db
from app.models.message import Message
from app.models.user import User
from app.schemas.other import (
    MessageForwardIn,
    MessageIn,
    MessageOut,
    MessagePinIn,
    MessageReactionIn,
    MessageUpdateIn,
)
from app.services.mappers import message_out

router = APIRouter(prefix="/messages", tags=["Messages"])


ALLOWED_MESSAGE_TYPES = {"text", "voice", "image", "video"}
DELETE_MODES = {"me", "everyone"}


class WebSocketConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()

        if user_id not in self.active_connections:
            self.active_connections[user_id] = []

        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        connections = self.active_connections.get(user_id)

        if not connections:
            return

        if websocket in connections:
            connections.remove(websocket)

        if not connections:
            self.active_connections.pop(user_id, None)

    async def send_to_user(self, user_id: str | None, payload: dict[str, Any]) -> None:
        if not user_id:
            return

        connections = self.active_connections.get(user_id, [])

        if not connections:
            return

        dead_connections: list[WebSocket] = []

        for websocket in connections:
            try:
                await websocket.send_json(payload)
            except Exception:
                dead_connections.append(websocket)

        for websocket in dead_connections:
            self.disconnect(user_id, websocket)

    async def send_to_users(self, user_ids: list[str | None], payload: dict[str, Any]) -> None:
        unique_user_ids = list(dict.fromkeys([user_id for user_id in user_ids if user_id]))

        for user_id in unique_user_ids:
            await self.send_to_user(user_id, payload)


ws_manager = WebSocketConnectionManager()


def now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def serialize_message(message: Message) -> dict[str, Any]:
    return message_out(message).model_dump()


def serialize_messages(messages: list[Message]) -> list[dict[str, Any]]:
    return [serialize_message(message) for message in messages]


def active_message_filter() -> Any:
    return and_(
        Message.deleted_at.is_(None),
        Message.deleted_for_everyone == False,  # noqa: E712
    )


def visible_for_user_filter(user_id: str) -> Any:
    """
    Message visibility rule:
    - deleted_for_everyone hides from everyone;
    - deleted_for_sender hides only from sender;
    - deleted_for_receiver hides only from receiver.
    """

    return and_(
        active_message_filter(),
        or_(
            and_(
                Message.sender_id == user_id,
                Message.deleted_for_sender == False,  # noqa: E712
            ),
            and_(
                Message.receiver_id == user_id,
                Message.deleted_for_receiver == False,  # noqa: E712
            ),
        ),
    )


async def _ensure_coach_subscription_if_needed(
    current_user: User,
    db: AsyncSession,
) -> None:
    if current_user.role == "coach":
        await require_active_coach_subscription(current_user, db)


async def _ensure_user_exists(user_id: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


async def _get_user_by_token(token: str, db: AsyncSession) -> User | None:
    cleaned_token = (token or "").strip()

    if not cleaned_token:
        return None

    user_id = decode_token(
        token=cleaned_token,
        token_type="access",
    )

    if not user_id:
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    return user


async def _get_message_by_id(
    message_id: str,
    db: AsyncSession,
    *,
    include_deleted: bool = False,
) -> Message:
    filters = [Message.id == message_id]

    if not include_deleted:
        filters.append(active_message_filter())

    result = await db.execute(
        select(Message)
        .options(selectinload(Message.reply_to))
        .where(and_(*filters))
    )

    message = result.scalar_one_or_none()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    return message


def _ensure_message_participant(message: Message, current_user: User) -> None:
    if message.sender_id != current_user.id and message.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")


def _get_partner_id(message: Message, current_user_id: str) -> str | None:
    if message.sender_id == current_user_id:
        return message.receiver_id

    return message.sender_id


async def _get_conversation_messages(
    current_user_id: str,
    partner_id: str,
    db: AsyncSession,
) -> list[Message]:
    result = await db.execute(
        select(Message)
        .options(selectinload(Message.reply_to))
        .where(
            and_(
                visible_for_user_filter(current_user_id),
                or_(
                    and_(
                        Message.sender_id == current_user_id,
                        Message.receiver_id == partner_id,
                    ),
                    and_(
                        Message.sender_id == partner_id,
                        Message.receiver_id == current_user_id,
                    ),
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
    count_result = await db.execute(
        select(func.count(Message.id)).where(
            and_(
                active_message_filter(),
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
                active_message_filter(),
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


async def _broadcast_conversation_snapshot(
    current_user_id: str,
    partner_id: str | None,
    db: AsyncSession,
    event_type: str = "conversation_updated",
) -> None:
    if not partner_id:
        return

    current_messages = await _get_conversation_messages(
        current_user_id=current_user_id,
        partner_id=partner_id,
        db=db,
    )

    await ws_manager.send_to_user(
        current_user_id,
        {
            "type": event_type,
            "partnerId": partner_id,
            "partner_id": partner_id,
            "messages": serialize_messages(current_messages),
        },
    )

    partner_messages = await _get_conversation_messages(
        current_user_id=partner_id,
        partner_id=current_user_id,
        db=db,
    )

    await ws_manager.send_to_user(
        partner_id,
        {
            "type": event_type,
            "partnerId": current_user_id,
            "partner_id": current_user_id,
            "messages": serialize_messages(partner_messages),
        },
    )


async def _find_existing_by_client_temp_id(
    client_temp_id: str | None,
    current_user_id: str,
    receiver_id: str,
    db: AsyncSession,
) -> Message | None:
    if not client_temp_id:
        return None

    result = await db.execute(
        select(Message)
        .options(selectinload(Message.reply_to))
        .where(
            and_(
                Message.client_temp_id == client_temp_id,
                Message.sender_id == current_user_id,
                Message.receiver_id == receiver_id,
                active_message_filter(),
            )
        )
    )

    return result.scalar_one_or_none()


async def _validate_reply_to(
    reply_to_id: str | None,
    current_user_id: str,
    receiver_id: str,
    db: AsyncSession,
) -> None:
    if not reply_to_id:
        return

    result = await db.execute(
        select(Message.id).where(
            and_(
                Message.id == reply_to_id,
                active_message_filter(),
                or_(
                    and_(
                        Message.sender_id == current_user_id,
                        Message.receiver_id == receiver_id,
                    ),
                    and_(
                        Message.sender_id == receiver_id,
                        Message.receiver_id == current_user_id,
                    ),
                ),
            )
        )
    )

    message_id = result.scalar_one_or_none()

    if not message_id:
        raise HTTPException(status_code=400, detail="Reply message not found")


async def _create_message(
    *,
    data: MessageIn,
    current_user: User,
    receiver: User,
    db: AsyncSession,
) -> Message:
    existing = await _find_existing_by_client_temp_id(
        client_temp_id=data.client_temp_id,
        current_user_id=current_user.id,
        receiver_id=receiver.id,
        db=db,
    )

    if existing:
        return existing

    message_type = data.message_type or "text"
    content = (data.content or "").strip()

    if message_type not in ALLOWED_MESSAGE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid message type")

    if message_type == "text" and not content:
        raise HTTPException(status_code=400, detail="Message content is required")

    if message_type == "voice" and not data.voice_url:
        raise HTTPException(status_code=400, detail="Voice URL is required")

    if message_type == "image" and not data.media_url:
        raise HTTPException(status_code=400, detail="Image media URL is required")

    if message_type == "video" and not data.media_url:
        raise HTTPException(status_code=400, detail="Video media URL is required")

    if message_type == "image" and data.media_type and data.media_type != "image":
        raise HTTPException(status_code=400, detail="Invalid media type for image message")

    if message_type == "video" and data.media_type and data.media_type != "video":
        raise HTTPException(status_code=400, detail="Invalid media type for video message")

    await _validate_reply_to(
        reply_to_id=data.reply_to_id,
        current_user_id=current_user.id,
        receiver_id=receiver.id,
        db=db,
    )

    await _mark_conversation_as_read(
        current_user_id=current_user.id,
        partner_id=receiver.id,
        db=db,
        commit=False,
    )

    fallback_content = {
        "voice": "Voice message",
        "image": "Photo",
        "video": "Video",
    }.get(message_type, "")

    message = Message(
        id=f"msg_{uuid.uuid4().hex[:12]}",
        client_temp_id=data.client_temp_id,
        sender_id=current_user.id,
        receiver_id=receiver.id,
        reply_to_id=data.reply_to_id,
        content=content or fallback_content,
        message_type=message_type,
        voice_url=data.voice_url,
        voice_duration_ms=data.voice_duration_ms,
        media_url=data.media_url,
        media_type=data.media_type
        or ("image" if message_type == "image" else "video" if message_type == "video" else None),
        media_thumbnail_url=data.media_thumbnail_url,
        reactions={},
        read=False,
        pinned=False,
    )

    db.add(message)

    await db.commit()

    refreshed = await _get_message_by_id(message.id, db)

    return refreshed


async def _delete_message_by_id(
    *,
    message_id: str,
    current_user: User,
    db: AsyncSession,
    mode: str = "everyone",
) -> Message:
    if mode not in DELETE_MODES:
        raise HTTPException(status_code=400, detail="Invalid delete mode")

    message = await _get_message_by_id(message_id, db)
    _ensure_message_participant(message, current_user)

    if mode == "me":
        if message.sender_id == current_user.id:
            message.deleted_for_sender = True
        else:
            message.deleted_for_receiver = True
    else:
        if message.sender_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Only sender can delete message for everyone",
            )

        message.deleted_for_everyone = True
        message.deleted_at = now_utc()
        message.content = ""
        message.voice_url = None
        message.media_url = None
        message.media_thumbnail_url = None

    db.add(message)

    await db.commit()
    await db.refresh(message)

    return message


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
            read_count = await _mark_conversation_as_read(
                current_user_id=current_user.id,
                partner_id=partner_id,
                db=db,
                commit=True,
            )

            if read_count > 0:
                await _broadcast_conversation_snapshot(
                    current_user_id=current_user.id,
                    partner_id=partner_id,
                    db=db,
                    event_type="messages_read",
                )

        messages = await _get_conversation_messages(
            current_user_id=current_user.id,
            partner_id=partner_id,
            db=db,
        )

        return [message_out(message) for message in messages]

    result = await db.execute(
        select(Message)
        .options(selectinload(Message.reply_to))
        .where(visible_for_user_filter(current_user.id))
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

    message = await _create_message(
        data=data,
        current_user=current_user,
        receiver=receiver,
        db=db,
    )

    payload = {
        "type": "message_created",
        "message": serialize_message(message),
    }

    await ws_manager.send_to_users(
        [current_user.id, receiver.id],
        payload,
    )

    await _broadcast_conversation_snapshot(
        current_user_id=current_user.id,
        partner_id=receiver.id,
        db=db,
        event_type="conversation_updated",
    )

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

    if read_count > 0:
        await _broadcast_conversation_snapshot(
            current_user_id=current_user.id,
            partner_id=partner_id,
            db=db,
            event_type="messages_read",
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

    message = await _get_message_by_id(message_id, db)
    _ensure_message_participant(message, current_user)

    if message.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if not message.read:
        message.read = True
        db.add(message)

        await db.commit()
        await db.refresh(message)

        await _broadcast_conversation_snapshot(
            current_user_id=message.receiver_id,
            partner_id=message.sender_id,
            db=db,
            event_type="messages_read",
        )

    return message_out(message)


@router.patch("/{message_id}", response_model=MessageOut)
async def edit_message(
    message_id: str,
    data: MessageUpdateIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_coach_subscription_if_needed(current_user, db)

    message = await _get_message_by_id(message_id, db)

    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only sender can edit message")

    if message.message_type != "text":
        raise HTTPException(status_code=400, detail="Only text messages can be edited")

    message.content = data.content
    message.edited_at = now_utc()

    db.add(message)

    await db.commit()

    refreshed = await _get_message_by_id(message.id, db)

    partner_id = _get_partner_id(refreshed, current_user.id)

    await _broadcast_conversation_snapshot(
        current_user_id=current_user.id,
        partner_id=partner_id,
        db=db,
        event_type="message_edited",
    )

    return message_out(refreshed)


@router.post("/{message_id}/reaction", response_model=MessageOut)
async def toggle_reaction(
    message_id: str,
    data: MessageReactionIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_coach_subscription_if_needed(current_user, db)

    message = await _get_message_by_id(message_id, db)
    _ensure_message_participant(message, current_user)

    reactions = dict(message.reactions or {})
    current_users = list(reactions.get(data.emoji, []))

    if current_user.id in current_users:
        current_users = [user_id for user_id in current_users if user_id != current_user.id]
    else:
        current_users.append(current_user.id)

    if current_users:
        reactions[data.emoji] = current_users
    else:
        reactions.pop(data.emoji, None)

    message.reactions = reactions

    db.add(message)

    await db.commit()

    refreshed = await _get_message_by_id(message.id, db)
    partner_id = _get_partner_id(refreshed, current_user.id)

    await _broadcast_conversation_snapshot(
        current_user_id=current_user.id,
        partner_id=partner_id,
        db=db,
        event_type="message_reaction_updated",
    )

    return message_out(refreshed)


@router.post("/{message_id}/pin", response_model=MessageOut)
async def pin_message(
    message_id: str,
    data: MessagePinIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_coach_subscription_if_needed(current_user, db)

    message = await _get_message_by_id(message_id, db)
    _ensure_message_participant(message, current_user)

    message.pinned = data.pinned

    db.add(message)

    await db.commit()

    refreshed = await _get_message_by_id(message.id, db)
    partner_id = _get_partner_id(refreshed, current_user.id)

    await _broadcast_conversation_snapshot(
        current_user_id=current_user.id,
        partner_id=partner_id,
        db=db,
        event_type="message_pin_updated",
    )

    return message_out(refreshed)


@router.post("/{message_id}/forward", response_model=MessageOut, status_code=201)
async def forward_message(
    message_id: str,
    data: MessageForwardIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_coach_subscription_if_needed(current_user, db)

    original = await _get_message_by_id(message_id, db)
    _ensure_message_participant(original, current_user)

    receiver = await _ensure_user_exists(data.receiver_id, db)

    if receiver.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot forward message to yourself",
        )

    forwarded = Message(
        id=f"msg_{uuid.uuid4().hex[:12]}",
        sender_id=current_user.id,
        receiver_id=receiver.id,
        content=original.content,
        message_type=original.message_type,
        voice_url=original.voice_url,
        voice_duration_ms=original.voice_duration_ms,
        media_url=original.media_url,
        media_type=original.media_type,
        media_thumbnail_url=getattr(original, "media_thumbnail_url", None),
        reactions={},
        read=False,
        pinned=False,
    )

    db.add(forwarded)

    await db.commit()

    refreshed = await _get_message_by_id(forwarded.id, db)

    await _broadcast_conversation_snapshot(
        current_user_id=current_user.id,
        partner_id=receiver.id,
        db=db,
        event_type="message_forwarded",
    )

    return message_out(refreshed)


@router.delete("/{message_id}")
async def delete_message(
    message_id: str,
    mode: str = Query(
        default="everyone",
        description="Delete mode: me or everyone",
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_coach_subscription_if_needed(current_user, db)

    message = await _delete_message_by_id(
        message_id=message_id,
        current_user=current_user,
        db=db,
        mode=mode,
    )

    partner_id = _get_partner_id(message, current_user.id)

    payload = {
        "type": "message_deleted",
        "mode": mode,
        "messageId": message.id,
        "message_id": message.id,
        "deletedAt": message.deleted_at.isoformat() if message.deleted_at else None,
        "deleted_at": message.deleted_at.isoformat() if message.deleted_at else None,
    }

    user_ids = [current_user.id]

    if mode == "everyone" and partner_id:
        user_ids.append(partner_id)

    await ws_manager.send_to_users(user_ids, payload)

    await _broadcast_conversation_snapshot(
        current_user_id=current_user.id,
        partner_id=partner_id,
        db=db,
        event_type="conversation_updated",
    )

    return {
        "ok": True,
        "mode": mode,
        "messageId": message.id,
        "message_id": message.id,
    }


@router.post("/{message_id}/delete")
async def delete_message_fallback(
    message_id: str,
    mode: str = Query(
        default="everyone",
        description="Delete mode: me or everyone",
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await delete_message(
        message_id=message_id,
        mode=mode,
        current_user=current_user,
        db=db,
    )


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_coach_subscription_if_needed(current_user, db)

    result = await db.execute(
        select(func.count(Message.id)).where(
            and_(
                active_message_filter(),
                Message.receiver_id == current_user.id,
                Message.read == False,  # noqa: E712
            )
        )
    )

    return {"count": int(result.scalar() or 0)}


@router.websocket("/ws")
async def messages_ws(
    websocket: WebSocket,
    partner_id: str = Query(...),
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    current_user = await _get_user_by_token(token, db)

    if not current_user:
        await websocket.close(code=1008)
        return

    try:
        await _ensure_coach_subscription_if_needed(current_user, db)
    except HTTPException:
        await websocket.close(code=1008)
        return

    try:
        partner = await _ensure_user_exists(partner_id, db)
    except HTTPException:
        await websocket.close(code=1008)
        return

    if partner.id == current_user.id:
        await websocket.close(code=1008)
        return

    await ws_manager.connect(current_user.id, websocket)

    try:
        await update_user_last_seen(
            user=current_user,
            db=db,
            force=True,
        )

        await _mark_conversation_as_read(
            current_user_id=current_user.id,
            partner_id=partner.id,
            db=db,
            commit=True,
        )

        messages = await _get_conversation_messages(
            current_user_id=current_user.id,
            partner_id=partner.id,
            db=db,
        )

        await websocket.send_json(
            {
                "type": "connected",
                "userId": current_user.id,
                "user_id": current_user.id,
                "partnerId": partner.id,
                "partner_id": partner.id,
                "messages": serialize_messages(messages),
            }
        )

        await _broadcast_conversation_snapshot(
            current_user_id=current_user.id,
            partner_id=partner.id,
            db=db,
            event_type="messages_read",
        )

        while True:
            raw = await websocket.receive_text()

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": "Invalid JSON",
                    }
                )
                continue

            event_type = data.get("type")

            if event_type == "ping":
                await update_user_last_seen(
                    user=current_user,
                    db=db,
                    force=False,
                )

                server_time = now_utc().isoformat()

                await websocket.send_json(
                    {
                        "type": "pong",
                        "serverTime": server_time,
                        "server_time": server_time,
                    }
                )
                continue

            if event_type == "read":
                read_count = await _mark_conversation_as_read(
                    current_user_id=current_user.id,
                    partner_id=partner.id,
                    db=db,
                    commit=True,
                )

                await _broadcast_conversation_snapshot(
                    current_user_id=current_user.id,
                    partner_id=partner.id,
                    db=db,
                    event_type="messages_read" if read_count > 0 else "conversation_updated",
                )
                continue

            if event_type == "delete_message":
                message_id = str(data.get("messageId") or data.get("message_id") or "")
                mode = str(data.get("mode") or "everyone")

                if not message_id:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": "messageId is required",
                        }
                    )
                    continue

                try:
                    message = await _delete_message_by_id(
                        message_id=message_id,
                        current_user=current_user,
                        db=db,
                        mode=mode,
                    )

                    other_user_id = _get_partner_id(message, current_user.id)

                    await ws_manager.send_to_users(
                        [current_user.id, other_user_id],
                        {
                            "type": "message_deleted",
                            "mode": mode,
                            "messageId": message.id,
                            "message_id": message.id,
                            "deletedAt": message.deleted_at.isoformat()
                            if message.deleted_at
                            else None,
                            "deleted_at": message.deleted_at.isoformat()
                            if message.deleted_at
                            else None,
                        },
                    )

                    await _broadcast_conversation_snapshot(
                        current_user_id=current_user.id,
                        partner_id=other_user_id,
                        db=db,
                        event_type="conversation_updated",
                    )

                except HTTPException as exc:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": exc.detail,
                        }
                    )

                continue

            await websocket.send_json(
                {
                    "type": "error",
                    "message": f"Unsupported event type: {event_type}",
                }
            )

    except WebSocketDisconnect:
        ws_manager.disconnect(current_user.id, websocket)

    except Exception as exc:
        print("[messages_ws] error:", exc)
        ws_manager.disconnect(current_user.id, websocket)

        try:
            await websocket.close(code=1011)
        except Exception:
            pass