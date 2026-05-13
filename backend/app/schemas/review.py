from pydantic import BaseModel, Field


class CoachReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = None


class CoachReviewOut(BaseModel):
    id: str
    coachId: str
    clientId: str
    clientName: str | None = None
    rating: int
    comment: str | None = None
    createdAt: str
    updatedAt: str


class CoachReviewsSummaryOut(BaseModel):
    coachId: str
    averageRating: float
    reviewsCount: int
    reviews: list[CoachReviewOut]


class ClientAssessmentIn(BaseModel):
    disciplineRating: int = Field(ge=1, le=5)
    progressRating: int = Field(ge=1, le=5)
    communicationRating: int = Field(ge=1, le=5)
    comment: str | None = None


class ClientAssessmentOut(BaseModel):
    id: str
    coachId: str
    clientId: str
    coachName: str | None = None
    clientName: str | None = None
    disciplineRating: int
    progressRating: int
    communicationRating: int
    averageRating: float
    comment: str | None = None
    createdAt: str
    updatedAt: str