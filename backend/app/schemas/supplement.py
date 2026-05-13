from typing import List, Optional
from pydantic import BaseModel


DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


class SupplementItemIn(BaseModel):
    id: Optional[str] = None
    name: str
    dosage: str
    times_per_day: int
    specific_times: List[str] = []
    days_of_week: List[str] = DEFAULT_DAYS
    notes: Optional[str] = None


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
    items: List[SupplementItemIn] = []


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