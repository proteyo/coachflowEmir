"""
Places router.

Endpoints:
GET /places
GET /places?type=gym
GET /places?type=nutrition
GET /places?type=shop

GET /places/nearby?lat=43.23&lng=76.88
GET /places/nearby?lat=43.23&lng=76.88&type=gym
GET /places/nearby?lat=43.23&lng=76.88&type=nutrition
GET /places/nearby?lat=43.23&lng=76.88&type=shop

Production behavior:
- /places returns saved places from PostgreSQL.
- /places/nearby tries Google Places API first.
- If Google Maps API key is missing or Google fails, it falls back to saved places.
"""

import asyncio
import logging
import math
import urllib.parse
import urllib.request
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.place import Place
from app.models.user import User
from app.schemas.other import PlaceOut
from app.services.mappers import place_out

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/places", tags=["Places"])

settings = get_settings()

PlaceType = Literal["gym", "nutrition", "shop"]

GOOGLE_PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"

DEFAULT_RADIUS_METERS = 3000
MAX_RADIUS_METERS = 10000
DEFAULT_LIMIT = 30
MAX_LIMIT = 60


def _haversine_km(
    lat1: float,
    lng1: float,
    lat2: float,
    lng2: float,
) -> float:
    """
    Calculates distance between two coordinates in kilometers.
    """
    earth_radius_km = 6371.0

    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)

    r_lat1 = math.radians(lat1)
    r_lat2 = math.radians(lat2)

    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(r_lat1) * math.cos(r_lat2) * math.sin(d_lng / 2) ** 2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return earth_radius_km * c


def _validate_coordinates(lat: float, lng: float) -> None:
    if lat < -90 or lat > 90:
        raise HTTPException(
            status_code=400,
            detail="lat must be between -90 and 90.",
        )

    if lng < -180 or lng > 180:
        raise HTTPException(
            status_code=400,
            detail="lng must be between -180 and 180.",
        )


def _place_to_nearby_dict(
    place: Place,
    user_lat: float,
    user_lng: float,
) -> dict[str, Any]:
    distance_km = _haversine_km(
        user_lat,
        user_lng,
        float(place.latitude),
        float(place.longitude),
    )

    return {
        "id": place.id,
        "type": place.type,
        "name": place.name,
        "address": place.address,
        "latitude": float(place.latitude),
        "longitude": float(place.longitude),
        "description": place.description,
        "imageUrl": place.image_url,
        "rating": place.rating,
        "distanceKm": round(distance_km, 3),
        "source": "database",
    }


async def _get_saved_places(
    db: AsyncSession,
    user_lat: float,
    user_lng: float,
    place_type: PlaceType | None,
    limit: int,
) -> list[dict[str, Any]]:
    query = select(Place)

    if place_type is not None:
        query = query.where(Place.type == place_type)

    result = await db.execute(query)
    places = result.scalars().all()

    items = [
        _place_to_nearby_dict(
            place=place,
            user_lat=user_lat,
            user_lng=user_lng,
        )
        for place in places
    ]

    items.sort(
        key=lambda item: (
            item.get("distanceKm", 999999),
            -(float(item.get("rating") or 0)),
            str(item.get("name") or ""),
        )
    )

    return items[:limit]


def _google_query_for_type(place_type: PlaceType) -> dict[str, str]:
    """
    Maps CoachFlow categories to Google Places search parameters.

    Google Places supports official place types like gym, restaurant and store.
    For nutrition/shop we add keywords to get more relevant results.
    """
    if place_type == "gym":
        return {
            "type": "gym",
            "keyword": "fitness gym",
        }

    if place_type == "nutrition":
        return {
            "type": "restaurant",
            "keyword": "healthy food nutrition protein smoothie",
        }

    return {
        "type": "store",
        "keyword": "sports shop sporting goods fitness supplements",
    }


def _google_place_to_nearby_dict(
    raw: dict[str, Any],
    coachflow_type: PlaceType,
    user_lat: float,
    user_lng: float,
) -> dict[str, Any] | None:
    geometry = raw.get("geometry") or {}
    location = geometry.get("location") or {}

    lat = location.get("lat")
    lng = location.get("lng")

    if lat is None or lng is None:
        return None

    try:
        place_lat = float(lat)
        place_lng = float(lng)
    except (TypeError, ValueError):
        return None

    name = str(raw.get("name") or "Unknown place").strip()

    if not name:
        return None

    address = str(
        raw.get("vicinity")
        or raw.get("formatted_address")
        or "Address is not available"
    )

    rating_raw = raw.get("rating")

    try:
        rating = float(rating_raw) if rating_raw is not None else None
    except (TypeError, ValueError):
        rating = None

    distance_km = _haversine_km(
        user_lat,
        user_lng,
        place_lat,
        place_lng,
    )

    google_place_id = raw.get("place_id") or f"{name}-{place_lat}-{place_lng}"

    return {
        "id": f"google_{google_place_id}",
        "googlePlaceId": google_place_id,
        "type": coachflow_type,
        "name": name,
        "address": address,
        "latitude": place_lat,
        "longitude": place_lng,
        "description": None,
        "imageUrl": None,
        "rating": rating,
        "distanceKm": round(distance_km, 3),
        "source": "google_places",
        "openNow": (raw.get("opening_hours") or {}).get("open_now"),
        "userRatingsTotal": raw.get("user_ratings_total"),
    }


