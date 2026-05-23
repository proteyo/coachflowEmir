"""
Client management.

Coach:
GET    /clients                         — list my linked clients (active subscription)
POST   /clients/link                    — link client by client code (active subscription)
POST   /clients/invite                  — invite client by email (active subscription)
DELETE /clients/{client_id}             — unlink client and remove coach-assigned data
GET    /clients/{client_id}             — get client detail (active subscription)

Client:
GET    /clients/invites/me              — list my pending invites
POST   /clients/invites/{invite_id}/accept
POST   /clients/invites/{invite_id}/reject

Coach can also see invites they sent only with active subscription.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_active_coach_subscription
from app.db.database import get_db
from app.models.attendance import Attendance
from app.models.client_invite import ClientInvite
from app.models.exercise_result import ExerciseResult
from app.models.message import Message
from app.models.profile import ClientProfile
from app.models.review import ClientAssessment
from app.models.subscription import Subscription
from app.models.supplement import SupplementItem, SupplementLog, SupplementPlan
from app.models.user import User
from app.models.weekly_goal import WeeklyGoal
from app.models.workout import WorkoutAssignment
from app.schemas.profile import (
    ClientInviteOut,
    ClientWithProfileOut,
    InviteClientRequest,
    LinkClientRequest,
)
from app.services.mappers import client_invite_out, client_with_profile_out

router = APIRouter(prefix="/clients", tags=["Clients"])


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def is_expired(expires_at: datetime) -> bool:
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    return expires_at < now_utc()


def _normalize_dt(value: datetime | None) -> datetime | None:
    if not value:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value


async def _ensure_coach_subscription_if_needed(
    current_user: User,
    db: AsyncSession,
) -> None:
    """
    If current user is coach, require active subscription.
    Clients are not checked here because subscription belongs to coach accounts.
    """
    if current_user.role == "coach":
        await require_active_coach_subscription(current_user, db)


async def _get_client_or_404(client_id: str, db: AsyncSession) -> User:
    res = await db.execute(
        select(User)
        .where(User.id == client_id, User.role == "client")
        .options(selectinload(User.client_profile))
    )

    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Client not found")

    return user


async def _get_active_client_count(coach_id: str, db: AsyncSession) -> int:
    res = await db.execute(
        select(func.count(ClientProfile.user_id)).where(
            ClientProfile.coach_id == coach_id
        )
    )

    return int(res.scalar_one() or 0)


async def _ensure_client_limit(coach_id: str, db: AsyncSession):
    """
    Backend protection for active subscription and paid plan client limits.

    Starter   -> 10 clients
    Pro       -> 30 clients
    Unlimited -> 999999 clients
    """
    sub_res = await db.execute(
        select(Subscription).where(Subscription.coach_id == coach_id)
    )

    sub = sub_res.scalar_one_or_none()

    if not sub:
        raise HTTPException(
            status_code=403,
            detail="Active subscription required. Please choose a plan first.",
        )

    if sub.status != "active":
        raise HTTPException(
            status_code=403,
            detail="Active subscription required. Please activate your plan.",
        )

    end_date = _normalize_dt(sub.end_date)

    if end_date and end_date < now_utc():
        sub.status = "expired"
        db.add(sub)
        await db.commit()

        raise HTTPException(
            status_code=403,
            detail="Subscription expired. Please renew your plan.",
        )

    client_limit = int(getattr(sub, "client_limit", 10) or 10)

    if client_limit >= 999999:
        return

    current_count = await _get_active_client_count(coach_id, db)

    if current_count >= client_limit:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Client limit reached for {sub.plan_name}. "
                f"Your plan allows up to {client_limit} clients. "
                f"Upgrade your plan to add more clients."
            ),
        )


async def _delete_coach_client_assigned_data(
    coach_id: str,
    client_id: str,
    db: AsyncSession,
) -> None:
    """
    Removes all data assigned by this coach to this client.

    This does NOT delete:
    - client account
    - client profile
    - client weight progress
    - chat messages

    It deletes:
    - workouts assigned by this coach
    - workout exercises through cascade
    - exercise results connected to this coach/client
    - supplement plans assigned by this coach
    - supplement items/logs connected to these plans
    - attendance created under this coach-client relationship
    - weekly goals for this client
    - private client assessment from this coach
    - old invites between this coach and client
    """

    workout_ids = select(WorkoutAssignment.id).where(
        WorkoutAssignment.coach_id == coach_id,
        WorkoutAssignment.client_id == client_id,
    )

    supplement_plan_ids = select(SupplementPlan.id).where(
        SupplementPlan.coach_id == coach_id,
        SupplementPlan.client_id == client_id,
    )

    supplement_item_ids = select(SupplementItem.id).where(
        SupplementItem.plan_id.in_(supplement_plan_ids)
    )

    await db.execute(
        delete(ExerciseResult).where(
            ExerciseResult.coach_id == coach_id,
            ExerciseResult.client_id == client_id,
        )
    )

    await db.execute(
        delete(SupplementLog).where(
            SupplementLog.client_id == client_id,
            SupplementLog.supplement_item_id.in_(supplement_item_ids),
        )
    )

    await db.execute(
        delete(WorkoutAssignment).where(
            WorkoutAssignment.id.in_(workout_ids),
        )
    )

    await db.execute(
        delete(SupplementPlan).where(
            SupplementPlan.id.in_(supplement_plan_ids),
        )
    )

    await db.execute(
        delete(Attendance).where(
            Attendance.coach_id == coach_id,
            Attendance.client_id == client_id,
        )
    )

    await db.execute(
        delete(WeeklyGoal).where(
            WeeklyGoal.client_id == client_id,
        )
    )

    await db.execute(
        delete(ClientAssessment).where(
            ClientAssessment.coach_id == coach_id,
            ClientAssessment.client_id == client_id,
        )
    )

    await db.execute(
        delete(ClientInvite).where(
            ClientInvite.coach_id == coach_id,
            ClientInvite.client_id == client_id,
        )
    )


@router.get("", response_model=list[ClientWithProfileOut])
async def list_clients(
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    """
    Coach can list linked clients only with active subscription.
    """
    res = await db.execute(
        select(User)
        .join(ClientProfile, ClientProfile.user_id == User.id)
        .where(ClientProfile.coach_id == coach.id)
        .options(selectinload(User.client_profile))
    )

    users = res.scalars().all()

    return [client_with_profile_out(user) for user in users]


@router.post("/link", response_model=ClientWithProfileOut)
async def link_client(
    data: LinkClientRequest,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    """
    Coach can link a client only with active subscription and available client limit.
    """
    client_code = data.client_code.strip().upper()

    res = await db.execute(
        select(User)
        .where(User.client_code == client_code, User.role == "client")
        .options(selectinload(User.client_profile))
    )

    client_user = res.scalar_one_or_none()

    if not client_user:
        raise HTTPException(status_code=404, detail="No client found with this code")

    profile = client_user.client_profile

    if not profile:
        raise HTTPException(status_code=400, detail="Client has no profile")

    if profile.coach_id == coach.id:
        return client_with_profile_out(client_user)

    if profile.coach_id and profile.coach_id != coach.id:
        raise HTTPException(
            status_code=400,
            detail="Client is already linked to another coach",
        )

    await _ensure_client_limit(coach.id, db)

    profile.coach_id = coach.id

    db.add(profile)
    await db.commit()

    refreshed = await _get_client_or_404(client_user.id, db)

    return client_with_profile_out(refreshed)


@router.post("/invite", response_model=ClientInviteOut, status_code=201)
async def invite_client_by_email(
    data: InviteClientRequest,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    """
    Coach can invite a client only with active subscription and available client limit.
    """
    email = data.email.strip().lower()

    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    res = await db.execute(
        select(User)
        .where(User.email == email, User.role == "client")
        .options(selectinload(User.client_profile))
    )

    client = res.scalar_one_or_none()

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Client with this email was not found. Ask the client to register first.",
        )

    if not client.client_profile:
        raise HTTPException(status_code=400, detail="Client has no profile")

    if client.client_profile.coach_id == coach.id:
        raise HTTPException(status_code=400, detail="Client is already linked to you")

    if client.client_profile.coach_id and client.client_profile.coach_id != coach.id:
        raise HTTPException(status_code=400, detail="Client already has another coach")

    existing_res = await db.execute(
        select(ClientInvite)
        .where(
            ClientInvite.coach_id == coach.id,
            ClientInvite.client_id == client.id,
            ClientInvite.status == "pending",
        )
        .options(
            selectinload(ClientInvite.coach),
            selectinload(ClientInvite.client),
        )
    )

    existing = existing_res.scalar_one_or_none()

    if existing:
        return client_invite_out(existing)

    await _ensure_client_limit(coach.id, db)

    invite = ClientInvite(
        coach_id=coach.id,
        client_id=client.id,
        email=email,
        status="pending",
    )

    db.add(invite)
    await db.flush()

    message = Message(
        sender_id=coach.id,
        receiver_id=client.id,
        content=(
            f"{coach.name} wants to add you as a client. "
            f"Invite ID: {invite.id}. "
            f"You can accept or reject this invite."
        ),
        message_type="text",
        read=False,
    )

    db.add(message)
    await db.commit()

    saved_res = await db.execute(
        select(ClientInvite)
        .where(ClientInvite.id == invite.id)
        .options(
            selectinload(ClientInvite.coach),
            selectinload(ClientInvite.client),
        )
    )

    saved_invite = saved_res.scalar_one()

    return client_invite_out(saved_invite)


@router.get("/invites/me", response_model=list[ClientInviteOut])
async def my_invites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Client:
    - Can see own pending invites.

    Coach:
    - Can see sent invites only with active subscription.
    """
    if current_user.role == "client":
        query = (
            select(ClientInvite)
            .where(
                ClientInvite.client_id == current_user.id,
                ClientInvite.status == "pending",
            )
            .options(
                selectinload(ClientInvite.coach),
                selectinload(ClientInvite.client),
            )
            .order_by(ClientInvite.created_at.desc())
        )

    elif current_user.role == "coach":
        await _ensure_coach_subscription_if_needed(current_user, db)

        query = (
            select(ClientInvite)
            .where(ClientInvite.coach_id == current_user.id)
            .options(
                selectinload(ClientInvite.coach),
                selectinload(ClientInvite.client),
            )
            .order_by(ClientInvite.created_at.desc())
        )

    else:
        raise HTTPException(status_code=403, detail="Access denied")

    res = await db.execute(query)
    invites = res.scalars().all()

    return [client_invite_out(invite) for invite in invites]


