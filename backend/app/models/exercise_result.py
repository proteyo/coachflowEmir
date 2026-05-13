import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now():
    return datetime.now(tz=timezone.utc)


class ExerciseResult(Base):
    __tablename__ = "exercise_results"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: f"er_{uuid.uuid4().hex[:12]}",
    )

    client_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    coach_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    workout_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("workouts.id", ondelete="CASCADE"),
        nullable=False,
    )

    exercise_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("exercises.id", ondelete="SET NULL"),
        nullable=True,
    )

    exercise_name: Mapped[str] = mapped_column(String, nullable=False)
    muscle_group: Mapped[str | None] = mapped_column(String, nullable=True)

    set_number: Mapped[int] = mapped_column(Integer, nullable=False)
    target_reps: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    actual_reps: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    weight: Mapped[float | None] = mapped_column(Float, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_now,
        nullable=False,
    )

    client = relationship("User", foreign_keys=[client_id])
    coach = relationship("User", foreign_keys=[coach_id])
    workout = relationship("WorkoutAssignment")
    exercise = relationship("Exercise")

    __table_args__ = (
        Index("ix_exercise_results_client_id", "client_id"),
        Index("ix_exercise_results_coach_id", "coach_id"),
        Index("ix_exercise_results_workout_id", "workout_id"),
        Index("ix_exercise_results_exercise_name", "exercise_name"),
        Index("ix_exercise_results_created_at", "created_at"),
    )