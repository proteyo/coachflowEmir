"""
Convert ORM models → Pydantic response schemas.
"""

import json
from datetime import datetime, timezone
from typing import Any

from app.models.attendance import Attendance
from app.models.client_invite import ClientInvite
from app.models.message import Message
from app.models.notification import NotificationSetting
from app.models.place import Place
from app.models.profile import ClientProfile, CoachProfile
from app.models.progress import ProgressEntry
from app.models.streak import Streak
from app.models.subscription import Subscription
from app.models.supplement import SupplementItem, SupplementLog, SupplementPlan
from app.models.user import User
from app.models.weekly_goal import WeeklyGoal
from app.models.workout import Exercise, WorkoutAssignment
from app.schemas.auth import UserOut
from app.schemas.other import (
    AttendanceOut,
    MessageOut,
    NotificationSettingOut,
    PlaceOut,
    ProgressEntryOut,
    StreakOut,
    SubscriptionOut,
    WeeklyGoalOut,
)
from app.schemas.profile import (
    ClientInviteOut,
    ClientProfileOut,
    ClientWithProfileOut,
    CoachProfileOut,
)
from app.schemas.supplement import SupplementItemOut, SupplementLogOut, SupplementPlanOut
from app.schemas.workout import ExerciseOut, WorkoutOut


ONLINE_THRESHOLD_SECONDS = 45


def to_iso(value: Any) -> str | None:
    """
    Converts datetime/date-like values to ISO string safely.
    """
    if value is None:
        return None

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return str(value)


def to_iso_required(value: Any) -> str:
    """
    Converts datetime/date-like values to ISO string.
    Returns empty string if value is missing.
    """
    return to_iso(value) or ""


def ensure_aware_datetime(value: datetime | None) -> datetime | None:
    """
    Makes datetime timezone-aware in UTC.

    Some databases can return naive datetime objects even when the column
    is defined as timezone-aware. This helper makes online/last seen logic safe.
    """
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def is_user_online(user: User) -> bool:
    """
    User is considered online if they made an authenticated request recently.

    45 seconds gives a realistic online/offline behavior with polling.
    """
    last_seen = ensure_aware_datetime(getattr(user, "last_seen_at", None))

    if not last_seen:
        return False

    now = datetime.now(tz=timezone.utc)
    diff_seconds = (now - last_seen).total_seconds()

    return 0 <= diff_seconds <= ONLINE_THRESHOLD_SECONDS


def parse_list(value: Any) -> list[str]:
    """
    Safely parses JSON list stored as string.

    Supports:
    - None
    - already existing Python list
    - JSON string list
    - simple string fallback
    """
    if value is None:
        return []

    if isinstance(value, list):
        return [str(item) for item in value]

    if not isinstance(value, str):
        return []

    if not value.strip():
        return []

    try:
        parsed = json.loads(value)

        if isinstance(parsed, list):
            return [str(item) for item in parsed]

        return []

    except Exception:
        return []


def to_optional_float(value: Any) -> float | None:
    if value is None:
        return None

    try:
        return float(value)
    except Exception:
        return None


def to_optional_int(value: Any) -> int | None:
    if value is None:
        return None

    try:
        return int(value)
    except Exception:
        return None


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        phone=user.phone,
        avatarUrl=user.avatar_url,
        clientCode=user.client_code,
        createdAt=to_iso_required(user.created_at),
        lastSeenAt=to_iso(getattr(user, "last_seen_at", None)),
        isOnline=is_user_online(user),
    )


def coach_profile_out(profile: CoachProfile) -> CoachProfileOut:
    return CoachProfileOut(
        userId=profile.user_id,
        specialty=profile.specialty,
        bio=profile.bio,
        experienceYears=profile.experience_years,
        achievements=parse_list(profile.achievements),
        certificates=parse_list(profile.certificates),
        rating=profile.rating,
        profileImageUrl=profile.profile_image_url,
        coverImageUrl=profile.cover_image_url,
    )


def client_profile_out(profile: ClientProfile) -> ClientProfileOut:
    return ClientProfileOut(
        userId=profile.user_id,
        coachId=profile.coach_id or "",
        goal=profile.goal,
        goalType=profile.goal_type,
        startWeight=profile.start_weight,
        currentWeight=profile.current_weight,
        height=profile.height,
        age=profile.age,
        fitnessLevel=profile.fitness_level,
        healthNotes=profile.health_notes,
        createdAt=to_iso_required(profile.created_at),
    )


