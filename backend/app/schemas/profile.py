from typing import Annotated, List, Optional
from pydantic import BaseModel, EmailStr, Field


class CoachProfileOut(BaseModel):
    userId: str
    specialty: str
    bio: str
    experienceYears: int
    achievements: List[str]
    certificates: List[str]
    rating: float
    profileImageUrl: Optional[str] = None
    coverImageUrl: Optional[str] = None

    model_config = {"from_attributes": True}


class UpdateCoachProfileRequest(BaseModel):
    model_config = {"extra": "forbid"}
    specialty: Optional[str] = Field(default=None, max_length=200)
    bio: Optional[str] = Field(default=None, max_length=2000)
    experience_years: Optional[int] = Field(default=None, ge=0, le=100)
    achievements: Optional[List[Annotated[str, Field(max_length=1000)]]] = Field(default=None, max_length=50)
    certificates: Optional[List[Annotated[str, Field(max_length=1000)]]] = Field(default=None, max_length=50)
    profile_image_url: Optional[str] = Field(default=None, max_length=2000)
    cover_image_url: Optional[str] = Field(default=None, max_length=2000)


class ClientProfileOut(BaseModel):
    trainingAccess: bool = True
    contractEndsOn: Optional[str] = None
    userId: str
    coachId: Optional[str] = None
    gender: str = "male"
    goal: str
    goalType: Optional[str] = None
    startWeight: float
    currentWeight: float
    height: float
    age: Optional[int] = None
    fitnessLevel: str
    healthNotes: Optional[str] = None
    createdAt: str

    model_config = {"from_attributes": True}


class UpdateClientProfileRequest(BaseModel):
    model_config = {"extra":"forbid"}
    gender: Optional[str] = None
    goal: Optional[str] = Field(default=None,max_length=500)
    goal_type: Optional[str] = None
    start_weight: Optional[float] = Field(default=None,ge=0,le=400,allow_inf_nan=False)
    current_weight: Optional[float] = Field(default=None,ge=0,le=400,allow_inf_nan=False)
    height: Optional[float] = Field(default=None,ge=0,le=250,allow_inf_nan=False)
    age: Optional[int] = Field(default=None,ge=18,le=100)
    fitness_level: Optional[str] = None
    health_notes: Optional[str] = Field(default=None,max_length=4000)


class UpdateUserRequest(BaseModel):
    model_config = {"extra": "forbid"}
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=40)
    avatar_url: Optional[str] = Field(default=None, max_length=2000)


class LinkClientRequest(BaseModel):
    model_config = {"extra": "forbid"}
    client_code: str = Field(min_length=1, max_length=32)


class ClientWithProfileOut(BaseModel):
    id: str
    email: str
    name: str
    phone: Optional[str] = None
    avatarUrl: Optional[str] = None
    clientCode: Optional[str] = None

    # Online / last seen status
    lastSeenAt: Optional[str] = None
    isOnline: bool = False

    profile: Optional[ClientProfileOut] = None

    model_config = {"from_attributes": True}


class InviteClientRequest(BaseModel):
    model_config = {"extra": "forbid"}
    email: EmailStr


class ClientInviteOut(BaseModel):
    id: str
    coachId: str
    clientId: str
    email: str
    status: str
    createdAt: str
    expiresAt: str
    respondedAt: Optional[str] = None
    coachName: Optional[str] = None
    clientName: Optional[str] = None

    model_config = {"from_attributes": True}
