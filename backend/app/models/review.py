import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def now_utc():
    return datetime.now(timezone.utc)


class CoachReview(Base):
    __tablename__ = "coach_reviews"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: f"cr_{uuid.uuid4().hex[:12]}",
    )

    coach_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    client_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        onupdate=now_utc,
        nullable=False,
    )

    coach = relationship("User", foreign_keys=[coach_id])
    client = relationship("User", foreign_keys=[client_id])

    __table_args__ = (
        UniqueConstraint("coach_id", "client_id", name="uq_coach_review_once"),
    )


class ClientAssessment(Base):
    __tablename__ = "client_assessments"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: f"ca_{uuid.uuid4().hex[:12]}",
    )

    coach_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    client_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    discipline_rating: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    progress_rating: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    communication_rating: Mapped[int] = mapped_column(Integer, nullable=False, default=5)

    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_utc,
        onupdate=now_utc,
        nullable=False,
    )

    coach = relationship("User", foreign_keys=[coach_id])
    client = relationship("User", foreign_keys=[client_id])

    __table_args__ = (
        UniqueConstraint("coach_id", "client_id", name="uq_client_assessment_once"),
    )