def client_with_profile_out(user: User) -> ClientWithProfileOut:
    return ClientWithProfileOut(
        id=user.id,
        email=user.email,
        name=user.name,
        phone=user.phone,
        avatarUrl=user.avatar_url,
        clientCode=user.client_code,
        lastSeenAt=to_iso(getattr(user, "last_seen_at", None)),
        isOnline=is_user_online(user),
        profile=client_profile_out(user.client_profile) if user.client_profile else None,
    )


def exercise_out(exercise: Exercise) -> ExerciseOut:
    """
    Converts Exercise ORM model to API response.

    Uses getattr for new fields so the mapper stays safe during migration.
    After models.py and schemas/workout.py are updated, these fields will be
    returned normally.
    """
    return ExerciseOut(
        id=exercise.id,
        workoutId=exercise.workout_id,

        libraryExerciseId=getattr(exercise, "library_exercise_id", None),

        name=exercise.name,
        nameRu=getattr(exercise, "name_ru", None),
        nameKk=getattr(exercise, "name_kk", None),

        sets=exercise.sets,
        reps=exercise.reps,
        restSeconds=exercise.rest_seconds,
        weight=exercise.weight,

        notes=exercise.notes,
        notesRu=getattr(exercise, "notes_ru", None),
        notesKk=getattr(exercise, "notes_kk", None),

        imageUrl=exercise.image_url,
        gifUrl=getattr(exercise, "gif_url", None),
        animationFrames=parse_list(getattr(exercise, "animation_frames", None)),

        muscleGroup=exercise.muscle_group,
        tempo=getattr(exercise, "tempo", None),
        targetRpe=to_optional_float(getattr(exercise, "target_rpe", None)),
        order=to_optional_int(getattr(exercise, "order", None)),
    )


def workout_out(workout: WorkoutAssignment) -> WorkoutOut:
    """
    Converts WorkoutAssignment ORM model to API response.

    Includes multilingual weekly-plan fields so frontend can display workouts
    correctly in English, Russian and Kazakh after they are saved in backend.
    """
    exercises = list(workout.exercises or [])

    exercises.sort(
        key=lambda item: (
            to_optional_int(getattr(item, "order", None)) or 9999,
            item.id,
        )
    )

    return WorkoutOut(
        id=workout.id,
        coachId=workout.coach_id,
        clientId=workout.client_id,
        date=workout.date,
        time=workout.time,

        name=workout.name,
        nameRu=getattr(workout, "name_ru", None),
        nameKk=getattr(workout, "name_kk", None),

        description=workout.description,
        descriptionRu=getattr(workout, "description_ru", None),
        descriptionKk=getattr(workout, "description_kk", None),

        category=workout.category,
        categoryRu=getattr(workout, "category_ru", None),
        categoryKk=getattr(workout, "category_kk", None),

        completed=workout.completed,
        completedAt=to_iso(workout.completed_at),
        durationMinutes=workout.duration_minutes,

        source=getattr(workout, "source", None),
        weeklyPlanId=getattr(workout, "weekly_plan_id", None),
        weeklyPlanTitle=getattr(workout, "weekly_plan_title", None),
        weeklyPlanTitleRu=getattr(workout, "weekly_plan_title_ru", None),
        weeklyPlanTitleKk=getattr(workout, "weekly_plan_title_kk", None),
        weeklyPlanDayIndex=to_optional_int(
            getattr(workout, "weekly_plan_day_index", None)
        ),

        difficulty=getattr(workout, "difficulty", None),

        focus=getattr(workout, "focus", None),
        focusRu=getattr(workout, "focus_ru", None),
        focusKk=getattr(workout, "focus_kk", None),

        coachNotes=getattr(workout, "coach_notes", None),
        coachNotesRu=getattr(workout, "coach_notes_ru", None),
        coachNotesKk=getattr(workout, "coach_notes_kk", None),

        createdAt=to_iso(getattr(workout, "created_at", None)),

        exercises=[
            exercise_out(exercise)
            for exercise in exercises
        ],
    )


def supplement_item_out(item: SupplementItem) -> SupplementItemOut:
    return SupplementItemOut(
        id=item.id,
        planId=item.plan_id,
        name=item.name,
        dosage=item.dosage,
        timesPerDay=item.times_per_day,
        specificTimes=parse_list(item.specific_times),
        daysOfWeek=(
            parse_list(getattr(item, "days_of_week", None))
            or ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        ),
        notes=item.notes,
    )


def supplement_plan_out(plan: SupplementPlan) -> SupplementPlanOut:
    return SupplementPlanOut(
        id=plan.id,
        coachId=plan.coach_id,
        clientId=plan.client_id,
        startDate=plan.start_date,
        items=[
            supplement_item_out(item)
            for item in (plan.items or [])
        ],
    )


