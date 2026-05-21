"""
FastAPI dependencies for authentication, role checks and subscription checks.
"""

from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.database import get_db
from app.models.profile import ClientProfile
from app.models.subscription import Subscription
from app.models.user import User


bearer = HTTPBearer(auto_error=False)

# How often we write last_seen_at to the database.
# Smaller value = more accurate online/last seen, but more DB writes.
LAST_SEEN_UPDATE_INTERVAL_SECONDS = 10


def now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def ensure_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def unauthorized(detail: str = "Invalid or expired token") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def forbidden(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=detail,
    )


async def update_user_last_seen(
    user: User,
    db: AsyncSession,
    *,
    force: bool = False,
) -> None:
    """
    Updates user's last_seen_at.

    This is used for chat presence:
    - if user makes authenticated requests, we know they are active;
    - frontend can show green online dot;
    - frontend can show exact last seen time when the user becomes inactive.

    By default we do not update on every request to avoid too many database writes.
    Use force=True only for special presence endpoints if needed later.
    """

    try:
        current_time = now_utc()
        previous_seen = ensure_aware(getattr(user, "last_seen_at", None))

        if not force and previous_seen is not None:
            diff = current_time - previous_seen

            if diff < timedelta(seconds=LAST_SEEN_UPDATE_INTERVAL_SECONDS):
                return

        user.last_seen_at = current_time

        db.add(user)
        await db.commit()
        await db.refresh(user)

    except Exception as error:
        await db.rollback()
        print("[deps] update last_seen_at error:", error)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Returns current authenticated user from Bearer access token.
    Also updates last_seen_at so the app can show online / last seen status.
    """

    if credentials is None:
        raise unauthorized("Authentication required")

    if credentials.scheme.lower() != "bearer":
        raise unauthorized("Invalid authentication scheme")

    token = credentials.credentials.strip()

    if not token:
        raise unauthorized("Authentication token is required")

    user_id = decode_token(
        token=token,
        token_type="access",
    )

    if not user_id:
        raise unauthorized("Invalid or expired token")

    result = await db.execute(
        select(User).where(User.id == user_id)
    )

    user = result.scalar_one_or_none()

    if not user:
        raise unauthorized("Invalid or expired token")

    await update_user_last_seen(user=user, db=db)

    return user


async def require_coach(
    user: User = Depends(get_current_user),
) -> User:
    """
    Allows access only for coach users.
    """

    if user.role != "coach":
        raise forbidden("Coach access required")

    return user


async def require_client(
    user: User = Depends(get_current_user),
) -> User:
    """
    Allows access only for client users.
    """

    if user.role != "client":
        raise forbidden("Client access required")

    return user


async def get_latest_subscription(
    db: AsyncSession,
    coach_id: str,
) -> Subscription | None:
    result = await db.execute(
        select(Subscription)
        .where(Subscription.coach_id == coach_id)
        .order_by(Subscription.created_at.desc())
    )

    return result.scalars().first()


async def get_active_subscription(
    db: AsyncSession,
    coach_id: str,
) -> Subscription | None:
    """
    Returns an active, non-expired subscription.

    If the latest subscription is active but expired by date,
    it is marked as expired.
    """

    subscription = await get_latest_subscription(
        db=db,
        coach_id=coach_id,
    )

    if not subscription:
        return None

    if subscription.status != "active":
        return None

    end_date = ensure_aware(subscription.end_date)

    if end_date is None:
        subscription.status = "expired"
        db.add(subscription)
        await db.commit()
        await db.refresh(subscription)
        return None

    if end_date <= now_utc():
        subscription.status = "expired"
        db.add(subscription)
        await db.commit()
        await db.refresh(subscription)
        return None

    return subscription


async def require_active_coach_subscription(
    user: User = Depends(require_coach),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Allows coach access only when the coach has an active subscription.

    This does not delete any coach data. It only blocks protected actions while
    the subscription is inactive, expired or cancelled.
    """

    subscription = await get_active_subscription(
        db=db,
        coach_id=user.id,
    )

    if not subscription:
        raise forbidden("Active subscription required")

    return user


async def require_active_client_coach_subscription(
    user: User = Depends(require_client),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Allows client access only if the assigned coach has an active subscription.

    This is useful for premium app areas where the coach's subscription controls
    access for their clients too.
    """

    result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == user.id)
    )

    profile = result.scalar_one_or_none()

    if not profile or not profile.coach_id:
        raise forbidden("Assigned coach is required")

    subscription = await get_active_subscription(
        db=db,
        coach_id=profile.coach_id,
    )

    if not subscription:
        raise forbidden("Coach subscription is inactive")

    return user