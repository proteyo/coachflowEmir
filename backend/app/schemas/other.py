from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


# ── Progress ──────────────────────────────────────────────────────────────────

class ProgressEntryIn(BaseModel):
    weight: float
    date: str
    notes: Optional[str] = None


class ProgressEntryOut(BaseModel):
    id: str
    clientId: str
    weight: float
    date: str
    notes: Optional[str] = None
    addedBy: str

    model_config = {"from_attributes": True}


# ── Messages ──────────────────────────────────────────────────────────────────

class MessageIn(BaseModel):
    receiver_id: str

    # Frontend creates this temp id and backend returns it back.
    # This protects chat from duplicate messages.
    client_temp_id: Optional[str] = None

    content: str = ""
    message_type: str = "text"

    # Reply to another message.
    reply_to_id: Optional[str] = None

    # Voice
    voice_url: Optional[str] = None
    voice_duration_ms: Optional[int] = None

    # Image / video
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    media_thumbnail_url: Optional[str] = None

    @field_validator("receiver_id")
    @classmethod
    def receiver_id_valid(cls, value: str) -> str:
        cleaned = (value or "").strip()

        if not cleaned:
            raise ValueError("receiver_id is required")

        if len(cleaned) > 120:
            raise ValueError("receiver_id is too long")

        return cleaned

    @field_validator("client_temp_id")
    @classmethod
    def client_temp_id_valid(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        cleaned = value.strip()

        if not cleaned:
            return None

        if len(cleaned) > 120:
            raise ValueError("client_temp_id is too long")

        return cleaned

    @field_validator("reply_to_id")
    @classmethod
    def reply_to_id_valid(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        cleaned = value.strip()

        if not cleaned:
            return None

        if len(cleaned) > 120:
            raise ValueError("reply_to_id is too long")

        return cleaned

    @field_validator("content")
    @classmethod
    def content_valid(cls, value: str) -> str:
        cleaned = (value or "").strip()

        if len(cleaned) > 5000:
            raise ValueError("content is too long")

        return cleaned

    @field_validator("message_type")
    @classmethod
    def message_type_valid(cls, value: str) -> str:
        normalized = (value or "text").strip().lower()

        allowed = {"text", "voice", "image", "video"}

        if normalized not in allowed:
            raise ValueError("message_type must be text, voice, image, or video")

        return normalized

    @field_validator("media_type")
    @classmethod
    def media_type_valid(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        normalized = value.strip().lower()

        allowed = {"image", "video"}

        if normalized not in allowed:
            raise ValueError("media_type must be image or video")

        return normalized

    @field_validator("media_url", "media_thumbnail_url", "voice_url")
    @classmethod
    def url_valid(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        cleaned = value.strip()

        if len(cleaned) > 3000:
            raise ValueError("url is too long")

        return cleaned or None

    @field_validator("voice_duration_ms")
    @classmethod
    def voice_duration_valid(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return None

        if value < 0:
            raise ValueError("voice_duration_ms cannot be negative")

        if value > 30 * 60 * 1000:
            raise ValueError("voice_duration_ms is too long")

        return value


class MessageUpdateIn(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_valid(cls, value: str) -> str:
        cleaned = (value or "").strip()

        if not cleaned:
            raise ValueError("content is required")

        if len(cleaned) > 5000:
            raise ValueError("content is too long")

        return cleaned


class MessageReactionIn(BaseModel):
    emoji: str

    @field_validator("emoji")
    @classmethod
    def emoji_valid(cls, value: str) -> str:
        cleaned = (value or "").strip()

        allowed = {"💙", "👍", "👀", "😂", "🔥", "❤️", "💪", "👏"}

        if cleaned not in allowed:
            raise ValueError("Unsupported reaction emoji")

        return cleaned


class MessagePinIn(BaseModel):
    pinned: bool = True


class MessageForwardIn(BaseModel):
    receiver_id: str

    @field_validator("receiver_id")
    @classmethod
    def receiver_id_valid(cls, value: str) -> str:
        cleaned = (value or "").strip()

        if not cleaned:
            raise ValueError("receiver_id is required")

        if len(cleaned) > 120:
            raise ValueError("receiver_id is too long")

        return cleaned


class MessageOut(BaseModel):
    id: str

    # Returned so frontend can replace local optimistic message
    # instead of adding duplicate backend message.
    clientTempId: Optional[str] = None

    senderId: str
    receiverId: Optional[str] = None

    # Reply
    replyToId: Optional[str] = None
    replyPreview: Optional[dict[str, Any]] = None

    content: str
    messageType: str

    # Voice
    voiceUrl: Optional[str] = None
    voiceDurationMs: Optional[int] = None

    # Image / video
    mediaUrl: Optional[str] = None
    mediaType: Optional[str] = None
    mediaThumbnailUrl: Optional[str] = None

    # Example:
    # {
    #   "👍": ["u_1", "u_2"],
    #   "❤️": ["u_3"]
    # }
    reactions: dict[str, Any] = Field(default_factory=dict)

    read: bool
    pinned: bool = False

    deletedAt: Optional[str] = None
    deletedForSender: bool = False
    deletedForReceiver: bool = False
    deletedForEveryone: bool = False

    editedAt: Optional[str] = None
    createdAt: str

    model_config = {"from_attributes": True}


# ── Weekly Goals ──────────────────────────────────────────────────────────────

class WeeklyGoalIn(BaseModel):
    week_start: str
    target_minutes: int = Field(..., ge=0, le=10080)
    completed_minutes: int = Field(0, ge=0, le=10080)
    target_workouts: int = Field(..., ge=0, le=50)
    completed_workouts: int = Field(0, ge=0, le=50)


class WeeklyGoalUpdate(BaseModel):
    target_minutes: Optional[int] = Field(None, ge=0, le=10080)
    completed_minutes: Optional[int] = Field(None, ge=0, le=10080)
    target_workouts: Optional[int] = Field(None, ge=0, le=50)
    completed_workouts: Optional[int] = Field(None, ge=0, le=50)


class WeeklyGoalOut(BaseModel):
    id: str
    clientId: str
    weekStart: str
    targetMinutes: int
    completedMinutes: int
    targetWorkouts: int
    completedWorkouts: int

    model_config = {"from_attributes": True}


# ── Streak ────────────────────────────────────────────────────────────────────

class StreakOut(BaseModel):
    clientId: str
    currentStreak: int
    bestStreak: int
    lastActivityDate: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Attendance ────────────────────────────────────────────────────────────────

class AttendanceIn(BaseModel):
    client_id: str
    date: str
    status: str
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def status_valid(cls, value: str) -> str:
        if value not in ("attended", "missed", "rest"):
            raise ValueError("status must be attended, missed, or rest")

        return value

    @field_validator("notes")
    @classmethod
    def notes_valid(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        cleaned = value.strip()

        if len(cleaned) > 1000:
            raise ValueError("notes is too long")

        return cleaned or None


class AttendanceOut(BaseModel):
    id: str
    clientId: str
    coachId: str
    date: str
    status: str
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Place ─────────────────────────────────────────────────────────────────────

class PlaceOut(BaseModel):
    id: str
    type: str
    name: str
    address: str
    latitude: float
    longitude: float
    description: Optional[str] = None
    imageUrl: Optional[str] = None
    rating: Optional[float] = None

    model_config = {"from_attributes": True}


# ── Notification Settings ─────────────────────────────────────────────────────

class NotificationSettingOut(BaseModel):
    userId: str
    workoutReminders: bool
    supplementReminders: bool
    messageNotifications: bool
    weeklyGoalReminders: bool

    model_config = {"from_attributes": True}


class NotificationSettingUpdate(BaseModel):
    workout_reminders: Optional[bool] = None
    supplement_reminders: Optional[bool] = None
    message_notifications: Optional[bool] = None
    weekly_goal_reminders: Optional[bool] = None


# ── Subscription ──────────────────────────────────────────────────────────────

class SubscriptionOut(BaseModel):
    id: str
    coachId: str

    # free | starter | pro | unlimited
    planCode: str

    # Free Trial | Starter | Pro | Unlimited
    planName: str

    price: float
    currency: str

    # free = 3, starter = 10, pro = 30, unlimited = 999999
    clientLimit: int

    # inactive | active | expired | cancelled
    status: str

    startDate: Optional[str] = None
    endDate: Optional[str] = None

    # Safe Google Play fields.
    # Never expose purchase token or raw Google response to frontend.
    googleProductId: Optional[str] = None
    googleSubscriptionState: Optional[str] = None
    googleAcknowledged: bool = False
    lastVerifiedAt: Optional[str] = None

    createdAt: str
    updatedAt: Optional[str] = None
    cancelledAt: Optional[str] = None

    model_config = {"from_attributes": True}


class UpdateSubscriptionRequest(BaseModel):
    plan_code: Optional[str] = None

    # These fields are intentionally present so backend can reject direct changes.
    # Frontend must not be able to directly change price, status, dates or limits.
    plan_name: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    client_limit: Optional[int] = None
    status: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

    @field_validator("plan_code")
    @classmethod
    def plan_code_valid(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        normalized = value.strip().lower()

        allowed = {"free", "starter", "pro", "unlimited"}

        if normalized not in allowed:
            raise ValueError("plan_code must be one of: free, starter, pro, unlimited")

        return normalized