from typing import List, Optional
from pydantic import BaseModel


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
    specialty: Optional[str] = None
    bio: Optional[str] = None
    experience_years: Optional[int] = None
    achievements: Optional[List[str]] = None
    certificates: Optional[List[str]] = None
    profile_image_url: Optional[str] = None
    cover_image_url: Optional[str] = None


class ClientProfileOut(BaseModel):
    userId: str
    coachId: str
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
    goal: Optional[str] = None
    goal_type: Optional[str] = None
    start_weight: Optional[float] = None
    current_weight: Optional[float] = None
    height: Optional[float] = None
    age: Optional[int] = None
    fitness_level: Optional[str] = None
    health_notes: Optional[str] = None


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class LinkClientRequest(BaseModel):
    client_code: str


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
    email: str


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