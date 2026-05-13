from typing import List, Optional
from pydantic import BaseModel


class ExerciseIn(BaseModel):
    id: Optional[str] = None
    name: str
    sets: int
    reps: int
    rest_seconds: int
    weight: Optional[float] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    muscle_group: Optional[str] = None


class ExerciseOut(BaseModel):
    id: str
    workoutId: str
    name: str
    sets: int
    reps: int
    restSeconds: int
    weight: Optional[float] = None
    notes: Optional[str] = None
    imageUrl: Optional[str] = None
    muscleGroup: Optional[str] = None

    model_config = {"from_attributes": True}


class WorkoutIn(BaseModel):
    client_id: str
    date: str
    time: Optional[str] = None
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    duration_minutes: Optional[int] = None
    exercises: List[ExerciseIn] = []


class WorkoutUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    duration_minutes: Optional[int] = None
    completed: Optional[bool] = None
    exercises: Optional[List[ExerciseIn]] = None


class WorkoutOut(BaseModel):
    id: str
    coachId: str
    clientId: str
    date: str
    time: Optional[str] = None
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    completed: bool
    completedAt: Optional[str] = None
    durationMinutes: Optional[int] = None
    exercises: List[ExerciseOut] = []

    model_config = {"from_attributes": True}
