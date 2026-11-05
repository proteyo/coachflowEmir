"""Private coach CRM. A coaching contract is independent of the app tariff."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class ClientEngagement(Base):
    __tablename__ = "client_engagements"
    coach_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    status: Mapped[str] = mapped_column(String(12), default="active")
    starts_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ends_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    monthly_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    notes: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


    __table_args__ = (Index("ix_client_engagement_client_updated", "client_id", "updated_at"),)


class ClientPayment(Base):
    __tablename__ = "client_payments"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: "pay_" + uuid.uuid4().hex)
    coach_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    paid_on: Mapped[date] = mapped_column(Date, index=True)
    note: Mapped[str] = mapped_column(String(300), default="")
    request_id: Mapped[str] = mapped_column(String(160), unique=True)



class CoachExpense(Base):
    __tablename__ = "coach_expenses"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: "expense_" + uuid.uuid4().hex)
    coach_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    paid_on: Mapped[date] = mapped_column(Date, index=True)
    note: Mapped[str] = mapped_column(String(300), default="")
    request_id: Mapped[str] = mapped_column(String(160), unique=True)
