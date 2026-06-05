"""
Messages API.

Endpoints:
GET       /messages                    — conversation between current_user and ?partner_id=
POST      /messages                    — send message
POST      /messages/read-conversation  — mark all incoming messages from partner as read
POST      /messages/{id}/read          — mark one message as read
DELETE    /messages/{id}               — delete message
POST      /messages/{id}/delete        — delete message fallback
GET       /messages/unread-count       — unread messages count for current user
WebSocket /messages/ws                 — realtime chat socket

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

from app.core.deps import (
    get_current_user,
    require_active_coach_subscription,
    update_user_last_seen,
)
from app.core.security import decode_token
from app.db.database import get_db
from app.models.message import Message
from app.models.user import User
from app.schemas.other import MessageIn, MessageOut
from app.services.mappers import message_out

router = APIRouter(prefix="/messages", tags=["Messages"])


ALLOWED_MESSAGE_TYPES = {"text", "voice", "image", "video"}


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

    async def send_to_user(self, user_id: str, payload: dict[str, Any]) -> None:
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

    async def send_to_users(self, user_ids: list[str], payload: dict[str, Any]) -> None:
        unique_user_ids = list(dict.fromkeys(user_ids))

        for user_id in unique_user_ids:
            await self.send_to_user(user_id, payload)


ws_manager = WebSocketConnectionManager()


def now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def serialize_message(message: Message) -> dict[str, Any]:
    return message_out(message).model_dump()


def serialize_messages(messages: list[Message]) -> list[dict[str, Any]]:
    return [serialize_message(message) for message in messages]


def is_deleted_filter() -> Any:
    return Message.deleted_at.is_(None)


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


async def _get_user_by_token(token: str, db: AsyncSession) -> User | None:
    """
    WebSocket auth helper.

    Normal REST auth uses get_current_user with Bearer token.
    WebSocket cannot send Authorization header reliably from all mobile clients,
    so the frontend passes access token in query param.
    """

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

    if not user:
        return None

    return user


async def _get_conversation_messages(
    current_user_id: str,
    partner_id: str,
    db: AsyncSession,
) -> list[Message]:
    """
    Returns all active messages between current user and partner ordered by creation time.
    """

    result = await db.execute(
        select(Message)
        .where(
            and_(
                is_deleted_filter(),
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
    """
    Marks all unread active messages that were sent by partner to current user.

    Example:
    - Client sends message to coach.
    - Coach opens chat OR sends a reply.
    - Client's messages become read=True.
    - When client receives realtime event, he sees two check marks and "прочитано".
    """

    count_result = await db.execute(
        select(func.count(Message.id)).where(
            and_(
                is_deleted_filter(),
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
                is_deleted_filter(),
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
    partner_id: str,
    db: AsyncSession,
    event_type: str = "conversation_updated",
) -> None:
    messages = await _get_conversation_messages(
        current_user_id=current_user_id,
        partner_id=partner_id,
        db=db,
    )

    payload = {
        "type": event_type,
        "partnerId": partner_id,
        "partner_id": partner_id,
        "messages": serialize_messages(messages),
    }

    await ws_manager.send_to_user(current_user_id, payload)

    partner_payload = {
        "type": event_type,
        "partnerId": current_user_id,
        "partner_id": current_user_id,
        "messages": serialize_messages(messages),
    }

    await ws_manager.send_to_user(partner_id, partner_payload)


async def _create_message(
    *,
    data: MessageIn,
    current_user: User,
    receiver: User,
    db: AsyncSession,
) -> Message:
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
        sender_id=current_user.id,
        receiver_id=receiver.id,
        content=content or fallback_content,
        message_type=message_type,
        voice_url=data.voice_url,
        voice_duration_ms=data.voice_duration_ms,
        media_url=data.media_url,
        media_type=data.media_type or ("image" if message_type == "image" else "video" if message_type == "video" else None),
        read=False,
    )

    db.add(message)

    await db.commit()
    await db.refresh(message)

    return message


async def _delete_message_by_id(
    *,
    message_id: str,
    current_user: User,
    db: AsyncSession,
) -> Message:
    result = await db.execute(
        select(Message).where(
            and_(
                Message.id == message_id,
                is_deleted_filter(),
            )
        )
    )

    message = result.scalar_one_or_none()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.sender_id != current_user.id and message.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    message.deleted_at = now_utc()
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
        .where(
            and_(
                is_deleted_filter(),
                or_(
                    Message.sender_id == current_user.id,
                    Message.receiver_id == current_user.id,
                ),
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

    result = await db.execute(
        select(Message).where(
            and_(
                Message.id == message_id,
                is_deleted_filter(),
            )
        )
    )

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

        if message.receiver_id and message.sender_id:
            await _broadcast_conversation_snapshot(
                current_user_id=message.receiver_id,
                partner_id=message.sender_id,
                db=db,
                event_type="messages_read",
            )

    return message_out(message)


@router.delete("/{message_id}")
async def delete_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_coach_subscription_if_needed(current_user, db)

    message = await _delete_message_by_id(
        message_id=message_id,
        current_user=current_user,
        db=db,
    )

    partner_id = message.receiver_id if message.sender_id == current_user.id else message.sender_id

    payload = {
        "type": "message_deleted",
        "messageId": message.id,
        "message_id": message.id,
        "deletedAt": message.deleted_at.isoformat() if message.deleted_at else None,
        "deleted_at": message.deleted_at.isoformat() if message.deleted_at else None,
    }

    user_ids = [current_user.id]

    if partner_id:
        user_ids.append(partner_id)

    await ws_manager.send_to_users(user_ids, payload)

    if partner_id:
        await _broadcast_conversation_snapshot(
            current_user_id=current_user.id,
            partner_id=partner_id,
            db=db,
            event_type="conversation_updated",
        )

    return {
        "ok": True,
        "messageId": message.id,
        "message_id": message.id,
    }


@router.post("/{message_id}/delete")
async def delete_message_fallback(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await delete_message(
        message_id=message_id,
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
                is_deleted_filter(),
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

    partner = await _ensure_user_exists(partner_id, db)

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

                await websocket.send_json(
                    {
                        "type": "pong",
                        "serverTime": now_utc().isoformat(),
                        "server_time": now_utc().isoformat(),
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
                    )

                    receiver_id = message.receiver_id
                    sender_id = message.sender_id
                    other_user_id = receiver_id if sender_id == current_user.id else sender_id

                    await ws_manager.send_to_users(
                        [sender_id, receiver_id] if receiver_id else [sender_id],
                        {
                            "type": "message_deleted",
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

                    if other_user_id:
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