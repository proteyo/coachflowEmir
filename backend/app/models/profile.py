from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now():
    return datetime.now(tz=timezone.utc)


class CoachProfile(Base):
    __tablename__ = "coach_profiles"

    user_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    specialty: Mapped[str] = mapped_column(String, default="Personal Training")
    bio: Mapped[str] = mapped_column(Text, default="")
    experience_years: Mapped[int] = mapped_column(Integer, default=0)
    achievements: Mapped[str] = mapped_column(Text, default="[]")  # JSON list
    certificates: Mapped[str] = mapped_column(Text, default="[]")  # JSON list
    rating: Mapped[float] = mapped_column(Float, default=5.0)
    profile_image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String, nullable=True)

    user: Mapped["User"] = relationship(back_populates="coach_profile")
    subscriptions: Mapped[list["Subscription"]] = relationship(
        back_populates="coach",
        cascade="all, delete-orphan",
    )


class ClientProfile(Base):
    __tablename__ = "client_profiles"

    user_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    coach_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Used for gender-based fitness analytics and 3D muscle model selection.
    # Supported values: "male", "female".
    gender: Mapped[str] = mapped_column(String, default="male")

    goal: Mapped[str] = mapped_column(Text, default="")
    goal_type: Mapped[str | None] = mapped_column(String, nullable=True)
    start_weight: Mapped[float] = mapped_column(Float, default=0)
    current_weight: Mapped[float] = mapped_column(Float, default=0)
    height: Mapped[float] = mapped_column(Float, default=0)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fitness_level: Mapped[str] = mapped_column(String, default="beginner")
    health_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped["User"] = relationship(
        foreign_keys=[user_id],
        back_populates="client_profile",
    )
    streak: Mapped["Streak"] = relationship(
        back_populates="client",
        uselist=False,
        cascade="all, delete-orphan",
    )
    progress_entries: Mapped[list["ProgressEntry"]] = relationship(
        back_populates="client",
        cascade="all, delete-orphan",
    )
    supplement_logs: Mapped[list["SupplementLog"]] = relationship(
        back_populates="client",
        cascade="all, delete-orphan",
    )
    attendance_records: Mapped[list["Attendance"]] = relationship(
        back_populates="client",
        cascade="all, delete-orphan",
    )
    weekly_goals: Mapped[list["WeeklyGoal"]] = relationship(
        back_populates="client",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_client_profiles_coach_id", "coach_id"),
    )