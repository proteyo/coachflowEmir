import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


if TYPE_CHECKING:
    from app.models.user import User


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _default_reactions() -> dict[str, Any]:
    """
    Храним реакции так:

    {
        "👍": ["u_123", "u_456"],
        "❤️": ["u_789"]
    }

    То есть emoji -> список user_id, кто поставил реакцию.
    """
    return {}


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: f"msg_{uuid.uuid4().hex[:12]}",
    )

    # Нужен для защиты от дублей.
    # Frontend создаёт local/temp id, отправляет его на backend,
    # backend возвращает тот же client_temp_id, и frontend заменяет временное сообщение.
    client_temp_id: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        unique=True,
    )

    sender_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    receiver_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Ответ на другое сообщение.
    reply_to_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
    )

    # text | voice | image | video
    message_type: Mapped[str] = mapped_column(
        String,
        default="text",
        nullable=False,
    )

    voice_url: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    voice_duration_ms: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    media_url: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    # image | video
    media_type: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    # Обложка для видео.
    media_thumbnail_url: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    # Реакции пользователей.
    reactions: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=_default_reactions,
        nullable=False,
    )

    read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Закреплено ли сообщение в чате.
    pinned: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Полное удаление/мягкое удаление.
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Удалено только у отправителя.
    deleted_for_sender: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Удалено только у получателя.
    deleted_for_receiver: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Удалено у всех.
    deleted_for_everyone: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_now,
        nullable=False,
    )

    edited_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    sender: Mapped["User"] = relationship(
        foreign_keys=[sender_id],
        back_populates="sent_messages",
    )

    receiver: Mapped["User"] = relationship(
        foreign_keys=[receiver_id],
        back_populates="received_messages",
    )

    reply_to: Mapped["Message | None"] = relationship(
        "Message",
        remote_side=[id],
        foreign_keys=[reply_to_id],
        uselist=False,
    )

    __table_args__ = (
        Index("ix_messages_client_temp_id", "client_temp_id"),
        Index("ix_messages_sender_id", "sender_id"),
        Index("ix_messages_receiver_id", "receiver_id"),
        Index("ix_messages_reply_to_id", "reply_to_id"),
        Index("ix_messages_created_at", "created_at"),
        Index("ix_messages_deleted_at", "deleted_at"),
        Index("ix_messages_edited_at", "edited_at"),
        Index("ix_messages_pinned", "pinned"),
        Index("ix_messages_deleted_for_everyone", "deleted_for_everyone"),
        Index(
            "ix_messages_sender_receiver_created",
            "sender_id",
            "receiver_id",
            "created_at",
        ),
        Index(
            "ix_messages_receiver_sender_read",
            "receiver_id",
            "sender_id",
            "read",
        ),
    )