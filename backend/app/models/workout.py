import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now():
    return datetime.now(tz=timezone.utc)


class WorkoutAssignment(Base):
    __tablename__ = "workouts"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: f"w_{uuid.uuid4().hex[:12]}",
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

    date: Mapped[str] = mapped_column(String, nullable=False)  # YYYY-MM-DD
    time: Mapped[str | None] = mapped_column(String, nullable=True)  # HH:MM

    # Main multilingual workout title
    name: Mapped[str] = mapped_column(String, nullable=False)
    name_ru: Mapped[str | None] = mapped_column(String, nullable=True)
    name_kk: Mapped[str | None] = mapped_column(String, nullable=True)

    # Main multilingual workout description
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_ru: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_kk: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Category / focus group
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    category_ru: Mapped[str | None] = mapped_column(String, nullable=True)
    category_kk: Mapped[str | None] = mapped_column(String, nullable=True)

    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Source of workout:
    # manual / weekly_template / ai_generated / imported
    source: Mapped[str | None] = mapped_column(String, nullable=True, default="manual")

    # Weekly plan metadata
    weekly_plan_id: Mapped[str | None] = mapped_column(String, nullable=True)
    weekly_plan_title: Mapped[str | None] = mapped_column(String, nullable=True)
    weekly_plan_title_ru: Mapped[str | None] = mapped_column(String, nullable=True)
    weekly_plan_title_kk: Mapped[str | None] = mapped_column(String, nullable=True)
    weekly_plan_day_index: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Difficulty and focus
    difficulty: Mapped[str | None] = mapped_column(String, nullable=True)

    focus: Mapped[str | None] = mapped_column(String, nullable=True)
    focus_ru: Mapped[str | None] = mapped_column(String, nullable=True)
    focus_kk: Mapped[str | None] = mapped_column(String, nullable=True)

    # Coach notes / AI analysis attached to workout
    coach_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    coach_notes_ru: Mapped[str | None] = mapped_column(Text, nullable=True)
    coach_notes_kk: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    exercises: Mapped[list["Exercise"]] = relationship(
        back_populates="workout",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_workouts_client_id", "client_id"),
        Index("ix_workouts_coach_id", "coach_id"),
        Index("ix_workouts_date", "date"),
        Index("ix_workouts_weekly_plan_id", "weekly_plan_id"),
    )


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: f"ex_{uuid.uuid4().hex[:12]}",
    )

    workout_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("workouts.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Optional link to frontend exercise library id
    library_exercise_id: Mapped[str | None] = mapped_column(String, nullable=True)

    # Multilingual exercise name
    name: Mapped[str] = mapped_column(String, nullable=False)
    name_ru: Mapped[str | None] = mapped_column(String, nullable=True)
    name_kk: Mapped[str | None] = mapped_column(String, nullable=True)

    sets: Mapped[int] = mapped_column(Integer, nullable=False)
    reps: Mapped[int] = mapped_column(Integer, nullable=False)
    rest_seconds: Mapped[int] = mapped_column(Integer, nullable=False)

    weight: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Multilingual coach notes / technique notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes_ru: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes_kk: Mapped[str | None] = mapped_column(Text, nullable=True)

    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    gif_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # JSON string with animation frames.
    # Example: ["https://...", "https://..."]
    animation_frames: Mapped[str | None] = mapped_column(Text, nullable=True)

    muscle_group: Mapped[str | None] = mapped_column(String, nullable=True)

    # Professional programming fields
    tempo: Mapped[str | None] = mapped_column(String, nullable=True)
    target_rpe: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Exercise order inside workout
    order: Mapped[int | None] = mapped_column(Integer, nullable=True)

    workout: Mapped["WorkoutAssignment"] = relationship(back_populates="exercises")

    __table_args__ = (
        Index("ix_exercises_workout_id", "workout_id"),
        Index("ix_exercises_library_exercise_id", "library_exercise_id"),
    )