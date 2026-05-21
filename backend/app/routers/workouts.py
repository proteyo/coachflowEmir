"""
GET    /workouts                      — list workouts (coach: all mine; client: own)
POST   /workouts                      — create manually (coach only + active subscription)
POST   /workouts/assign-weekly-plan   — assign weekly training plan to client
GET    /workouts/{id}                 — get single
PATCH  /workouts/{id}                 — update (coach + active subscription)
DELETE /workouts/{id}                 — delete (coach + active subscription)
POST   /workouts/{id}/complete        — mark complete (client)
"""

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_active_coach_subscription
from app.db.database import get_db
from app.models.profile import ClientProfile
from app.models.user import User
from app.models.workout import Exercise, WorkoutAssignment
from app.schemas.workout import (
    AssignWeeklyPlanOut,
    WorkoutIn,
    WorkoutOut,
    WorkoutUpdate,
)
from app.services.mappers import workout_out

router = APIRouter(prefix="/workouts", tags=["Workouts"])


class AssignWeeklyPlanRequest(BaseModel):
    """
    Request body for assigning a weekly plan.

    Important:
    - plan_id is stored for history.
    - plan is the selected full template from frontend.
    - Backend saves generated workouts/exercises into the database.
    """

    client_id: str | None = None
    clientId: str | None = None

    plan_id: str | None = None
    planId: str | None = None

    start_date: str | None = None
    startDate: str | None = None

    plan: dict[str, Any] = Field(default_factory=dict)


def _now():
    return datetime.now(tz=timezone.utc)


def _new_workout_id() -> str:
    return f"w_{uuid.uuid4().hex[:12]}"


def _new_exercise_id() -> str:
    return f"ex_{uuid.uuid4().hex[:12]}"


