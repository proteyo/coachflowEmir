"""
Auth API.

Routes:
POST /auth/register
POST /auth/verify-email
POST /auth/resend-verification-code
POST /auth/login
POST /auth/refresh
GET  /auth/me

POST /auth/forgot-password
POST /auth/reset-password
"""

import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.database import get_db
from app.models.notification import NotificationSetting
from app.models.password_reset_token import PasswordResetToken
from app.models.profile import ClientProfile, CoachProfile
from app.models.streak import Streak
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    RegisterPendingResponse,
    RegisterRequest,
    ResendEmailVerificationRequest,
    VerifyEmailRequest,
)
from app.schemas.password_reset import ForgotPasswordRequest, ResetPasswordRequest
from app.services.email_service import (
    EmailDeliveryError,
    send_email_verification_code,
    send_password_reset_email,
)
from app.services.mappers import user_out


router = APIRouter(prefix="/auth", tags=["Auth"])

CLIENT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
PASSWORD_RESET_TOKEN_TTL_MINUTES = 30
EMAIL_VERIFICATION_CODE_TTL_MINUTES = 15
EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = 60

ALLOWED_ROLES = {"coach", "client"}


def now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def clean_email(email: str) -> str:
    cleaned = email.strip().lower()

    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email is required",
        )

    return cleaned


def clean_name(name: str) -> str:
    cleaned = name.strip()

    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Name is required",
        )

    if len(cleaned) > 120:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Name is too long",
        )

    return cleaned


def normalize_reset_token(value: str) -> str:
    """
    Accepts both:
    - raw token
    - full reset link like coachflow://reset-password?token=...

    This makes the mobile reset screen safer if user pastes the full link.
    """
    token = value.strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token is required",
        )

    if "token=" not in token:
        return token

    try:
        parsed = urlparse(token)
        params = parse_qs(parsed.query)
        extracted = params.get("token", [None])[0]

        if extracted:
            return extracted.strip()
    except Exception:
        pass

    return token.split("token=", 1)[1].split("&", 1)[0].strip()


def hash_reset_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def hash_email_verification_code(code: str) -> str:
    clean_code = "".join(ch for ch in code.strip() if ch.isdigit())
    return sha256(clean_code.encode("utf-8")).hexdigest()


def generate_email_verification_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def ensure_aware_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value


def validate_password_strength(password: str) -> None:
    """
    Production password policy.

    Requirements:
    - at least 8 characters;
    - at least one lowercase letter;
    - at least one uppercase letter;
    - at least one digit;
    - at least one special character.
    """
    if not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password is required",
        )

    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters long",
        )

    if not re.search(r"[a-z]", password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must contain at least one lowercase letter",
        )

    if not re.search(r"[A-Z]", password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must contain at least one uppercase letter",
        )

    if not re.search(r"\d", password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must contain at least one digit",
        )

    if not re.search(r"[^A-Za-z0-9]", password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must contain at least one special character",
        )


async def generate_unique_client_code(db: AsyncSession) -> str:
    for _ in range(30):
        code = "CFL-" + "".join(
            secrets.choice(CLIENT_CODE_ALPHABET)
            for _ in range(6)
        )

        result = await db.execute(
            select(User).where(User.client_code == code)
        )

        if not result.scalar_one_or_none():
            return code

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate unique client code",
    )


def build_user_payload(user: User):
    payload = user_out(user)

    if isinstance(payload, dict):
        payload["emailVerified"] = bool(getattr(user, "email_verified", False))
        return payload

    if hasattr(payload, "model_dump"):
        data = payload.model_dump()
        data["emailVerified"] = bool(getattr(user, "email_verified", False))
        return data

    return payload


def build_auth_response(user: User) -> AuthResponse:
    return AuthResponse(
        token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=build_user_payload(user),
    )


def attach_new_email_verification_code(user: User) -> str:
    code = generate_email_verification_code()
    current_time = now_utc()

    user.email_verified = False
    user.email_verification_code_hash = hash_email_verification_code(code)
    user.email_verification_expires_at = current_time + timedelta(
        minutes=EMAIL_VERIFICATION_CODE_TTL_MINUTES
    )
    user.email_verification_sent_at = current_time

    return code


