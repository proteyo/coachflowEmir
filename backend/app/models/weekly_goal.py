import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class WeeklyGoal(Base):
    __tablename__ = "weekly_goals"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"wg_{uuid.uuid4().hex[:12]}")
    client_id: Mapped[str] = mapped_column(String, ForeignKey("client_profiles.user_id", ondelete="CASCADE"), nullable=False)
    week_start: Mapped[str] = mapped_column(String, nullable=False)  # YYYY-MM-DD (Monday)
    target_minutes: Mapped[int] = mapped_column(Integer, default=0)
    completed_minutes: Mapped[int] = mapped_column(Integer, default=0)
    target_workouts: Mapped[int] = mapped_column(Integer, default=0)
    completed_workouts: Mapped[int] = mapped_column(Integer, default=0)

    client: Mapped["ClientProfile"] = relationship(back_populates="weekly_goals")

    __table_args__ = (
        UniqueConstraint("client_id", "week_start", name="uq_weekly_goal"),
        Index("ix_weekly_goals_client_id", "client_id"),
    )
