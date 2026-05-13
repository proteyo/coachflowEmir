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
        if v not in ("coach", "client"):
            raise ValueError("role must be 'coach' or 'client'")
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
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        return v


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

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    token: str           # access token (фронтенд ожидает это поле)
    refresh_token: str
    user: UserOut