async def send_verification_code_or_503(user: User, raw_code: str) -> None:
    try:
        await send_email_verification_code(
            email=user.email,
            name=user.name,
            code=raw_code,
        )
    except EmailDeliveryError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Verification email could not be sent. Please try again later.",
        )


async def expire_existing_reset_tokens(
    user_id: str,
    db: AsyncSession,
) -> None:
    """
    Marks previous unused reset tokens as used.

    This keeps only the latest reset link valid.
    """
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.used_at.is_(None),
        )
    )

    existing_tokens = result.scalars().all()
    current_time = now_utc()

    for token in existing_tokens:
        token.used_at = current_time
        db.add(token)


async def create_password_reset_token(
    user_id: str,
    db: AsyncSession,
) -> str:
    """
    Creates a one-time password reset token.

    Only token_hash is stored in database.
    Raw token is sent to the user by email.
    """
    await expire_existing_reset_tokens(
        user_id=user_id,
        db=db,
    )

    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_reset_token(raw_token)
    current_time = now_utc()

    reset_token = PasswordResetToken(
        id=f"prt_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        token_hash=token_hash,
        expires_at=current_time + timedelta(minutes=PASSWORD_RESET_TOKEN_TTL_MINUTES),
        used_at=None,
        created_at=current_time,
    )

    db.add(reset_token)

    return raw_token


@router.post(
    "/register",
    response_model=RegisterPendingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterPendingResponse:
    email = clean_email(data.email)
    name = clean_name(data.name)
    role = data.role.strip().lower()

    if role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid role",
        )

    validate_password_strength(data.password)

    result = await db.execute(
        select(User).where(User.email == email)
    )

    existing_user = result.scalar_one_or_none()

    if existing_user:
        if bool(getattr(existing_user, "email_verified", False)):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        raw_code = attach_new_email_verification_code(existing_user)
        existing_user.password_hash = hash_password(data.password)
        existing_user.name = name

        db.add(existing_user)
        await db.commit()
        await db.refresh(existing_user)

        await send_verification_code_or_503(existing_user, raw_code)

        return RegisterPendingResponse(
            email=existing_user.email,
            emailVerificationRequired=True,
            message="Verification code has been sent to your email.",
        )

    current_time = now_utc()
    user_id = f"u_{uuid.uuid4().hex[:12]}"
    is_client = role == "client"

    user = User(
        id=user_id,
        email=email,
        password_hash=hash_password(data.password),
        name=name,
        role=role,
        client_code=await generate_unique_client_code(db) if is_client else None,
        created_at=current_time,
        email_verified=False,
    )

    raw_code = attach_new_email_verification_code(user)

    db.add(user)

    db.add(
        NotificationSetting(
            user_id=user_id,
        )
    )

    if role == "coach":
        db.add(
            CoachProfile(
                user_id=user_id,
            )
        )

        db.add(
            Subscription(
                id=f"sub_{uuid.uuid4().hex[:12]}",
                coach_id=user_id,
                plan_code="free",
                plan_name="Free Trial",
                price=0,
                currency="KZT",
                client_limit=3,
                status="inactive",
                start_date=None,
                end_date=None,
                created_at=current_time,
            )
        )

    if role == "client":
        db.add(
            ClientProfile(
                user_id=user_id,
                coach_id=None,
                goal=data.goal or "",
                goal_type=data.goal_type,
                age=data.age,
                start_weight=0,
                current_weight=0,
                height=0,
                fitness_level="beginner",
                created_at=current_time,
            )
        )

        db.add(
            Streak(
                client_id=user_id,
                current_streak=0,
                best_streak=0,
                last_activity_date=None,
            )
        )

    await db.commit()
    await db.refresh(user)

    await send_verification_code_or_503(user, raw_code)

    return RegisterPendingResponse(
        email=user.email,
        emailVerificationRequired=True,
        message="Verification code has been sent to your email.",
    )


