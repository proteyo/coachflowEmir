from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_active_coach_subscription
from app.db.database import get_db
from app.models.exercise_result import ExerciseResult
from app.models.profile import ClientProfile
from app.models.user import User
from app.models.workout import Exercise, WorkoutAssignment
from app.schemas.exercise_result import (
    ExerciseLatestResultOut,
    ExerciseResultBulkIn,
    ExerciseResultIn,
    ExerciseResultOut,
)

router = APIRouter(prefix="/exercise-results", tags=["Exercise Results"])


def result_out(result: ExerciseResult) -> ExerciseResultOut:
    return ExerciseResultOut(
        id=result.id,
        clientId=result.client_id,
        coachId=result.coach_id,
        workoutId=result.workout_id,
        exerciseId=result.exercise_id,
        exerciseName=result.exercise_name,
        muscleGroup=result.muscle_group,
        setNumber=result.set_number,
        targetReps=result.target_reps,
        actualReps=result.actual_reps,
        weight=result.weight,
        notes=result.notes,
        createdAt=result.created_at.isoformat(),
    )


async def ensure_coach_subscription_if_needed(
    current_user: User,
    db: AsyncSession,
) -> None:
    """
    If current user is coach, require active subscription.
    Clients are not checked here because subscription belongs to coach accounts.
    """
    if current_user.role == "coach":
        await require_active_coach_subscription(current_user, db)


async def verify_coach_client(
    coach_id: str,
    client_id: str,
    db: AsyncSession,
) -> None:
    res = await db.execute(
        select(ClientProfile).where(
            ClientProfile.user_id == client_id,
            ClientProfile.coach_id == coach_id,
        )
    )

    if not res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Client is not linked to you")


async def get_workout_or_404(
    workout_id: str,
    db: AsyncSession,
) -> WorkoutAssignment:
    res = await db.execute(
        select(WorkoutAssignment).where(WorkoutAssignment.id == workout_id)
    )

    workout = res.scalar_one_or_none()

    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    return workout


async def get_exercise_or_none(
    exercise_id: str | None,
    db: AsyncSession,
):
    if not exercise_id:
        return None

    res = await db.execute(select(Exercise).where(Exercise.id == exercise_id))

    return res.scalar_one_or_none()


async def create_result_from_payload(
    data: ExerciseResultIn,
    current_user: User,
    db: AsyncSession,
) -> ExerciseResult:
    workout = await get_workout_or_404(data.workout_id, db)

    if current_user.role == "client":
        if workout.client_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    elif current_user.role == "coach":
        await ensure_coach_subscription_if_needed(current_user, db)

        if workout.coach_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        await verify_coach_client(current_user.id, workout.client_id, db)

    else:
        raise HTTPException(status_code=403, detail="Access denied")

    exercise = await get_exercise_or_none(data.exercise_id, db)

    if exercise and exercise.workout_id != workout.id:
        raise HTTPException(
            status_code=400,
            detail="Exercise does not belong to this workout",
        )

    return ExerciseResult(
        client_id=workout.client_id,
        coach_id=workout.coach_id,
        workout_id=workout.id,
        exercise_id=data.exercise_id,
        exercise_name=data.exercise_name.strip(),
        muscle_group=data.muscle_group,
        set_number=data.set_number,
        target_reps=data.target_reps,
        actual_reps=data.actual_reps,
        weight=data.weight,
        notes=data.notes,
    )


