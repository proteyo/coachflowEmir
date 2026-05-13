from pydantic import BaseModel, Field


class AttendanceIn(BaseModel):
    client_id: str
    date: str
    status: str = Field(pattern="^(attended|missed|rest)$")
    notes: str | None = None


class AttendanceOut(BaseModel):
    id: str
    clientId: str
    coachId: str
    date: str
    status: str
    notes: str | None = None