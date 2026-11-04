"""
Security utilities for CoachFlow backend.

Includes:
- password hashing and verification;
- JWT access token creation;
- JWT refresh token creation;
- JWT decoding and validation.
"""

import uuid
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from jwt import PyJWTError as JWTError
from passlib.context import CryptContext

from app.core.config import get_settings


settings = get_settings()

pwd_context = CryptContext(
    schemes=["bcrypt_sha256", "bcrypt"],
    deprecated="auto",
)


# ── Password ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """
    Hashes a plain password using bcrypt.
    """

    if not password or not password.strip():
        raise ValueError("Password cannot be empty")

    if len(password.encode("utf-8")) > 1024:
        raise ValueError("Password must not exceed 1024 UTF-8 bytes")
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verifies a plain password against a stored bcrypt hash.
    """

    if not plain or not hashed:
        return False

    # Legacy bcrypt hashes cannot distinguish suffixes beyond 72 bytes.
    # Such accounts must use recovery to get a new, non-truncating hash.
    if hashed.startswith(("$2a$", "$2b$", "$2y$")) and len(plain.encode("utf-8")) > 72:
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
    password_hash: str,
    resource: str | None = None,
    session_id: str | None = None,
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
        "session": password_session_key(password_hash),
    }
    if session_id is not None:
        payload["sid"] = session_id
    if resource is not None:
        payload["resource"] = resource

    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def password_session_key(password_hash: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), password_hash.encode(), hashlib.sha256).hexdigest()


def token_matches_password(token: str, password_hash: str, token_type: str = "access") -> bool:
    payload = verify_token_payload(token, token_type)
    session = payload.get("session") if payload else None
    return isinstance(session, str) and hmac.compare_digest(session, password_session_key(password_hash))


def create_access_token(user_id: str, password_hash: str, session_id: str | None = None) -> str:
    """
    Creates short-lived access token.
    """

    return _create_token(
        user_id=user_id,
        token_type="access",
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        password_hash=password_hash,
        session_id=session_id,
    )


def create_refresh_token(user_id: str, password_hash: str, session_id: str | None = None) -> str:
    """
    Creates long-lived refresh token.
    """

    return _create_token(
        user_id=user_id,
        token_type="refresh",
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        password_hash=password_hash,
        session_id=session_id,
    )


def create_media_token(user_id: str, password_hash: str, resource: str, session_id: str | None = None) -> str:
    return _create_token(
        user_id=user_id, token_type="media", password_hash=password_hash,
        expires_delta=timedelta(minutes=10), resource=resource, session_id=session_id,
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
                "require": ["exp", "iat", "nbf", "sub", "type", "jti"],
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