@router.post("", response_model=ExerciseResultOut, status_code=201)
async def create_result(
    data: ExerciseResultIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates one exercise result.

    Client:
    - Can create results only for own workouts.

    Coach:
    - Can create results only for linked clients and only with active subscription.
    """
    result = await create_result_from_payload(data, current_user, db)

    db.add(result)
    await db.commit()
    await db.refresh(result)

    return result_out(result)


@router.post("/bulk", response_model=list[ExerciseResultOut], status_code=201)
async def create_results_bulk(
    data: ExerciseResultBulkIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates multiple exercise results.

    Client:
    - Can create results only for own workouts.

    Coach:
    - Can create results only for linked clients and only with active subscription.
    """
    if not data.results:
        return []

    created: list[ExerciseResult] = []

    for item in data.results:
        result = await create_result_from_payload(item, current_user, db)
        db.add(result)
        created.append(result)

    await db.commit()

    for item in created:
        await db.refresh(item)

    return [result_out(result) for result in created]


@router.get("", response_model=list[ExerciseResultOut])
async def list_results(
    client_id: str | None = None,
    workout_id: str | None = None,
    exercise_name: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists exercise results.

    Client:
    - Can see only own results.

    Coach:
    - Can see linked client results only with active subscription.
    """
    query = select(ExerciseResult)

    if current_user.role == "client":
        query = query.where(ExerciseResult.client_id == current_user.id)

    elif current_user.role == "coach":
        await ensure_coach_subscription_if_needed(current_user, db)

        query = query.where(ExerciseResult.coach_id == current_user.id)

        if client_id:
            await verify_coach_client(current_user.id, client_id, db)
            query = query.where(ExerciseResult.client_id == client_id)

    else:
        raise HTTPException(status_code=403, detail="Access denied")

    if workout_id:
        query = query.where(ExerciseResult.workout_id == workout_id)

    if exercise_name:
        query = query.where(
            ExerciseResult.exercise_name.ilike(f"%{exercise_name}%")
        )

    query = query.order_by(
        ExerciseResult.created_at.desc(),
        ExerciseResult.set_number.asc(),
    )

    res = await db.execute(query)

    return [result_out(result) for result in res.scalars().all()]


@router.get("/latest", response_model=ExerciseLatestResultOut | None)
async def get_latest_result(
    client_id: str,
    exercise_name: str,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    """
    Coach can get latest client exercise result only with active subscription.
    """
    await verify_coach_client(coach.id, client_id, db)

    res = await db.execute(
        select(ExerciseResult)
        .where(
            ExerciseResult.coach_id == coach.id,
            ExerciseResult.client_id == client_id,
            ExerciseResult.exercise_name == exercise_name,
        )
        .order_by(ExerciseResult.created_at.desc())
    )

    rows = res.scalars().all()

    if not rows:
        return None

    latest_workout_id = rows[0].workout_id
    latest_created_at = rows[0].created_at

    latest_sets = [
        result
        for result in rows
        if result.workout_id == latest_workout_id
        and result.created_at.date() == latest_created_at.date()
    ]

    latest_sets.sort(key=lambda item: item.set_number)

    return ExerciseLatestResultOut(
        exerciseName=rows[0].exercise_name,
        muscleGroup=rows[0].muscle_group,
        workoutId=latest_workout_id,
        createdAt=latest_created_at.isoformat(),
        sets=[result_out(result) for result in latest_sets],
    )


@router.get("/client/{client_id}/history", response_model=list[ExerciseLatestResultOut])
async def get_client_exercise_history(
    client_id: str,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    """
    Coach can get linked client exercise history only with active subscription.
    """
    await verify_coach_client(coach.id, client_id, db)

    res = await db.execute(
        select(ExerciseResult)
        .where(
            ExerciseResult.coach_id == coach.id,
            ExerciseResult.client_id == client_id,
        )
        .order_by(
            ExerciseResult.exercise_name.asc(),
            ExerciseResult.created_at.desc(),
            ExerciseResult.set_number.asc(),
        )
    )

    rows = res.scalars().all()

    grouped: dict[str, list[ExerciseResult]] = defaultdict(list)

    for result in rows:
        grouped[result.exercise_name].append(result)

    output: list[ExerciseLatestResultOut] = []

    for exercise_name, items in grouped.items():
        latest_workout_id = items[0].workout_id
        latest_created_at = items[0].created_at

        latest_sets = [
            result
            for result in items
            if result.workout_id == latest_workout_id
            and result.created_at.date() == latest_created_at.date()
        ]

        latest_sets.sort(key=lambda item: item.set_number)

        output.append(
            ExerciseLatestResultOut(
                exerciseName=exercise_name,
                muscleGroup=items[0].muscle_group,
                workoutId=latest_workout_id,
                createdAt=latest_created_at.isoformat(),
                sets=[result_out(result) for result in latest_sets],
            )
        )

    return output