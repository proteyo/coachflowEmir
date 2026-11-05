from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Literal
import re


DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


class SupplementItemIn(BaseModel):
    id: Optional[str] = None
    name: str = Field(min_length=1, max_length=160)
    dosage: str = Field(min_length=1, max_length=200)
    times_per_day: int = Field(ge=1, le=24)
    specific_times: List[str] = Field(default_factory=list, max_length=24)
    days_of_week: List[Literal["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]] = Field(default_factory=lambda: DEFAULT_DAYS.copy(), min_length=1, max_length=7)
    notes: Optional[str] = Field(default=None, max_length=2000)


    @field_validator("name", "dosage")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Required field")
        return value.strip()

    @model_validator(mode="after")
    def schedule_valid(self):
        if self.times_per_day != len(self.specific_times) or len(set(self.specific_times)) != len(self.specific_times):
            raise ValueError("Provide a unique time for each dose")
        if any(not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value) for value in self.specific_times):
            raise ValueError("Invalid dose time")
        if len(set(self.days_of_week)) != len(self.days_of_week):
            raise ValueError("Duplicate days")
        return self


class SupplementItemOut(BaseModel):
    id: str
    planId: str
    name: str
    dosage: str
    timesPerDay: int
    specificTimes: List[str]
    daysOfWeek: List[str]
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class SupplementPlanIn(BaseModel):
    client_id: str
    start_date: str
    items: List[SupplementItemIn] = Field(default_factory=list, max_length=100)


class SupplementPlanOut(BaseModel):
    id: str
    coachId: str
    clientId: str
    startDate: str
    items: List[SupplementItemOut] = []

    model_config = {"from_attributes": True}


class SupplementLogIn(BaseModel):
    supplement_item_id: str
    date: str
    time: str
    taken: bool


class SupplementLogOut(BaseModel):
    id: str
    clientId: str
    supplementItemId: str
    date: str
    time: str
    taken: bool

    model_config = {"from_attributes": True}