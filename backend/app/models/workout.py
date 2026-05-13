import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now():
    return datetime.now(tz=timezone.utc)


class WorkoutAssignment(Base):
    __tablename__ = "workouts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"w_{uuid.uuid4().hex[:12]}")
    coach_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[str] = mapped_column(String, nullable=False)       # YYYY-MM-DD
    time: Mapped[str | None] = mapped_column(String, nullable=True) # HH:MM
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    exercises: Mapped[list["Exercise"]] = relationship(back_populates="workout", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_workouts_client_id", "client_id"),
        Index("ix_workouts_coach_id", "coach_id"),
        Index("ix_workouts_date", "date"),
    )


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"ex_{uuid.uuid4().hex[:12]}")
    workout_id: Mapped[str] = mapped_column(String, ForeignKey("workouts.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    sets: Mapped[int] = mapped_column(Integer, nullable=False)
    reps: Mapped[int] = mapped_column(Integer, nullable=False)
    rest_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    muscle_group: Mapped[str | None] = mapped_column(String, nullable=True)

    workout: Mapped["WorkoutAssignment"] = relationship(back_populates="exercises")
