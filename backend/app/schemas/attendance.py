from datetime import date as calendar_date
from pydantic import BaseModel, Field, field_validator


class AttendanceIn(BaseModel):
    model_config = {"extra": "forbid"}
    client_id: str = Field(min_length=1, max_length=128)
    date: str = Field(min_length=10, max_length=10)
    status: str = Field(pattern="^(attended|missed|rest)$")
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("date")
    @classmethod
    def valid_day(cls, value):
        return calendar_date.fromisoformat(value).isoformat()


class AttendanceOut(BaseModel):
    id: str
    clientId: str
    coachId: str
    date: str
    status: str
    notes: str | None = None