@router.post("/invites/{invite_id}/accept", response_model=ClientInviteOut)
async def accept_invite(
    invite_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Client accepts invite.

    The invited coach must still have active subscription and available client limit.
    """
    if current_user.role != "client":
        raise HTTPException(status_code=403, detail="Only clients can accept invites")

    res = await db.execute(
        select(ClientInvite)
        .where(ClientInvite.id == invite_id)
        .options(
            selectinload(ClientInvite.coach),
            selectinload(ClientInvite.client),
        )
    )

    invite = res.scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    if invite.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="This invite is not for you")

    if invite.status != "pending":
        raise HTTPException(status_code=400, detail="Invite is not pending")

    if is_expired(invite.expires_at):
        invite.status = "expired"
        db.add(invite)
        await db.commit()

        raise HTTPException(status_code=400, detail="Invite expired")

    profile_res = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )

    profile = profile_res.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=400, detail="Client profile not found")

    if profile.coach_id and profile.coach_id != invite.coach_id:
        raise HTTPException(status_code=400, detail="You already have another coach")

    if profile.coach_id == invite.coach_id:
        invite.status = "accepted"
        invite.responded_at = now_utc()

        db.add(invite)
        await db.commit()
        await db.refresh(invite)

        return client_invite_out(invite)

    await _ensure_client_limit(invite.coach_id, db)

    profile.coach_id = invite.coach_id
    invite.status = "accepted"
    invite.responded_at = now_utc()

    message = Message(
        sender_id=current_user.id,
        receiver_id=invite.coach_id,
        content=f"{current_user.name} accepted your client invite.",
        message_type="text",
        read=False,
    )

    db.add(profile)
    db.add(invite)
    db.add(message)

    await db.commit()

    saved_res = await db.execute(
        select(ClientInvite)
        .where(ClientInvite.id == invite.id)
        .options(
            selectinload(ClientInvite.coach),
            selectinload(ClientInvite.client),
        )
    )

    saved_invite = saved_res.scalar_one()

    return client_invite_out(saved_invite)


@router.post("/invites/{invite_id}/reject", response_model=ClientInviteOut)
async def reject_invite(
    invite_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Client rejects invite.
    """
    if current_user.role != "client":
        raise HTTPException(status_code=403, detail="Only clients can reject invites")

    res = await db.execute(
        select(ClientInvite)
        .where(ClientInvite.id == invite_id)
        .options(
            selectinload(ClientInvite.coach),
            selectinload(ClientInvite.client),
        )
    )

    invite = res.scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    if invite.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="This invite is not for you")

    if invite.status != "pending":
        raise HTTPException(status_code=400, detail="Invite is not pending")

    invite.status = "rejected"
    invite.responded_at = now_utc()

    message = Message(
        sender_id=current_user.id,
        receiver_id=invite.coach_id,
        content=f"{current_user.name} rejected your client invite.",
        message_type="text",
        read=False,
    )

    db.add(invite)
    db.add(message)

    await db.commit()
    await db.refresh(invite)

    return client_invite_out(invite)


