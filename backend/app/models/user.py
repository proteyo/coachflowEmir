import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now():
    return datetime.now(tz=timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"u_{uuid.uuid4().hex[:12]}")
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)  # coach | client
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    client_code: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    # Relationships
    coach_profile: Mapped["CoachProfile"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    client_profile: Mapped["ClientProfile"] = relationship(
        back_populates="user",
        foreign_keys="ClientProfile.user_id",
        uselist=False,
        cascade="all, delete-orphan",
    )
    notification_settings: Mapped["NotificationSetting"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    sent_messages: Mapped[list["Message"]] = relationship(foreign_keys="Message.sender_id", back_populates="sender", cascade="all, delete-orphan")
    received_messages: Mapped[list["Message"]] = relationship(foreign_keys="Message.receiver_id", back_populates="receiver")

    __table_args__ = (
        Index("ix_users_email", "email"),
        Index("ix_users_client_code", "client_code"),
    )
