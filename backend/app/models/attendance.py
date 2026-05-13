import uuid

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"att_{uuid.uuid4().hex[:12]}")
    client_id: Mapped[str] = mapped_column(String, ForeignKey("client_profiles.user_id", ondelete="CASCADE"), nullable=False)
    coach_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[str] = mapped_column(String, nullable=False)  # YYYY-MM-DD
    status: Mapped[str] = mapped_column(String, nullable=False)  # attended|missed|rest
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    client: Mapped["ClientProfile"] = relationship(back_populates="attendance_records")

    __table_args__ = (
        UniqueConstraint("client_id", "date", name="uq_attendance"),
        Index("ix_attendance_client_id", "client_id"),
        Index("ix_attendance_date", "date"),
    )
