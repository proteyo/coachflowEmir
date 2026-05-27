import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: f"u_{uuid.uuid4().hex[:12]}",
    )

    email: Mapped[str] = mapped_column(
        String,
        unique=True,
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    role: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    phone: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    avatar_url: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    client_code: Mapped[str | None] = mapped_column(
        String,
        unique=True,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_now,
        nullable=False,
    )

    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )

    # Email verification.
    # New users must verify email before login.
    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    email_verification_code_hash: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    email_verification_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    email_verification_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    coach_profile: Mapped["CoachProfile"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    client_profile: Mapped["ClientProfile"] = relationship(
        back_populates="user",
        foreign_keys="ClientProfile.user_id",
        uselist=False,
        cascade="all, delete-orphan",
    )

    notification_settings: Mapped["NotificationSetting"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    sent_messages: Mapped[list["Message"]] = relationship(
        foreign_keys="Message.sender_id",
        back_populates="sender",
        cascade="all, delete-orphan",
    )

    received_messages: Mapped[list["Message"]] = relationship(
        foreign_keys="Message.receiver_id",
        back_populates="receiver",
    )

    __table_args__ = (
        Index("ix_users_email", "email"),
        Index("ix_users_role", "role"),
        Index("ix_users_client_code", "client_code"),
        Index("ix_users_last_seen_at", "last_seen_at"),
        Index("ix_users_email_verified", "email_verified"),
    )