"""
Security utilities for CoachFlow backend.

Includes:
- password hashing and verification;
- JWT access token creation;
- JWT refresh token creation;
- JWT decoding and validation.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings


settings = get_settings()

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


# ── Password ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """
    Hashes a plain password using bcrypt.
    """

    if not password or not password.strip():
        raise ValueError("Password cannot be empty")

    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verifies a plain password against a stored bcrypt hash.
    """

    if not plain or not hashed:
        return False

    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


# ── JWT helpers ───────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _create_token(
    *,
    user_id: str,
    token_type: str,
    expires_delta: timedelta,
) -> str:
    """
    Creates a signed JWT token.
    """

    if not user_id or not user_id.strip():
        raise ValueError("user_id is required")

    issued_at = _now()
    expires_at = issued_at + expires_delta

    payload: dict[str, Any] = {
        "sub": user_id,
        "type": token_type,
        "iat": issued_at,
        "nbf": issued_at,
        "exp": expires_at,
        "jti": uuid.uuid4().hex,
    }

    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def create_access_token(user_id: str) -> str:
    """
    Creates short-lived access token.
    """

    return _create_token(
        user_id=user_id,
        token_type="access",
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: str) -> str:
    """
    Creates long-lived refresh token.
    """

    return _create_token(
        user_id=user_id,
        token_type="refresh",
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def verify_token_payload(
    token: str,
    token_type: str = "access",
) -> dict[str, Any] | None:
    """
    Validates JWT and returns full payload if valid.

    Returns None if:
    - token is empty;
    - signature is invalid;
    - token is expired;
    - token type does not match;
    - subject is missing.
    """

    if not token or not token.strip():
        return None

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_nbf": True,
                "verify_iat": True,
                "require_exp": True,
                "require_iat": True,
                "require_nbf": True,
            },
        )

    except JWTError:
        return None

    payload_type = payload.get("type")
    subject = payload.get("sub")

    if payload_type != token_type:
        return None

    if not isinstance(subject, str) or not subject.strip():
        return None

    return payload


def decode_token(
    token: str,
    token_type: str = "access",
) -> str | None:
    """
    Returns user_id if token is valid, otherwise returns None.

    This function is kept intentionally simple because it is used by auth
    dependencies and routers.
    """

    payload = verify_token_payload(
        token=token,
        token_type=token_type,
    )

    if not payload:
        return None

    return payload["sub"]