def _get_value(data: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in data and data[key] is not None:
            return data[key]

    return default


def _to_string_or_none(value: Any) -> str | None:
    if value is None:
        return None

    text = str(value).strip()

    return text or None


def _to_int(value: Any, fallback: int) -> int:
    try:
        number = int(value)

        return number
    except Exception:
        return fallback


def _to_float_or_none(value: Any) -> float | None:
    if value is None:
        return None

    try:
        return float(value)
    except Exception:
        return None


def _to_json_list(value: Any) -> str | None:
    if value is None:
        return None

    if isinstance(value, list):
        return json.dumps([str(item) for item in value], ensure_ascii=False)

    if isinstance(value, str):
        text = value.strip()

        if not text:
            return None

        try:
            parsed = json.loads(text)

            if isinstance(parsed, list):
                return json.dumps([str(item) for item in parsed], ensure_ascii=False)

            return None
        except Exception:
            return json.dumps([text], ensure_ascii=False)

    return None


def _parse_date_key(date_key: str) -> datetime:
    try:
        return datetime.strptime(date_key, "%Y-%m-%d")
    except Exception:
        return datetime.now()


def _add_days_to_date_key(date_key: str, days: int) -> str:
    base = _parse_date_key(date_key)

    return (base + timedelta(days=days)).strftime("%Y-%m-%d")


def _normalize_plan_id(data: AssignWeeklyPlanRequest) -> str:
    plan_id = data.plan_id or data.planId or _get_value(data.plan, "id")

    if not plan_id:
        raise HTTPException(status_code=400, detail="plan_id is required")

    return str(plan_id)


def _normalize_client_id(data: AssignWeeklyPlanRequest) -> str:
    client_id = data.client_id or data.clientId

    if not client_id:
        raise HTTPException(status_code=400, detail="client_id is required")

    return str(client_id)


def _normalize_start_date(data: AssignWeeklyPlanRequest) -> str:
    value = data.start_date or data.startDate

    if value:
        return str(value)

    return datetime.now().strftime("%Y-%m-%d")


def _extract_days(plan: dict[str, Any]) -> list[dict[str, Any]]:
    days = _get_value(plan, "days", default=[])

    if not isinstance(days, list) or not days:
        raise HTTPException(
            status_code=400,
            detail="plan.days must contain at least one workout day",
        )

    valid_days: list[dict[str, Any]] = []

    for day in days:
        if isinstance(day, dict):
            exercises = _get_value(day, "exercises", default=[])

            if isinstance(exercises, list) and exercises:
                valid_days.append(day)

    if not valid_days:
        raise HTTPException(
            status_code=400,
            detail="weekly plan must contain exercises",
        )

    return valid_days


async def _verify_coach_client(coach_id: str, client_id: str, db: AsyncSession):
    res = await db.execute(
        select(ClientProfile).where(
            ClientProfile.user_id == client_id,
            ClientProfile.coach_id == coach_id,
        )
    )

    if not res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Client is not linked to you")


async def _get_workout(workout_id: str, db: AsyncSession) -> WorkoutAssignment:
    res = await db.execute(
        select(WorkoutAssignment)
        .where(WorkoutAssignment.id == workout_id)
        .options(selectinload(WorkoutAssignment.exercises))
    )

    workout = res.scalar_one_or_none()

    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    return workout


def _build_exercise_from_input(
    exercise: Any,
    workout_id: str,
    index: int,
) -> Exercise:
    return Exercise(
        id=exercise.id or _new_exercise_id(),
        workout_id=workout_id,

        library_exercise_id=getattr(exercise, "library_exercise_id", None),

        name=exercise.name,
        name_ru=getattr(exercise, "name_ru", None),
        name_kk=getattr(exercise, "name_kk", None),

        sets=exercise.sets,
        reps=exercise.reps,
        rest_seconds=exercise.rest_seconds,

        weight=exercise.weight,

        notes=exercise.notes,
        notes_ru=getattr(exercise, "notes_ru", None),
        notes_kk=getattr(exercise, "notes_kk", None),

        image_url=exercise.image_url,
        gif_url=getattr(exercise, "gif_url", None),
        animation_frames=_to_json_list(
            getattr(exercise, "animation_frames", None)
        ),

        muscle_group=exercise.muscle_group,

        tempo=getattr(exercise, "tempo", None),
        target_rpe=getattr(exercise, "target_rpe", None),
        order=getattr(exercise, "order", None) or index + 1,
    )


def _build_exercise_from_template(
    exercise: dict[str, Any],
    workout_id: str,
    index: int,
) -> Exercise:
    library_exercise_id = _get_value(
        exercise,
        "exerciseId",
        "exercise_id",
        "libraryExerciseId",
        "library_exercise_id",
    )

    return Exercise(
        id=_to_string_or_none(_get_value(exercise, "id")) or _new_exercise_id(),
        workout_id=workout_id,

        library_exercise_id=_to_string_or_none(library_exercise_id),

        name=_to_string_or_none(_get_value(exercise, "name")) or "Exercise",
        name_ru=_to_string_or_none(_get_value(exercise, "nameRu", "name_ru")),
        name_kk=_to_string_or_none(_get_value(exercise, "nameKk", "name_kk")),

        sets=max(1, _to_int(_get_value(exercise, "sets"), 3)),
        reps=max(1, _to_int(_get_value(exercise, "reps"), 10)),
        rest_seconds=max(
            0,
            _to_int(_get_value(exercise, "restSeconds", "rest_seconds"), 60),
        ),

        weight=_to_float_or_none(_get_value(exercise, "weight")),

        notes=_to_string_or_none(_get_value(exercise, "notes")),
        notes_ru=_to_string_or_none(_get_value(exercise, "notesRu", "notes_ru")),
        notes_kk=_to_string_or_none(_get_value(exercise, "notesKk", "notes_kk")),

        image_url=_to_string_or_none(_get_value(exercise, "imageUrl", "image_url")),
        gif_url=_to_string_or_none(_get_value(exercise, "gifUrl", "gif_url")),
        animation_frames=_to_json_list(
            _get_value(exercise, "animationFrames", "animation_frames")
        ),

        muscle_group=_to_string_or_none(
            _get_value(exercise, "muscleGroup", "muscle_group")
        ),

        tempo=_to_string_or_none(_get_value(exercise, "tempo")),
        target_rpe=_to_float_or_none(
            _get_value(exercise, "targetRpe", "target_rpe")
        ),
        order=_to_int(_get_value(exercise, "order"), index + 1),
    )


def _build_workout_from_template_day(
    *,
    coach_id: str,
    client_id: str,
    plan_id: str,
    plan: dict[str, Any],
    day: dict[str, Any],
    day_index: int,
    start_date: str,
) -> WorkoutAssignment:
    day_offset = _to_int(
        _get_value(day, "dayOffset", "day_offset", "day"),
        day_index * 2,
    )

    date_key = _add_days_to_date_key(start_date, day_offset)

    plan_title = _to_string_or_none(_get_value(plan, "title")) or "Weekly Plan"
    plan_title_ru = _to_string_or_none(_get_value(plan, "titleRu", "title_ru"))
    plan_title_kk = _to_string_or_none(_get_value(plan, "titleKk", "title_kk"))

    goal_label = _to_string_or_none(_get_value(plan, "goalLabel", "goal_label"))
    goal_label_ru = _to_string_or_none(
        _get_value(plan, "goalLabelRu", "goal_label_ru")
    )
    goal_label_kk = _to_string_or_none(
        _get_value(plan, "goalLabelKk", "goal_label_kk")
    )

    description = _to_string_or_none(_get_value(day, "description"))
    description_ru = _to_string_or_none(
        _get_value(day, "descriptionRu", "description_ru")
    )
    description_kk = _to_string_or_none(
        _get_value(day, "descriptionKk", "description_kk")
    )

    plan_description = _to_string_or_none(_get_value(plan, "description"))
    plan_description_ru = _to_string_or_none(
        _get_value(plan, "descriptionRu", "description_ru")
    )
    plan_description_kk = _to_string_or_none(
        _get_value(plan, "descriptionKk", "description_kk")
    )

    coach_analysis = _to_string_or_none(_get_value(plan, "coachAnalysis", "coach_analysis"))
    coach_analysis_ru = _to_string_or_none(
        _get_value(plan, "coachAnalysisRu", "coach_analysis_ru")
    )
    coach_analysis_kk = _to_string_or_none(
        _get_value(plan, "coachAnalysisKk", "coach_analysis_kk")
    )

    full_description = "\n\n".join(
        [text for text in [description, plan_description] if text]
    ) or None

    full_description_ru = "\n\n".join(
        [text for text in [description_ru, plan_description_ru] if text]
    ) or None

    full_description_kk = "\n\n".join(
        [text for text in [description_kk, plan_description_kk] if text]
    ) or None

    return WorkoutAssignment(
        id=_new_workout_id(),

        coach_id=coach_id,
        client_id=client_id,

        date=date_key,
        time=_to_string_or_none(_get_value(day, "time")) or "18:00",

        name=_to_string_or_none(_get_value(day, "name")) or f"{plan_title} · Day {day_index + 1}",
        name_ru=_to_string_or_none(_get_value(day, "nameRu", "name_ru")),
        name_kk=_to_string_or_none(_get_value(day, "nameKk", "name_kk")),

        description=full_description,
        description_ru=full_description_ru,
        description_kk=full_description_kk,

        category=_to_string_or_none(_get_value(day, "category")) or goal_label,
        category_ru=_to_string_or_none(_get_value(day, "categoryRu", "category_ru")) or goal_label_ru,
        category_kk=_to_string_or_none(_get_value(day, "categoryKk", "category_kk")) or goal_label_kk,

        completed=False,
        completed_at=None,

        duration_minutes=_to_int(
            _get_value(day, "durationMinutes", "duration_minutes"),
            _to_int(
                _get_value(
                    plan,
                    "estimatedMinutesPerSession",
                    "estimated_minutes_per_session",
                ),
                60,
            ),
        ),

        source="weekly_template",

        weekly_plan_id=plan_id,
        weekly_plan_title=plan_title,
        weekly_plan_title_ru=plan_title_ru,
        weekly_plan_title_kk=plan_title_kk,
        weekly_plan_day_index=day_index,

        difficulty=_to_string_or_none(_get_value(plan, "level")),

        focus=goal_label,
        focus_ru=goal_label_ru,
        focus_kk=goal_label_kk,

        coach_notes=coach_analysis,
        coach_notes_ru=coach_analysis_ru,
        coach_notes_kk=coach_analysis_kk,
    )


@router.get("", response_model=list[WorkoutOut])
async def list_workouts(
    client_id: str | None = None,
    date: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(WorkoutAssignment).options(
        selectinload(WorkoutAssignment.exercises)
    )

    if current_user.role == "coach":
        query = query.where(WorkoutAssignment.coach_id == current_user.id)

        if client_id:
            query = query.where(WorkoutAssignment.client_id == client_id)
    else:
        query = query.where(WorkoutAssignment.client_id == current_user.id)

    if date:
        query = query.where(WorkoutAssignment.date == date)

    query = query.order_by(WorkoutAssignment.date.desc(), WorkoutAssignment.time.asc())

    res = await db.execute(query)

    return [workout_out(workout) for workout in res.scalars().all()]


@router.post("", response_model=WorkoutOut, status_code=201)
async def create_workout(
    data: WorkoutIn,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    await _verify_coach_client(coach.id, data.client_id, db)

    workout_id = _new_workout_id()

    workout = WorkoutAssignment(
        id=workout_id,
        coach_id=coach.id,
        client_id=data.client_id,

        date=data.date,
        time=data.time,

        name=data.name,
        name_ru=data.name_ru,
        name_kk=data.name_kk,

        description=data.description,
        description_ru=data.description_ru,
        description_kk=data.description_kk,

        category=data.category,
        category_ru=data.category_ru,
        category_kk=data.category_kk,

        duration_minutes=data.duration_minutes,
        completed=False,

        source=data.source or "manual",

        weekly_plan_id=data.weekly_plan_id,
        weekly_plan_title=data.weekly_plan_title,
        weekly_plan_title_ru=data.weekly_plan_title_ru,
        weekly_plan_title_kk=data.weekly_plan_title_kk,
        weekly_plan_day_index=data.weekly_plan_day_index,

        difficulty=data.difficulty,

        focus=data.focus,
        focus_ru=data.focus_ru,
        focus_kk=data.focus_kk,

        coach_notes=data.coach_notes,
        coach_notes_ru=data.coach_notes_ru,
        coach_notes_kk=data.coach_notes_kk,
    )

    db.add(workout)

    for index, exercise in enumerate(data.exercises):
        db.add(_build_exercise_from_input(exercise, workout_id, index))

    await db.commit()

    return workout_out(await _get_workout(workout_id, db))


@router.post("/assign-weekly-plan", response_model=AssignWeeklyPlanOut, status_code=201)
async def assign_weekly_plan(
    data: AssignWeeklyPlanRequest,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    client_id = _normalize_client_id(data)
    plan_id = _normalize_plan_id(data)
    start_date = _normalize_start_date(data)

    if not data.plan:
        raise HTTPException(
            status_code=400,
            detail="plan payload is required. Frontend must send the selected weekly plan object.",
        )

    await _verify_coach_client(coach.id, client_id, db)

    plan = data.plan
    days = _extract_days(plan)

    created_workout_ids: list[str] = []
    created_exercise_ids: list[str] = []
    created_workouts: list[WorkoutAssignment] = []

    for day_index, day in enumerate(days):
        workout = _build_workout_from_template_day(
            coach_id=coach.id,
            client_id=client_id,
            plan_id=plan_id,
            plan=plan,
            day=day,
            day_index=day_index,
            start_date=start_date,
        )

        db.add(workout)

        exercises = _get_value(day, "exercises", default=[])

        for exercise_index, exercise_data in enumerate(exercises):
            if not isinstance(exercise_data, dict):
                continue

            exercise = _build_exercise_from_template(
                exercise=exercise_data,
                workout_id=workout.id,
                index=exercise_index,
            )

            db.add(exercise)
            created_exercise_ids.append(exercise.id)

        created_workout_ids.append(workout.id)
        created_workouts.append(workout)

    await db.commit()

    loaded_workouts: list[WorkoutOut] = []

    for workout_id in created_workout_ids:
        loaded_workouts.append(workout_out(await _get_workout(workout_id, db)))

    return AssignWeeklyPlanOut(
        workoutIds=created_workout_ids,
        exerciseIds=created_exercise_ids,
        workouts=loaded_workouts,
    )


@router.get("/{workout_id}", response_model=WorkoutOut)
async def get_workout(
    workout_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workout = await _get_workout(workout_id, db)

    if current_user.role == "coach" and workout.coach_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if current_user.role == "client" and workout.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return workout_out(workout)


@router.patch("/{workout_id}", response_model=WorkoutOut)
async def update_workout(
    workout_id: str,
    data: WorkoutUpdate,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    workout = await _get_workout(workout_id, db)

    if workout.coach_id != coach.id:
        raise HTTPException(status_code=403, detail="Access denied")

    for field in (
        "date",
        "time",

        "name",
        "name_ru",
        "name_kk",

        "description",
        "description_ru",
        "description_kk",

        "category",
        "category_ru",
        "category_kk",

        "duration_minutes",
        "completed",

        "source",

        "weekly_plan_id",
        "weekly_plan_title",
        "weekly_plan_title_ru",
        "weekly_plan_title_kk",
        "weekly_plan_day_index",

        "difficulty",

        "focus",
        "focus_ru",
        "focus_kk",

        "coach_notes",
        "coach_notes_ru",
        "coach_notes_kk",
    ):
        value = getattr(data, field, None)

        if value is not None:
            setattr(workout, field, value)

    if data.exercises is not None:
        for exercise in list(workout.exercises):
            await db.delete(exercise)

        for index, exercise in enumerate(data.exercises):
            db.add(_build_exercise_from_input(exercise, workout_id, index))

    db.add(workout)

    await db.commit()

    return workout_out(await _get_workout(workout_id, db))


@router.delete("/{workout_id}", status_code=204)
async def delete_workout(
    workout_id: str,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    workout = await _get_workout(workout_id, db)

    if workout.coach_id != coach.id:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(workout)
    await db.commit()


@router.post("/{workout_id}/complete", response_model=WorkoutOut)
async def complete_workout(
    workout_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workout = await _get_workout(workout_id, db)

    if workout.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    workout.completed = True
    workout.completed_at = _now()

    db.add(workout)

    await db.commit()

    return workout_out(await _get_workout(workout_id, db))