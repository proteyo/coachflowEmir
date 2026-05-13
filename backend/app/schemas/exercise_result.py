from pydantic import BaseModel, Field


class ExerciseResultIn(BaseModel):
    workout_id: str
    exercise_id: str | None = None
    exercise_name: str
    muscle_group: str | None = None

    set_number: int = Field(ge=1)
    target_reps: int = Field(default=10, ge=1)
    actual_reps: int = Field(default=10, ge=0)
    weight: float | None = Field(default=None, ge=0)

    notes: str | None = None


class ExerciseResultBulkIn(BaseModel):
    results: list[ExerciseResultIn]


class ExerciseResultOut(BaseModel):
    id: str
    clientId: str
    coachId: str
    workoutId: str
    exerciseId: str | None = None
    exerciseName: str
    muscleGroup: str | None = None
    setNumber: int
    targetReps: int
    actualReps: int
    weight: float | None = None
    notes: str | None = None
    createdAt: str


class ExerciseLatestResultOut(BaseModel):
    exerciseName: str
    muscleGroup: str | None = None
    workoutId: str
    createdAt: str
    sets: list[ExerciseResultOut]