@router.post("/verify-email", response_model=AuthResponse)
async def verify_email(
    data: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    email = clean_email(data.email)
    code = "".join(ch for ch in data.code.strip() if ch.isdigit())

    result = await db.execute(
        select(User).where(User.email == email)
    )

    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code",
        )

    if bool(getattr(user, "email_verified", False)):
        return build_auth_response(user)

    if not user.email_verification_code_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code",
        )

    expires_at = ensure_aware_datetime(user.email_verification_expires_at)

    if not expires_at or expires_at < now_utc():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired",
        )

    code_hash = hash_email_verification_code(code)

    if not secrets.compare_digest(code_hash, user.email_verification_code_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code",
        )

    user.email_verified = True
    user.email_verification_code_hash = None
    user.email_verification_expires_at = None
    user.email_verification_sent_at = None

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return build_auth_response(user)


@router.post("/resend-verification-code", response_model=RegisterPendingResponse)
async def resend_verification_code(
    data: ResendEmailVerificationRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterPendingResponse:
    email = clean_email(data.email)

    result = await db.execute(
        select(User).where(User.email == email)
    )

    user = result.scalar_one_or_none()

    if not user:
        return RegisterPendingResponse(
            email=email,
            emailVerificationRequired=True,
            message="If this email exists, a verification code has been sent.",
        )

    if bool(getattr(user, "email_verified", False)):
        return RegisterPendingResponse(
            email=user.email,
            emailVerificationRequired=False,
            message="Email is already verified.",
        )

    sent_at = ensure_aware_datetime(user.email_verification_sent_at)

    if sent_at:
        seconds_since_last_send = (now_utc() - sent_at).total_seconds()

        if seconds_since_last_send < EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS:
            wait_seconds = int(
                EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS - seconds_since_last_send
            )

            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {wait_seconds} seconds before requesting a new code.",
            )

    raw_code = attach_new_email_verification_code(user)

    db.add(user)
    await db.commit()
    await db.refresh(user)

    await send_verification_code_or_503(user, raw_code)

    return RegisterPendingResponse(
        email=user.email,
        emailVerificationRequired=True,
        message="Verification code has been sent to your email.",
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    email = clean_email(data.email)

    result = await db.execute(
        select(User).where(User.email == email)
    )

    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not bool(getattr(user, "email_verified", False)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in.",
        )

    return build_auth_response(user)


@router.post("/refresh", response_model=AuthResponse)
async def refresh(
    data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    user_id = decode_token(
        token=data.refresh_token,
        token_type="refresh",
    )

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    result = await db.execute(
        select(User).where(User.id == user_id)
    )

    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if not bool(getattr(user, "email_verified", False)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before continuing.",
        )

    return build_auth_response(user)


@router.get("/me")
async def me(
    current_user: User = Depends(get_current_user),
):
    return build_user_payload(current_user)


@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Starts password reset flow.

    Security note:
    The response is always the same, even if email does not exist.
    This prevents checking which emails are registered.
    """
    email = clean_email(data.email)

    result = await db.execute(
        select(User).where(User.email == email)
    )

    user = result.scalar_one_or_none()

    if not user:
        return {
            "message": "If this email exists, password reset instructions have been sent."
        }

    raw_token = await create_password_reset_token(
        user_id=user.id,
        db=db,
    )

    await db.commit()

    try:
        await send_password_reset_email(
            email=user.email,
            name=user.name,
            token=raw_token,
        )

    except EmailDeliveryError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email could not be sent. Please try again later.",
        )

    return {
        "message": "If this email exists, password reset instructions have been sent."
    }


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Resets password using a valid one-time token.
    """
    raw_token = normalize_reset_token(data.token)
    token_hash = hash_reset_token(raw_token)

    validate_password_strength(data.new_password)

    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
        )
    )

    reset_token = result.scalar_one_or_none()

    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    if reset_token.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    expires_at = reset_token.expires_at

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now_utc():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    result = await db.execute(
        select(User).where(User.id == reset_token.user_id)
    )

    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user.password_hash = hash_password(data.new_password)
    reset_token.used_at = now_utc()

    db.add(user)
    db.add(reset_token)

    await db.commit()

    return {
        "message": "Password has been reset successfully."
    }