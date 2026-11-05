"""Social data is separate from private coaching and health records."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


def now():
    return datetime.now(timezone.utc)


class ConversationSetting(Base):
    __tablename__ = "conversation_settings"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    partner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    muted: Mapped[bool] = mapped_column(Boolean, default=False)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    theme: Mapped[str] = mapped_column(String(40), default="midnight")


class UserBlock(Base):
    __tablename__ = "user_blocks"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    target_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)


class ChatGroup(Base):
    __tablename__ = "chat_groups"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: "grp_" + uuid.uuid4().hex)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(80))
    theme: Mapped[str] = mapped_column(String(40), default="midnight")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ChatMember(Base):
    __tablename__ = "chat_members"
    group_id: Mapped[str] = mapped_column(ForeignKey("chat_groups.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    muted: Mapped[bool] = mapped_column(Boolean, default=False)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class GroupMessage(Base):
    __tablename__ = "group_messages"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: "gm_" + uuid.uuid4().hex)
    group_id: Mapped[str] = mapped_column(ForeignKey("chat_groups.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    client_id: Mapped[str] = mapped_column(String(160), unique=True)
    content: Mapped[str] = mapped_column(Text, default="")
    media_url: Mapped[str | None] = mapped_column(String, nullable=True)
    media_type: Mapped[str | None] = mapped_column(String(10), nullable=True)
    hidden_for: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class SocialProfile(Base):
    __tablename__ = "social_profiles"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    bio: Mapped[str] = mapped_column(String(400), default="")
    birth_year: Mapped[str] = mapped_column(String(4), default="")
    goal: Mapped[str] = mapped_column(String(160), default="")
    show_rating: Mapped[bool] = mapped_column(Boolean, default=False)


class Story(Base):
    __tablename__ = "stories"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: "story_" + uuid.uuid4().hex)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    media_url: Mapped[str] = mapped_column(String)
    media_type: Mapped[str] = mapped_column(String(10))
    caption: Mapped[str] = mapped_column(String(500), default="")
    replies_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    visibility: Mapped[str] = mapped_column(String(12), default="contacts")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)


class StoryView(Base):
    __tablename__ = "story_views"
    story_id: Mapped[str] = mapped_column(ForeignKey("stories.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    liked: Mapped[bool] = mapped_column(Boolean, default=False)
    viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
