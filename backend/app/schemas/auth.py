from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from app.services.legal_terms import LegalAcceptance


class RegisterRequest(LegalAcceptance):
    name: str = Field(min_length=1,max_length=120)
    email: EmailStr
    password: str = Field(max_length=128)
    role: str
    age: Optional[int] = Field(default=None,ge=18,le=100)
    gender: Optional[str] = None
    goal: Optional[str] = None
    goal_type: Optional[str] = None

    @field_validator("role")
    @classmethod
    def role_valid(cls, v: str) -> str:
        cleaned = v.strip().lower()

        if cleaned not in ("coach", "client"):
            raise ValueError("role must be 'coach' or 'client'")

        return cleaned

    @field_validator("gender")
    @classmethod
    def gender_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None

        cleaned = v.strip().lower()

        if cleaned not in ("male", "female"):
            raise ValueError("gender must be 'male' or 'female'")

        return cleaned

    @model_validator(mode="after")
    def client_gender_required(self):
        if self.role == "client" and self.gender is None:
            raise ValueError("Gender is required for clients")
        if self.role == "client" and (self.age is None or not self.health_data_consent):
            raise ValueError("Adult age and health-data consent are required for clients")
        return self

    @field_validator("age")
    @classmethod
    def age_valid(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None

        if v < 0:
            raise ValueError("Age cannot be negative")

        return v

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
    password: str
    legal: Optional[LegalAcceptance] = None

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
    trialStartedAt: Optional[str] = None
    termsVersion: Optional[str] = None

    lastSeenAt: Optional[str] = None
    isOnline: bool = False

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    token: str
    refresh_token: str
    user: UserOut
