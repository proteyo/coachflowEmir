import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now():
    return datetime.now(tz=timezone.utc)


class SupplementPlan(Base):
    __tablename__ = "supplement_plans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"sp_{uuid.uuid4().hex[:12]}")
    coach_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    start_date: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    items: Mapped[list["SupplementItem"]] = relationship(back_populates="plan", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_supplement_plans_client_id", "client_id"),
    )


class SupplementItem(Base):
    __tablename__ = "supplement_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"si_{uuid.uuid4().hex[:12]}")
    plan_id: Mapped[str] = mapped_column(String, ForeignKey("supplement_plans.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    dosage: Mapped[str] = mapped_column(String, nullable=False)
    times_per_day: Mapped[int] = mapped_column(Integer, nullable=False)
    specific_times: Mapped[str] = mapped_column(Text, default="[]")
    days_of_week: Mapped[str] = mapped_column(Text, default='["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]')
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    plan: Mapped["SupplementPlan"] = relationship(back_populates="items")


class SupplementLog(Base):
    __tablename__ = "supplement_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"sl_{uuid.uuid4().hex[:12]}")
    client_id: Mapped[str] = mapped_column(String, ForeignKey("client_profiles.user_id", ondelete="CASCADE"), nullable=False)
    supplement_item_id: Mapped[str] = mapped_column(String, ForeignKey("supplement_items.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[str] = mapped_column(String, nullable=False)
    time: Mapped[str] = mapped_column(String, nullable=False)
    taken: Mapped[bool] = mapped_column(Boolean, default=False)

    client: Mapped["ClientProfile"] = relationship(back_populates="supplement_logs")

    __table_args__ = (
        UniqueConstraint("client_id", "supplement_item_id", "date", "time", name="uq_sup_log"),
        Index("ix_supplement_logs_client_id", "client_id"),
    )