import json
from pathlib import Path
from pydantic import BaseModel, StrictBool, field_validator

LEGAL_VERSION = json.loads((Path(__file__).resolve().parents[1] / "legal_content.json").read_text(encoding="utf-8"))["version"]


class LegalAcceptance(BaseModel):
    terms_version: str
    adult_confirmed: StrictBool
    health_data_consent: StrictBool = False

    @field_validator("terms_version")
    @classmethod
    def current_version(cls, value):
        if value != LEGAL_VERSION:
            raise ValueError("Current terms must be accepted")
        return value

    @field_validator("adult_confirmed")
    @classmethod
    def adult_only(cls, value):
        if value is not True:
            raise ValueError("CoachFlow is for adults aged 18 or older")
        return value
