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
    Reactions storage format:

    {
        "👍": ["u_123", "u_456"],
        "❤️": ["u_789"]
    }

    emoji -> list of user IDs who reacted.
    """
    return {}


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: f"msg_{uuid.uuid4().hex[:12]}",
    )

    # Used to prevent duplicate messages.
    # Frontend creates a temporary ID, sends it to backend,
    # backend returns the same client_temp_id,
    # then frontend replaces local message with real backend message.
    #
    # Important:
    # Do NOT set unique=True here.
    # Alembic migration creates a partial unique index:
    # client_temp_id IS NOT NULL
    client_temp_id: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
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

    media_thumbnail_url: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

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

    pinned: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    deleted_for_sender: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    deleted_for_receiver: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

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