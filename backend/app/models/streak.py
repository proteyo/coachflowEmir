from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Streak(Base):
    __tablename__ = "streaks"

    client_id: Mapped[str] = mapped_column(String, ForeignKey("client_profiles.user_id", ondelete="CASCADE"), primary_key=True)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    best_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_activity_date: Mapped[str | None] = mapped_column(String, nullable=True)  # YYYY-MM-DD

    client: Mapped["ClientProfile"] = relationship(back_populates="streak")
