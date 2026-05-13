import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now():
    return datetime.now(tz=timezone.utc)


def _expires():
    return _now() + timedelta(days=7)


class ClientInvite(Base):
    __tablename__ = "client_invites"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: f"inv_{uuid.uuid4().hex[:12]}",
    )

    coach_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    client_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    email: Mapped[str] = mapped_column(String, nullable=False, index=True)

    status: Mapped[str] = mapped_column(
        String,
        default="pending",
        nullable=False,
    )  # pending / accepted / rejected / cancelled / expired

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_now,
        nullable=False,
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_expires,
        nullable=False,
    )

    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    coach = relationship("User", foreign_keys=[coach_id])
    client = relationship("User", foreign_keys=[client_id])

    __table_args__ = (
        Index("ix_client_invites_coach_id", "coach_id"),
        Index("ix_client_invites_client_id", "client_id"),
        Index("ix_client_invites_status", "status"),
    )