def supplement_log_out(log: SupplementLog) -> SupplementLogOut:
    return SupplementLogOut(
        id=log.id,
        clientId=log.client_id,
        supplementItemId=log.supplement_item_id,
        date=log.date,
        time=log.time,
        taken=log.taken,
    )


def progress_out(entry: ProgressEntry) -> ProgressEntryOut:
    return ProgressEntryOut(
        id=entry.id,
        clientId=entry.client_id,
        weight=entry.weight,
        date=entry.date,
        notes=entry.notes,
        addedBy=entry.added_by,
    )


def message_out(message: Message) -> MessageOut:
    return MessageOut(
        id=message.id,
        senderId=message.sender_id,
        receiverId=message.receiver_id,
        content=message.content,
        messageType=message.message_type,
        voiceUrl=message.voice_url,
        voiceDurationMs=message.voice_duration_ms,
        mediaUrl=getattr(message, "media_url", None),
        mediaType=getattr(message, "media_type", None),
        read=bool(message.read),
        deletedAt=to_iso(getattr(message, "deleted_at", None)),
        createdAt=to_iso_required(message.created_at),
    )


def weekly_goal_out(goal: WeeklyGoal) -> WeeklyGoalOut:
    return WeeklyGoalOut(
        id=goal.id,
        clientId=goal.client_id,
        weekStart=goal.week_start,
        targetMinutes=goal.target_minutes,
        completedMinutes=goal.completed_minutes,
        targetWorkouts=goal.target_workouts,
        completedWorkouts=goal.completed_workouts,
    )


def streak_out(streak: Streak) -> StreakOut:
    return StreakOut(
        clientId=streak.client_id,
        currentStreak=streak.current_streak,
        bestStreak=streak.best_streak,
        lastActivityDate=streak.last_activity_date,
    )


def attendance_out(attendance: Attendance) -> AttendanceOut:
    return AttendanceOut(
        id=attendance.id,
        clientId=attendance.client_id,
        coachId=attendance.coach_id,
        date=attendance.date,
        status=attendance.status,
        notes=attendance.notes,
    )


def place_out(place: Place) -> PlaceOut:
    return PlaceOut(
        id=place.id,
        type=place.type,
        name=place.name,
        address=place.address,
        latitude=place.latitude,
        longitude=place.longitude,
        description=place.description,
        imageUrl=place.image_url,
        rating=place.rating,
    )


def notification_out(settings: NotificationSetting) -> NotificationSettingOut:
    return NotificationSettingOut(
        userId=settings.user_id,
        workoutReminders=settings.workout_reminders,
        supplementReminders=settings.supplement_reminders,
        messageNotifications=settings.message_notifications,
        weeklyGoalReminders=settings.weekly_goal_reminders,
    )


def subscription_out(subscription: Subscription) -> SubscriptionOut:
    """
    Converts Subscription ORM model to safe API response.

    Important:
    - Does NOT expose google_purchase_token_hash.
    - Does NOT expose google_raw_response.
    """

    return SubscriptionOut(
        id=subscription.id,
        coachId=subscription.coach_id,
        planCode=getattr(subscription, "plan_code", "free") or "free",
        planName=getattr(subscription, "plan_name", "Free Trial") or "Free Trial",
        price=getattr(subscription, "price", 0) or 0,
        currency=getattr(subscription, "currency", "KZT") or "KZT",
        clientLimit=getattr(subscription, "client_limit", 3) or 3,
        status=getattr(subscription, "status", "inactive") or "inactive",
        startDate=to_iso(getattr(subscription, "start_date", None)),
        endDate=to_iso(getattr(subscription, "end_date", None)),
        googleProductId=getattr(subscription, "google_product_id", None),
        googleSubscriptionState=getattr(
            subscription,
            "google_subscription_state",
            None,
        ),
        googleAcknowledged=bool(
            getattr(subscription, "google_acknowledged", 0)
        ),
        lastVerifiedAt=to_iso(
            getattr(subscription, "last_verified_at", None)
        ),
        createdAt=to_iso_required(getattr(subscription, "created_at", None)),
        updatedAt=to_iso(
            getattr(subscription, "updated_at", None)
        ),
        cancelledAt=to_iso(
            getattr(subscription, "cancelled_at", None)
        ),
    )


def client_invite_out(invite: ClientInvite) -> ClientInviteOut:
    return ClientInviteOut(
        id=invite.id,
        coachId=invite.coach_id,
        clientId=invite.client_id,
        email=invite.email,
        status=invite.status,
        createdAt=to_iso_required(invite.created_at),
        expiresAt=to_iso_required(invite.expires_at),
        respondedAt=to_iso(invite.responded_at),
        coachName=invite.coach.name if invite.coach else None,
        clientName=invite.client.name if invite.client else None,
    )