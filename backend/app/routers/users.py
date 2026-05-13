"""
Users router.

GET/PATCH  /users/me
GET/PATCH  /users/me/coach-profile
GET/PATCH  /users/me/client-profile
GET        /users/me/notifications
PATCH      /users/me/notifications
"""

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.notification import NotificationSetting
from app.models.profile import ClientProfile, CoachProfile
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.other import NotificationSettingOut, NotificationSettingUpdate
from app.schemas.profile import (
    ClientProfileOut,
    CoachProfileOut,
    UpdateClientProfileRequest,
    UpdateCoachProfileRequest,
    UpdateUserRequest,
)
from app.services.mappers import (
    client_profile_out,
    coach_profile_out,
    notification_out,
    user_out,
)


router = APIRouter(prefix="/users", tags=["Users"])


def require_coach(current_user: User) -> None:
    if current_user.role != "coach":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Coach access required",
        )


def require_client(current_user: User) -> None:
    if current_user.role != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client access required",
        )


def clean_optional_string(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()

    return cleaned or None


async def get_or_create_notification_settings(
    db: AsyncSession,
    user_id: str,
) -> NotificationSetting:
    result = await db.execute(
        select(NotificationSetting).where(NotificationSetting.user_id == user_id)
    )

    settings = result.scalar_one_or_none()

    if settings:
        return settings

    settings = NotificationSetting(user_id=user_id)

    db.add(settings)
    await db.commit()
    await db.refresh(settings)

    return settings


@router.get("/me", response_model=UserOut)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserOut:
    return user_out(current_user)


@router.patch("/me", response_model=UserOut)
async def patch_me(
    data: UpdateUserRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    if data.name is not None:
        cleaned_name = data.name.strip()

        if not cleaned_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Name cannot be empty",
            )

        current_user.name = cleaned_name

    if data.phone is not None:
        current_user.phone = clean_optional_string(data.phone)

    if data.avatar_url is not None:
        current_user.avatar_url = clean_optional_string(data.avatar_url)

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    return user_out(current_user)


# ── Coach profile ──────────────────────────────────────────────────────────────


@router.get("/me/coach-profile", response_model=CoachProfileOut)
async def get_coach_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CoachProfileOut:
    require_coach(current_user)

    result = await db.execute(
        select(CoachProfile).where(CoachProfile.user_id == current_user.id)
    )

    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach profile not found",
        )

    return coach_profile_out(profile)


@router.patch("/me/coach-profile", response_model=CoachProfileOut)
async def patch_coach_profile(
    data: UpdateCoachProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CoachProfileOut:
    require_coach(current_user)

    result = await db.execute(
        select(CoachProfile).where(CoachProfile.user_id == current_user.id)
    )

    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach profile not found",
        )

    if data.specialty is not None:
        profile.specialty = clean_optional_string(data.specialty)

    if data.bio is not None:
        profile.bio = clean_optional_string(data.bio)

    if data.experience_years is not None:
        if data.experience_years < 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Experience years cannot be negative",
            )

        profile.experience_years = data.experience_years

    if data.achievements is not None:
        profile.achievements = json.dumps(
            data.achievements,
            ensure_ascii=False,
        )

    if data.certificates is not None:
        profile.certificates = json.dumps(
            data.certificates,
            ensure_ascii=False,
        )

    if data.profile_image_url is not None:
        profile.profile_image_url = clean_optional_string(data.profile_image_url)

    if data.cover_image_url is not None:
        profile.cover_image_url = clean_optional_string(data.cover_image_url)

    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    return coach_profile_out(profile)


# ── Client profile ────────────────────────────────────────────────────────────


@router.get("/me/client-profile", response_model=ClientProfileOut)
async def get_client_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClientProfileOut:
    require_client(current_user)

    result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )

    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client profile not found",
        )

    return client_profile_out(profile)


@router.patch("/me/client-profile", response_model=ClientProfileOut)
async def patch_client_profile(
    data: UpdateClientProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClientProfileOut:
    require_client(current_user)

    result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )

    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client profile not found",
        )

    string_fields = (
        "goal",
        "goal_type",
        "fitness_level",
        "health_notes",
    )

    number_fields = (
        "start_weight",
        "current_weight",
        "height",
        "age",
    )

    for field in string_fields:
        value = getattr(data, field, None)

        if value is not None:
            setattr(profile, field, clean_optional_string(value))

    for field in number_fields:
        value = getattr(data, field, None)

        if value is not None:
            if value < 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"{field} cannot be negative",
                )

            setattr(profile, field, value)

    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    return client_profile_out(profile)


# ── Notifications ──────────────────────────────────────────────────────────────


@router.get("/me/notifications", response_model=NotificationSettingOut)
async def get_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationSettingOut:
    settings = await get_or_create_notification_settings(
        db=db,
        user_id=current_user.id,
    )

    return notification_out(settings)


@router.patch("/me/notifications", response_model=NotificationSettingOut)
async def patch_notifications(
    data: NotificationSettingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationSettingOut:
    settings = await get_or_create_notification_settings(
        db=db,
        user_id=current_user.id,
    )

    editable_fields = (
        "workout_reminders",
        "supplement_reminders",
        "message_notifications",
        "weekly_goal_reminders",
    )

    for field in editable_fields:
        value = getattr(data, field, None)

        if value is not None:
            setattr(settings, field, value)

    db.add(settings)
    await db.commit()
    await db.refresh(settings)

    return notification_out(settings)