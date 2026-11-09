import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class ContentReport(Base):
    __tablename__ = "content_reports"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: "report_" + uuid.uuid4().hex)
    reporter_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    target_type: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[str] = mapped_column(String(160))
    reason: Mapped[str] = mapped_column(String(20))
    note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("reporter_id", "target_type", "target_id", name="uq_report_target_owner"),)
