"""Small deterministic text filter plus operator-configurable phrases.

This is not image classification or a substitute for human report review.
Do not silently score users or send their private text to an external AI.
"""
import json
import os
import unicodedata
from fastapi import HTTPException

DEFAULT_PHRASES = ("i will kill you", "я тебя убью", "сені өлтіремін")


def validate_content(text: str | None):
    if not text:
        return
    normalized = " ".join(unicodedata.normalize("NFKC", text).casefold().split())
    phrases = DEFAULT_PHRASES
    try:
        configured = json.loads(os.getenv("MODERATION_BLOCKED_PHRASES", "[]"))
        if isinstance(configured, list):
            phrases += tuple(value.casefold().strip() for value in configured[:500] if isinstance(value, str) and 3 <= len(value) <= 150)
    except (ValueError, TypeError):
        pass  # Invalid optional configuration never disables the baseline.
    if any(phrase in normalized for phrase in phrases):
        raise HTTPException(400, "CONTENT_NOT_ALLOWED")
