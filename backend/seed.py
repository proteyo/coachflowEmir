"""
CoachFlow — production-safe seed script.

This script creates demo coach, demo clients and sample data.

Production safety:
- The script DOES NOT run unless ALLOW_DATABASE_SEED=true is set.
- Demo credentials can be overridden through environment variables.
- Subscription is created with explicit plan_code and client_limit.

Run:
  Windows PowerShell:
    $env:ALLOW_DATABASE_SEED="true"
    python seed.py

  Linux/Mac:
    ALLOW_DATABASE_SEED=true python seed.py
"""

import asyncio
import json
import os
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.core.security import hash_password
from app.db.base import Base
from app.db.database import AsyncSessionLocal, engine
from app.models.attendance import Attendance
from app.models.notification import NotificationSetting
from app.models.place import Place
from app.models.profile import ClientProfile, CoachProfile
from app.models.progress import ProgressEntry
from app.models.streak import Streak
from app.models.subscription import Subscription
from app.models.user import User
from app.models.weekly_goal import WeeklyGoal
from app.models.workout import Exercise, WorkoutAssignment


def uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def iso_date(days_ago: int = 0) -> str:
    return (date.today() - timedelta(days=days_ago)).isoformat()


def get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name, default)

    if value is None:
        return None

    value = value.strip()

    return value or None


def get_bool_env(name: str, default: bool = False) -> bool:
    value = get_env(name)

    if value is None:
        return default

    return value.lower() in {"1", "true", "yes", "on"}


def require_seed_allowed() -> None:
    if not get_bool_env("ALLOW_DATABASE_SEED", False):
        raise RuntimeError(
            "Database seed is disabled. "
            "Set ALLOW_DATABASE_SEED=true only when you intentionally want to seed the database."
        )


