import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


if TYPE_CHECKING:
    from app.models.profile import CoachProfile


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: f"sub_{uuid.uuid4().hex[:12]}",
    )

    coach_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("coach_profiles.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # free | starter | pro | unlimited
    plan_code: Mapped[str] = mapped_column(
        String,
        default="free",
        nullable=False,
        index=True,
    )

    # Free Trial | Starter | Pro | Unlimited
    plan_name: Mapped[str] = mapped_column(
        String,
        default="Free Trial",
        nullable=False,
    )

    price: Mapped[float] = mapped_column(
        Float,
        default=0,
        nullable=False,
    )

    currency: Mapped[str] = mapped_column(
        String,
        default="KZT",
        nullable=False,
    )

    # free = 3, starter = 10, pro = 30, unlimited = 999999
    client_limit: Mapped[int] = mapped_column(
        Integer,
        default=3,
        nullable=False,
    )

    # inactive | active | expired | cancelled
    status: Mapped[str] = mapped_column(
        String,
        default="inactive",
        nullable=False,
        index=True,
    )

    start_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # ── Google Play Billing fields ─────────────────────────────────────────────

    google_product_id: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        index=True,
    )

    # Never store raw purchase_token.
    google_purchase_token_hash: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        index=True,
    )

    google_subscription_state: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    google_acknowledged: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    google_raw_response: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    last_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # ── Audit fields ───────────────────────────────────────────────────────────

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_now,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_now,
        onupdate=_now,
        nullable=False,
    )

    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    coach: Mapped["CoachProfile"] = relationship(
        back_populates="subscriptions",
    )