def _google_nearby_request_sync(
    *,
    api_key: str,
    lat: float,
    lng: float,
    place_type: PlaceType,
    radius: int,
) -> list[dict[str, Any]]:
    google_params = _google_query_for_type(place_type)

    query_params = {
        "key": api_key,
        "location": f"{lat},{lng}",
        "radius": str(radius),
        "type": google_params["type"],
        "keyword": google_params["keyword"],
    }

    url = f"{GOOGLE_PLACES_NEARBY_URL}?{urllib.parse.urlencode(query_params)}"

    request = urllib.request.Request(
        url=url,
        headers={
            "Accept": "application/json",
            "User-Agent": "CoachFlow-Backend/1.0",
        },
        method="GET",
    )

    with urllib.request.urlopen(request, timeout=8) as response:
        payload = response.read().decode("utf-8")

    import json

    data = json.loads(payload)

    status = data.get("status")

    if status not in {"OK", "ZERO_RESULTS"}:
        error_message = data.get("error_message") or status or "Unknown Google Places error"
        raise RuntimeError(str(error_message))

    results = data.get("results") or []

    if not isinstance(results, list):
        return []

    items: list[dict[str, Any]] = []

    for raw_place in results:
        if not isinstance(raw_place, dict):
            continue

        item = _google_place_to_nearby_dict(
            raw=raw_place,
            coachflow_type=place_type,
            user_lat=lat,
            user_lng=lng,
        )

        if item is not None:
            items.append(item)

    return items


async def _load_google_places(
    *,
    api_key: str,
    lat: float,
    lng: float,
    place_type: PlaceType | None,
    radius: int,
) -> list[dict[str, Any]]:
    """
    Loads places from Google Places API.

    If place_type is None, queries all supported CoachFlow categories and merges them.
    """
    types_to_load: list[PlaceType]

    if place_type is None:
        types_to_load = ["gym", "nutrition", "shop"]
    else:
        types_to_load = [place_type]

    tasks = [
        asyncio.to_thread(
            _google_nearby_request_sync,
            api_key=api_key,
            lat=lat,
            lng=lng,
            place_type=item,
            radius=radius,
        )
        for item in types_to_load
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    merged: list[dict[str, Any]] = []

    for result in results:
        if isinstance(result, Exception):
            logger.warning("Google Places request failed: %s", result)
            continue

        merged.extend(result)

    deduplicated: dict[str, dict[str, Any]] = {}

    for item in merged:
        item_id = str(item.get("id") or "")

        if not item_id:
            continue

        previous = deduplicated.get(item_id)

        if previous is None:
            deduplicated[item_id] = item
            continue

        previous_rating = float(previous.get("rating") or 0)
        current_rating = float(item.get("rating") or 0)

        if current_rating > previous_rating:
            deduplicated[item_id] = item

    items = list(deduplicated.values())

    items.sort(
        key=lambda item: (
            item.get("distanceKm", 999999),
            -(float(item.get("rating") or 0)),
            -int(item.get("userRatingsTotal") or 0),
            str(item.get("name") or ""),
        )
    )

    return items


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

    query = query.order_by(Place.name.asc()).offset(offset).limit(limit)

    result = await db.execute(query)
    places = result.scalars().all()

    return [place_out(place) for place in places]


@router.get("/nearby")
async def nearby_places(
    lat: float = Query(
        ...,
        description="User latitude.",
    ),
    lng: float = Query(
        ...,
        description="User longitude.",
    ),
    place_type: PlaceType | None = Query(
        default=None,
        alias="type",
        description="Optional place type filter: gym, nutrition or shop.",
    ),
    radius: int = Query(
        default=DEFAULT_RADIUS_METERS,
        ge=500,
        le=MAX_RADIUS_METERS,
        description="Search radius in meters.",
    ),
    limit: int = Query(
        default=DEFAULT_LIMIT,
        ge=1,
        le=MAX_LIMIT,
        description="Maximum number of nearby places returned.",
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    _validate_coordinates(lat, lng)

    api_key = (settings.GOOGLE_MAPS_API_KEY or "").strip()

    saved_places = await _get_saved_places(
        db=db,
        user_lat=lat,
        user_lng=lng,
        place_type=place_type,
        limit=limit,
    )

    if not api_key:
        return saved_places

    google_places = await _load_google_places(
        api_key=api_key,
        lat=lat,
        lng=lng,
        place_type=place_type,
        radius=radius,
    )

    if not google_places:
        return saved_places

    combined_by_id: dict[str, dict[str, Any]] = {}

    for item in saved_places:
        combined_by_id[str(item["id"])] = item

    for item in google_places:
        combined_by_id[str(item["id"])] = item

    items = list(combined_by_id.values())

    items.sort(
        key=lambda item: (
            item.get("distanceKm", 999999),
            -(float(item.get("rating") or 0)),
            -int(item.get("userRatingsTotal") or 0),
            str(item.get("name") or ""),
        )
    )

    return items[:limit]