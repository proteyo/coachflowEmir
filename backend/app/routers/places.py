"""
Places router.

GET /places
GET /places?type=gym
GET /places?type=nutrition
GET /places?type=shop
"""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.place import Place
from app.models.user import User
from app.schemas.other import PlaceOut
from app.services.mappers import place_out


router = APIRouter(prefix="/places", tags=["Places"])


PlaceType = Literal["gym", "nutrition", "shop"]


@router.get("", response_model=list[PlaceOut])
async def list_places(
    place_type: PlaceType | None = Query(
        default=None,
        alias="type",
        description="Optional place type filter: gym, nutrition or shop.",
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=200,
        description="Maximum number of places returned.",
    ),
    offset: int = Query(
        default=0,
        ge=0,
        description="Number of places to skip.",
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PlaceOut]:
    query = select(Place)

    if place_type is not None:
        query = query.where(Place.type == place_type)

    query = (
        query
        .order_by(Place.name.asc())
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(query)
    places = result.scalars().all()

    return [place_out(place) for place in places]