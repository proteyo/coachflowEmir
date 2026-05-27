from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    age: Optional[int] = None
    goal: Optional[str] = None
    goal_type: Optional[str] = None

    @field_validator("role")
    @classmethod
    def role_valid(cls, v: str) -> str:
        cleaned = v.strip().lower()

        if cleaned not in ("coach", "client"):
            raise ValueError("role must be 'coach' or 'client'")

        return cleaned

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")

        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        cleaned = v.strip()

        if not cleaned:
            raise ValueError("Name cannot be empty")

        return cleaned


class RegisterPendingResponse(BaseModel):
    email: str
    emailVerificationRequired: bool = True
    message: str


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str

    @field_validator("code")
    @classmethod
    def code_valid(cls, v: str) -> str:
        cleaned = "".join(ch for ch in v.strip() if ch.isdigit())

        if len(cleaned) != 6:
            raise ValueError("Verification code must contain 6 digits")

        return cleaned


class ResendEmailVerificationRequest(BaseModel):
    email: EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    phone: Optional[str] = None
    avatarUrl: Optional[str] = None
    clientCode: Optional[str] = None
    createdAt: str

    emailVerified: bool = False

    lastSeenAt: Optional[str] = None
    isOnline: bool = False

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    token: str
    refresh_token: str
    user: UserOut