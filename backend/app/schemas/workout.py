from typing import List, Optional

from pydantic import BaseModel, Field


class ExerciseIn(BaseModel):
    id: Optional[str] = None

    # Optional link to frontend exercise library item.
    library_exercise_id: Optional[str] = None

    name: str
    name_ru: Optional[str] = None
    name_kk: Optional[str] = None

    sets: int
    reps: int
    rest_seconds: int

    weight: Optional[float] = None

    notes: Optional[str] = None
    notes_ru: Optional[str] = None
    notes_kk: Optional[str] = None

    image_url: Optional[str] = None
    gif_url: Optional[str] = None

    # Stored in DB as JSON string, returned to frontend as list.
    animation_frames: List[str] = Field(default_factory=list)

    muscle_group: Optional[str] = None

    tempo: Optional[str] = None
    target_rpe: Optional[float] = None
    order: Optional[int] = None


class ExerciseOut(BaseModel):
    id: str
    workoutId: str

    libraryExerciseId: Optional[str] = None

    name: str
    nameRu: Optional[str] = None
    nameKk: Optional[str] = None

    sets: int
    reps: int
    restSeconds: int

    weight: Optional[float] = None

    notes: Optional[str] = None
    notesRu: Optional[str] = None
    notesKk: Optional[str] = None

    imageUrl: Optional[str] = None
    gifUrl: Optional[str] = None
    animationFrames: List[str] = Field(default_factory=list)

    muscleGroup: Optional[str] = None

    tempo: Optional[str] = None
    targetRpe: Optional[float] = None
    order: Optional[int] = None

    model_config = {"from_attributes": True}


class WorkoutIn(BaseModel):
    client_id: str
    date: str
    time: Optional[str] = None

    name: str
    name_ru: Optional[str] = None
    name_kk: Optional[str] = None

    description: Optional[str] = None
    description_ru: Optional[str] = None
    description_kk: Optional[str] = None

    category: Optional[str] = None
    category_ru: Optional[str] = None
    category_kk: Optional[str] = None

    duration_minutes: Optional[int] = None

    source: Optional[str] = "manual"

    weekly_plan_id: Optional[str] = None
    weekly_plan_title: Optional[str] = None
    weekly_plan_title_ru: Optional[str] = None
    weekly_plan_title_kk: Optional[str] = None
    weekly_plan_day_index: Optional[int] = None

    difficulty: Optional[str] = None

    focus: Optional[str] = None
    focus_ru: Optional[str] = None
    focus_kk: Optional[str] = None

    coach_notes: Optional[str] = None
    coach_notes_ru: Optional[str] = None
    coach_notes_kk: Optional[str] = None

    exercises: List[ExerciseIn] = Field(default_factory=list)


class WorkoutUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None

    name: Optional[str] = None
    name_ru: Optional[str] = None
    name_kk: Optional[str] = None

    description: Optional[str] = None
    description_ru: Optional[str] = None
    description_kk: Optional[str] = None

    category: Optional[str] = None
    category_ru: Optional[str] = None
    category_kk: Optional[str] = None

    duration_minutes: Optional[int] = None
    completed: Optional[bool] = None

    source: Optional[str] = None

    weekly_plan_id: Optional[str] = None
    weekly_plan_title: Optional[str] = None
    weekly_plan_title_ru: Optional[str] = None
    weekly_plan_title_kk: Optional[str] = None
    weekly_plan_day_index: Optional[int] = None

    difficulty: Optional[str] = None

    focus: Optional[str] = None
    focus_ru: Optional[str] = None
    focus_kk: Optional[str] = None

    coach_notes: Optional[str] = None
    coach_notes_ru: Optional[str] = None
    coach_notes_kk: Optional[str] = None

    exercises: Optional[List[ExerciseIn]] = None


class AssignWeeklyPlanIn(BaseModel):
    client_id: str
    plan_id: str
    start_date: Optional[str] = None


class AssignWeeklyPlanOut(BaseModel):
    workoutIds: List[str]
    exerciseIds: List[str]
    workouts: List["WorkoutOut"] = Field(default_factory=list)


class WorkoutOut(BaseModel):
    id: str
    coachId: str
    clientId: str

    date: str
    time: Optional[str] = None

    name: str
    nameRu: Optional[str] = None
    nameKk: Optional[str] = None

    description: Optional[str] = None
    descriptionRu: Optional[str] = None
    descriptionKk: Optional[str] = None

    category: Optional[str] = None
    categoryRu: Optional[str] = None
    categoryKk: Optional[str] = None

    completed: bool
    completedAt: Optional[str] = None

    durationMinutes: Optional[int] = None

    source: Optional[str] = None

    weeklyPlanId: Optional[str] = None
    weeklyPlanTitle: Optional[str] = None
    weeklyPlanTitleRu: Optional[str] = None
    weeklyPlanTitleKk: Optional[str] = None
    weeklyPlanDayIndex: Optional[int] = None

    difficulty: Optional[str] = None

    focus: Optional[str] = None
    focusRu: Optional[str] = None
    focusKk: Optional[str] = None

    coachNotes: Optional[str] = None
    coachNotesRu: Optional[str] = None
    coachNotesKk: Optional[str] = None

    createdAt: Optional[str] = None

    exercises: List[ExerciseOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


AssignWeeklyPlanOut.model_rebuild()