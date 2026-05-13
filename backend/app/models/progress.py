import uuid

from sqlalchemy import Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ProgressEntry(Base):
    __tablename__ = "progress_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"pe_{uuid.uuid4().hex[:12]}")
    client_id: Mapped[str] = mapped_column(String, ForeignKey("client_profiles.user_id", ondelete="CASCADE"), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    date: Mapped[str] = mapped_column(String, nullable=False)  # YYYY-MM-DD
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    added_by: Mapped[str] = mapped_column(String, nullable=False)  # user_id

    client: Mapped["ClientProfile"] = relationship(back_populates="progress_entries")

    __table_args__ = (
        Index("ix_progress_entries_client_id", "client_id"),
        Index("ix_progress_entries_date", "date"),
    )
