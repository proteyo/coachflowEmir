from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class NotificationSetting(Base):
    __tablename__ = "notification_settings"

    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    workout_reminders: Mapped[bool] = mapped_column(Boolean, default=True)
    supplement_reminders: Mapped[bool] = mapped_column(Boolean, default=True)
    message_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    weekly_goal_reminders: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(back_populates="notification_settings")