async def create_tables_if_allowed() -> None:
    """
    For the current project stage this is acceptable because the backend still uses
    Base.metadata.create_all during early deployment.

    Later, when Alembic migrations are added, this function can be removed and the
    production database should be migrated before running seed.py.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def seed() -> None:
    require_seed_allowed()

    coach_email = get_env("SEED_COACH_EMAIL", "coach@coachflow.kz")
    coach_password = get_env("SEED_COACH_PASSWORD", "coach123")

    client_1_email = get_env("SEED_CLIENT_1_EMAIL", "aigul@example.com")
    client_1_password = get_env("SEED_CLIENT_1_PASSWORD", "client123")

    client_2_email = get_env("SEED_CLIENT_2_EMAIL", "damir@example.com")
    client_2_password = get_env("SEED_CLIENT_2_PASSWORD", "client123")

    if not coach_email or not coach_password:
        raise RuntimeError("SEED_COACH_EMAIL and SEED_COACH_PASSWORD are required.")

    if not client_1_email or not client_1_password:
        raise RuntimeError("SEED_CLIENT_1_EMAIL and SEED_CLIENT_1_PASSWORD are required.")

    if not client_2_email or not client_2_password:
        raise RuntimeError("SEED_CLIENT_2_EMAIL and SEED_CLIENT_2_PASSWORD are required.")

    await create_tables_if_allowed()

    async with AsyncSessionLocal() as db:
        existing_coach = await db.execute(
            select(User).where(User.email == coach_email)
        )

        if existing_coach.scalar_one_or_none():
            print("✅ Database is already seeded — skipping.")
            return

        print("🌱 Seeding CoachFlow database...")

        coach_id = uid("u")

        coach = User(
            id=coach_id,
            email=coach_email,
            password_hash=hash_password(coach_password),
            name="Алексей Тренер",
            role="coach",
            phone="+77001234567",
            created_at=now_utc(),
        )

        db.add(coach)

        db.add(
            CoachProfile(
                user_id=coach_id,
                specialty="Персональный тренинг",
                bio=(
                    "10 лет опыта в фитнесе. Специализируюсь на наборе "
                    "мышечной массы, похудении и долгосрочном сопровождении клиентов."
                ),
                experience_years=10,
                achievements=json.dumps(
                    [
                        "Мастер спорта по пауэрлифтингу",
                        "Сертифицированный нутрициолог",
                    ],
                    ensure_ascii=False,
                ),
                certificates=json.dumps(
                    [
                        "NSCA-CPT",
                        "Precision Nutrition L1",
                    ],
                    ensure_ascii=False,
                ),
                rating=4.9,
            )
        )

        db.add(
            Subscription(
                id=uid("sub"),
                coach_id=coach_id,
                plan_code="pro",
                plan_name="Pro",
                price=4990,
                currency="KZT",
                status="active",
                client_limit=30,
                start_date=now_utc(),
                end_date=now_utc() + timedelta(days=30),
                created_at=now_utc(),
            )
        )

        db.add(NotificationSetting(user_id=coach_id))

        clients_data = [
            {
                "name": "Айгерим Касымова",
                "email": client_1_email,
                "password": client_1_password,
                "code": "CFL-AIGUL1",
                "goal": "Похудеть на 10 кг",
                "goal_type": "weight_loss",
                "weight": 70.0,
                "height": 165.0,
                "age": 26,
                "fitness_level": "beginner",
            },
            {
                "name": "Дамир Сейткали",
                "email": client_2_email,
                "password": client_2_password,
                "code": "CFL-DAMIR2",
                "goal": "Набрать мышечную массу",
                "goal_type": "muscle_gain",
                "weight": 78.0,
                "height": 180.0,
                "age": 29,
                "fitness_level": "intermediate",
            },
        ]

        client_ids: list[str] = []

        for client_data in clients_data:
            client_id = uid("u")
            client_ids.append(client_id)

            db.add(
                User(
                    id=client_id,
                    email=client_data["email"],
                    password_hash=hash_password(client_data["password"]),
                    name=client_data["name"],
                    role="client",
                    client_code=client_data["code"],
                    created_at=now_utc(),
                )
            )

            db.add(
                ClientProfile(
                    user_id=client_id,
                    coach_id=coach_id,
                    goal=client_data["goal"],
                    goal_type=client_data["goal_type"],
                    start_weight=client_data["weight"],
                    current_weight=client_data["weight"] - 2.0,
                    height=client_data["height"],
                    age=client_data["age"],
                    fitness_level=client_data["fitness_level"],
                    created_at=now_utc(),
                )
            )

            db.add(
                Streak(
                    client_id=client_id,
                    current_streak=5,
                    best_streak=12,
                    last_activity_date=iso_date(1),
                )
            )

            db.add(NotificationSetting(user_id=client_id))

            for index in range(5):
                db.add(
                    ProgressEntry(
                        id=uid("pe"),
                        client_id=client_id,
                        weight=client_data["weight"] - (index * 0.5),
                        date=iso_date(index * 7),
                        notes=None,
                        added_by=client_id,
                    )
                )

            current_monday = date.today() - timedelta(days=date.today().weekday())

            db.add(
                WeeklyGoal(
                    id=uid("wg"),
                    client_id=client_id,
                    week_start=current_monday.isoformat(),
                    target_minutes=180,
                    completed_minutes=90,
                    target_workouts=4,
                    completed_workouts=2,
                )
            )

            attendance_statuses = [
                "attended",
                "attended",
                "rest",
                "attended",
                "missed",
                "attended",
                "attended",
            ]

            for index, status in enumerate(attendance_statuses):
                db.add(
                    Attendance(
                        id=uid("att"),
                        client_id=client_id,
                        coach_id=coach_id,
                        date=iso_date(index),
                        status=status,
                    )
                )

        if client_ids:
            first_client_id = client_ids[0]

            workout_templates = [
                {
                    "name": "Ноги и плечи",
                    "category": "strength",
                    "date_offset": 0,
                    "completed": False,
                    "exercises": [
                        ("Приседания со штангой", 4, 10, 90, 80.0, "legs"),
                        ("Жим ногами", 3, 15, 60, 120.0, "legs"),
                        ("Разгибание ног", 3, 12, 45, 40.0, "legs"),
                    ],
                },
                {
                    "name": "Грудь и трицепс",
                    "category": "strength",
                    "date_offset": 2,
                    "completed": True,
                    "exercises": [
                        ("Жим лёжа", 4, 8, 90, 70.0, "chest"),
                        ("Жим гантелей на наклонной", 3, 10, 75, 24.0, "chest"),
                        ("Разгибание рук на блоке", 3, 12, 45, 25.0, "triceps"),
                    ],
                },
                {
                    "name": "Спина и бицепс",
                    "category": "strength",
                    "date_offset": 4,
                    "completed": True,
                    "exercises": [
                        ("Тяга верхнего блока", 4, 10, 75, 55.0, "back"),
                        ("Тяга горизонтального блока", 3, 12, 60, 50.0, "back"),
                        ("Сгибание рук с гантелями", 3, 12, 45, 14.0, "biceps"),
                    ],
                },
            ]

            for workout_template in workout_templates:
                workout_id = uid("w")

                db.add(
                    WorkoutAssignment(
                        id=workout_id,
                        coach_id=coach_id,
                        client_id=first_client_id,
                        date=iso_date(workout_template["date_offset"]),
                        time="10:00",
                        name=workout_template["name"],
                        category=workout_template["category"],
                        completed=workout_template["completed"],
                        duration_minutes=60,
                    )
                )

                for exercise_name, sets, reps, rest, weight, muscle_group in workout_template["exercises"]:
                    db.add(
                        Exercise(
                            id=uid("ex"),
                            workout_id=workout_id,
                            name=exercise_name,
                            sets=sets,
                            reps=reps,
                            rest_seconds=rest,
                            weight=weight,
                            muscle_group=muscle_group,
                        )
                    )

        places = [
            {
                "type": "gym",
                "name": "World Class Алматы",
                "address": "пр. Достык, 36, Алматы",
                "lat": 43.2365,
                "lng": 76.9286,
                "description": "Премиум фитнес-клуб с бассейном и тренажёрным залом.",
                "rating": 4.7,
            },
            {
                "type": "nutrition",
                "name": "Fit Food KZ",
                "address": "ул. Панфилова, 51, Алматы",
                "lat": 43.2551,
                "lng": 76.9360,
                "description": "Здоровое питание с доставкой и готовыми рационами.",
                "rating": 4.5,
            },
            {
                "type": "shop",
                "name": "GymShark Store",
                "address": "Mega Alma-Ata, Алматы",
                "lat": 43.2195,
                "lng": 76.8981,
                "description": "Спортивная одежда, аксессуары и экипировка для тренировок.",
                "rating": 4.4,
            },
        ]

        for place_data in places:
            db.add(
                Place(
                    id=uid("pl"),
                    type=place_data["type"],
                    name=place_data["name"],
                    address=place_data["address"],
                    latitude=place_data["lat"],
                    longitude=place_data["lng"],
                    description=place_data["description"],
                    rating=place_data["rating"],
                )
            )

        await db.commit()

    print("✅ Seed complete!")
    print()
    print(f"  Coach:  {coach_email} / {coach_password}")
    print(f"  Client: {client_1_email} / {client_1_password}  (code: CFL-AIGUL1)")
    print(f"  Client: {client_2_email} / {client_2_password}  (code: CFL-DAMIR2)")
    print()


if __name__ == "__main__":
    asyncio.run(seed())