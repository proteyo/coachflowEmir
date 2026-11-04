from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class PurchaseClaim(Base):
    """A receipt stays bound to its owner after cancellation or plan changes."""
    __tablename__ = "purchase_claims"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
