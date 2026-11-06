"""Bounded public place details; provider keys and raw errors never reach clients."""
import asyncio
import json
import time
import urllib.parse
import urllib.request
from collections import OrderedDict, deque
from fastapi import HTTPException

_cache = OrderedDict()
_limits = OrderedDict()
_slots = asyncio.Semaphore(4)

def check_budget(user_id):
    now = time.monotonic()
    calls = _limits.setdefault(user_id, deque())
    while calls and calls[0] < now - 60:
        calls.popleft()
    if len(calls) >= 40:
        raise HTTPException(429, "Too many place detail requests", headers={"Retry-After": "60"})
    calls.append(now)
    _limits.move_to_end(user_id)
    while len(_limits) > 4096:
        _limits.popitem(last=False)

def _google_url(value):
    try:
        parsed = urllib.parse.urlsplit(str(value or ""))
    except ValueError:
        return None
    return str(value) if parsed.scheme == "https" and (parsed.hostname == "google.com" or (parsed.hostname or "").endswith(".google.com")) else None

def normalize_details(raw, place_id):
    reviews = []
    raw_reviews = raw.get("reviews")
    for item in (raw_reviews if isinstance(raw_reviews, list) else [])[:5]:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "")[:5000]
        reviews.append({"author": str(item.get("author_name") or "")[:200], "authorUrl": _google_url(item.get("author_url")), "rating": item.get("rating") if isinstance(item.get("rating"), (int, float)) and 1 <= item["rating"] <= 5 else None, "text": text, "publishedAt": item.get("time") if isinstance(item.get("time"), int) else None})
    summary = raw.get("editorial_summary")
    hours = raw.get("opening_hours")
    lines = hours.get("weekday_text") if isinstance(hours, dict) else None
    rating, count = raw.get("rating"), raw.get("user_ratings_total")
    return {"id": "google_" + place_id, "description": str(summary.get("overview") or "")[:5000] if isinstance(summary, dict) else "", "rating": rating if isinstance(rating, (int, float)) and 0 <= rating <= 5 else None, "reviewCount": count if isinstance(count, int) and count >= 0 else 0, "reviews": reviews, "openingHours": [str(line)[:200] for line in lines[:7]] if isinstance(lines, list) else [], "source": "Google", "sourceUrl": _google_url(raw.get("url")) or "https://www.google.com/maps/search/?api=1&query=place&query_place_id=" + urllib.parse.quote(place_id, safe="")}

def _request_details(api_key, place_id, language):
    params = urllib.parse.urlencode({"key": api_key, "place_id": place_id, "language": language, "fields": "editorial_summary,rating,user_ratings_total,reviews,opening_hours,url"})
    request = urllib.request.Request("https://maps.googleapis.com/maps/api/place/details/json?" + params, headers={"Accept": "application/json", "User-Agent": "CoachFlow/1.0"})
    with urllib.request.urlopen(request, timeout=8) as response:
        payload = response.read(1000001)
    if len(payload) > 1000000:
        raise ValueError("provider response too large")
    data = json.loads(payload)
    if data.get("status") != "OK" or not isinstance(data.get("result"), dict):
        raise ValueError("provider unavailable")
    return normalize_details(data["result"], place_id)

async def google_place_details(api_key, place_id, language):
    key = (place_id, language)
    cached = _cache.get(key)
    if cached and time.monotonic() - cached[0] < 180:
        return cached[1]
    if not api_key:
        raise HTTPException(503, "Place reviews are temporarily unavailable")
    acquired = False
    try:
        await asyncio.wait_for(_slots.acquire(), timeout=2)
        acquired = True
        result = await asyncio.to_thread(_request_details, api_key, place_id, language)
    except Exception:
        raise HTTPException(503, "Place reviews are temporarily unavailable") from None
    finally:
        if acquired:
            _slots.release()
    _cache[key] = (time.monotonic(), result)
    _cache.move_to_end(key)
    while len(_cache) > 128:
        _cache.popitem(last=False)
    return result
