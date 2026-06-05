import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: f"msg_{uuid.uuid4().hex[:12]}",
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

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    message_type: Mapped[str] = mapped_column(
        String,
        default="text",
        nullable=False,
    )  # text | voice | image | video

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

    media_type: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )  # image | video

    read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_now,
        nullable=False,
    )

    sender: Mapped["User"] = relationship(
        foreign_keys=[sender_id],
        back_populates="sent_messages",
    )

    receiver: Mapped["User"] = relationship(
        foreign_keys=[receiver_id],
        back_populates="received_messages",
    )

    __table_args__ = (
        Index("ix_messages_sender_id", "sender_id"),
        Index("ix_messages_receiver_id", "receiver_id"),
        Index("ix_messages_created_at", "created_at"),
        Index("ix_messages_deleted_at", "deleted_at"),
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