@router.get("/{client_id}", response_model=ClientWithProfileOut)
async def get_client(
    client_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Coach can read linked client details only with active subscription.
    Client can read only own details.
    """
    client_user = await _get_client_or_404(client_id, db)
    profile = client_user.client_profile

    if current_user.role == "coach":
        await _ensure_coach_subscription_if_needed(current_user, db)

        if not profile or profile.coach_id != current_user.id:
            raise HTTPException(status_code=403, detail="This client is not linked to you")

    elif current_user.role == "client":
        if client_user.id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    else:
        raise HTTPException(status_code=403, detail="Access denied")

    return client_with_profile_out(client_user)


@router.delete("/{client_id}", status_code=204)
async def unlink_client(
    client_id: str,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    """
    Coach can unlink client only with active subscription.

    When the coach removes a client, all coach-assigned data is removed too:
    workouts, exercises, supplements, attendance, weekly goals,
    exercise results and private client assessment.

    The client account and personal profile are not deleted.
    """
    client_user = await _get_client_or_404(client_id, db)
    profile = client_user.client_profile

    if not profile or profile.coach_id != coach.id:
        raise HTTPException(status_code=403, detail="This client is not linked to you")

    await _delete_coach_client_assigned_data(
        coach_id=coach.id,
        client_id=client_id,
        db=db,
    )

    profile.coach_id = None

    db.add(profile)
    await db.commit()