from typing import Optional

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
    content: str
    message_type: str = "text"
    voice_url: Optional[str] = None
    voice_duration_ms: Optional[int] = None

    @field_validator("content")
    @classmethod
    def content_valid(cls, value: str) -> str:
        cleaned = value.strip()

        if not cleaned and not value:
            raise ValueError("content is required")

        if len(cleaned) > 5000:
            raise ValueError("content is too long")

        return cleaned

    @field_validator("message_type")
    @classmethod
    def message_type_valid(cls, value: str) -> str:
        allowed = {"text", "voice"}

        if value not in allowed:
            raise ValueError("message_type must be text or voice")

        return value


class MessageOut(BaseModel):
    id: str
    senderId: str
    receiverId: Optional[str] = None
    content: str
    messageType: str
    voiceUrl: Optional[str] = None
    voiceDurationMs: Optional[int] = None
    read: bool
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