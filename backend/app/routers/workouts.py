"""
GET    /workouts                — list workouts (coach: all mine; client: own)
POST   /workouts                — create (coach only + active subscription)
GET    /workouts/{id}           — get single
PATCH  /workouts/{id}           — update (coach + active subscription)
DELETE /workouts/{id}           — delete (coach + active subscription)
POST   /workouts/{id}/complete  — mark complete (client)
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_active_coach_subscription
from app.db.database import get_db
from app.models.profile import ClientProfile
from app.models.user import User
from app.models.workout import Exercise, WorkoutAssignment
from app.schemas.workout import WorkoutIn, WorkoutOut, WorkoutUpdate
from app.services.mappers import workout_out

router = APIRouter(prefix="/workouts", tags=["Workouts"])


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

    query = query.order_by(WorkoutAssignment.date.desc())

    res = await db.execute(query)

    return [workout_out(workout) for workout in res.scalars().all()]


@router.post("", response_model=WorkoutOut, status_code=201)
async def create_workout(
    data: WorkoutIn,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    await _verify_coach_client(coach.id, data.client_id, db)

    workout_id = f"w_{uuid.uuid4().hex[:12]}"

    workout = WorkoutAssignment(
        id=workout_id,
        coach_id=coach.id,
        client_id=data.client_id,
        date=data.date,
        time=data.time,
        name=data.name,
        description=data.description,
        category=data.category,
        duration_minutes=data.duration_minutes,
        completed=False,
    )

    db.add(workout)

    for exercise in data.exercises:
        db.add(
            Exercise(
                id=exercise.id or f"ex_{uuid.uuid4().hex[:12]}",
                workout_id=workout_id,
                name=exercise.name,
                sets=exercise.sets,
                reps=exercise.reps,
                rest_seconds=exercise.rest_seconds,
                weight=exercise.weight,
                notes=exercise.notes,
                image_url=exercise.image_url,
                muscle_group=exercise.muscle_group,
            )
        )

    await db.commit()

    return workout_out(await _get_workout(workout_id, db))


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
        "description",
        "category",
        "duration_minutes",
        "completed",
    ):
        value = getattr(data, field, None)

        if value is not None:
            setattr(workout, field, value)

    if data.exercises is not None:
        for exercise in list(workout.exercises):
            await db.delete(exercise)

        for exercise in data.exercises:
            db.add(
                Exercise(
                    id=exercise.id or f"ex_{uuid.uuid4().hex[:12]}",
                    workout_id=workout_id,
                    name=exercise.name,
                    sets=exercise.sets,
                    reps=exercise.reps,
                    rest_seconds=exercise.rest_seconds,
                    weight=exercise.weight,
                    notes=exercise.notes,
                    image_url=exercise.image_url,
                    muscle_group=exercise.muscle_group,
                )
            )

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
    workout.completed_at = datetime.now(tz=timezone.utc)

    db.add(workout)

    await db.commit()

    return workout_out(await _get_workout(workout_id, db))