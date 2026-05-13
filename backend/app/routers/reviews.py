from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_active_coach_subscription
from app.db.database import get_db
from app.models.profile import ClientProfile
from app.models.review import ClientAssessment, CoachReview
from app.models.user import User
from app.schemas.review import (
    ClientAssessmentIn,
    ClientAssessmentOut,
    CoachReviewIn,
    CoachReviewOut,
    CoachReviewsSummaryOut,
)

router = APIRouter(prefix="/reviews", tags=["Reviews"])


def review_out(review: CoachReview) -> CoachReviewOut:
    return CoachReviewOut(
        id=review.id,
        coachId=review.coach_id,
        clientId=review.client_id,
        clientName=review.client.name if review.client else None,
        rating=review.rating,
        comment=review.comment,
        createdAt=review.created_at.isoformat(),
        updatedAt=review.updated_at.isoformat(),
    )


def assessment_out(assessment: ClientAssessment) -> ClientAssessmentOut:
    average = round(
        (
            assessment.discipline_rating
            + assessment.progress_rating
            + assessment.communication_rating
        )
        / 3,
        1,
    )

    return ClientAssessmentOut(
        id=assessment.id,
        coachId=assessment.coach_id,
        clientId=assessment.client_id,
        coachName=assessment.coach.name if assessment.coach else None,
        clientName=assessment.client.name if assessment.client else None,
        disciplineRating=assessment.discipline_rating,
        progressRating=assessment.progress_rating,
        communicationRating=assessment.communication_rating,
        averageRating=average,
        comment=assessment.comment,
        createdAt=assessment.created_at.isoformat(),
        updatedAt=assessment.updated_at.isoformat(),
    )


async def ensure_client_linked_to_coach(
    coach_id: str,
    client_id: str,
    db: AsyncSession,
):
    res = await db.execute(
        select(ClientProfile).where(
            ClientProfile.user_id == client_id,
            ClientProfile.coach_id == coach_id,
        )
    )

    profile = res.scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=403,
            detail="This client is not linked to this coach",
        )

    return profile


@router.get("/coaches/{coach_id}", response_model=CoachReviewsSummaryOut)
async def get_coach_reviews(
    coach_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public coach reviews summary.
    This endpoint remains public because it may be used on coach profile/explore pages.
    """
    coach_res = await db.execute(
        select(User).where(User.id == coach_id, User.role == "coach")
    )
    coach = coach_res.scalar_one_or_none()

    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    res = await db.execute(
        select(CoachReview)
        .where(CoachReview.coach_id == coach_id)
        .options(selectinload(CoachReview.client))
        .order_by(CoachReview.updated_at.desc())
    )

    reviews = res.scalars().all()
    count = len(reviews)

    average = 0.0

    if count > 0:
        average = round(sum(review.rating for review in reviews) / count, 1)

    return CoachReviewsSummaryOut(
        coachId=coach_id,
        averageRating=average,
        reviewsCount=count,
        reviews=[review_out(review) for review in reviews],
    )


@router.post("/coaches/{coach_id}", response_model=CoachReviewOut)
async def create_or_update_coach_review(
    coach_id: str,
    data: CoachReviewIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Client reviews their linked coach.
    This is not blocked by coach subscription because the action belongs to the client.
    """
    if current_user.role != "client":
        raise HTTPException(status_code=403, detail="Only clients can review coaches")

    coach_res = await db.execute(
        select(User).where(User.id == coach_id, User.role == "coach")
    )
    coach = coach_res.scalar_one_or_none()

    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    await ensure_client_linked_to_coach(coach_id, current_user.id, db)

    existing_res = await db.execute(
        select(CoachReview)
        .where(
            CoachReview.coach_id == coach_id,
            CoachReview.client_id == current_user.id,
        )
        .options(selectinload(CoachReview.client))
    )

    review = existing_res.scalar_one_or_none()

    if review:
        review.rating = data.rating
        review.comment = data.comment
    else:
        review = CoachReview(
            coach_id=coach_id,
            client_id=current_user.id,
            rating=data.rating,
            comment=data.comment,
        )

    db.add(review)
    await db.commit()

    saved_res = await db.execute(
        select(CoachReview)
        .where(CoachReview.id == review.id)
        .options(selectinload(CoachReview.client))
    )
    saved = saved_res.scalar_one()

    return review_out(saved)


@router.get("/clients/{client_id}/assessment", response_model=ClientAssessmentOut | None)
async def get_client_assessment(
    client_id: str,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    """
    Coach can read private client assessment only with active subscription.
    """
    await ensure_client_linked_to_coach(coach.id, client_id, db)

    res = await db.execute(
        select(ClientAssessment)
        .where(
            ClientAssessment.coach_id == coach.id,
            ClientAssessment.client_id == client_id,
        )
        .options(
            selectinload(ClientAssessment.coach),
            selectinload(ClientAssessment.client),
        )
    )

    assessment = res.scalar_one_or_none()

    if not assessment:
        return None

    return assessment_out(assessment)


@router.post("/clients/{client_id}/assessment", response_model=ClientAssessmentOut)
async def create_or_update_client_assessment(
    client_id: str,
    data: ClientAssessmentIn,
    coach: User = Depends(require_active_coach_subscription),
    db: AsyncSession = Depends(get_db),
):
    """
    Coach can create/update private client assessment only with active subscription.
    """
    await ensure_client_linked_to_coach(coach.id, client_id, db)

    existing_res = await db.execute(
        select(ClientAssessment)
        .where(
            ClientAssessment.coach_id == coach.id,
            ClientAssessment.client_id == client_id,
        )
        .options(
            selectinload(ClientAssessment.coach),
            selectinload(ClientAssessment.client),
        )
    )

    assessment = existing_res.scalar_one_or_none()

    if assessment:
        assessment.discipline_rating = data.disciplineRating
        assessment.progress_rating = data.progressRating
        assessment.communication_rating = data.communicationRating
        assessment.comment = data.comment
    else:
        assessment = ClientAssessment(
            coach_id=coach.id,
            client_id=client_id,
            discipline_rating=data.disciplineRating,
            progress_rating=data.progressRating,
            communication_rating=data.communicationRating,
            comment=data.comment,
        )

    db.add(assessment)
    await db.commit()

    saved_res = await db.execute(
        select(ClientAssessment)
        .where(ClientAssessment.id == assessment.id)
        .options(
            selectinload(ClientAssessment.coach),
            selectinload(ClientAssessment.client),
        )
    )
    saved = saved_res.scalar_one()

    return assessment_out(saved)