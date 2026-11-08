import unittest
from sqlalchemy import select
import test_social as social
from app.models.workout import Exercise,WorkoutAssignment
from app.models.exercise_result import ExerciseResult


class ResultIntegrityTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await social.SocialTests.asyncSetUp(self)
        self.workout=WorkoutAssignment(id="integrity_workout",client_id=self.client.id,coach_id=self.coach.id,date="2026-11-09",name="Training",completed=False)
        self.session.add(self.workout)
        self.session.flush()
        self.session.add(Exercise(id="integrity_exercise",workout_id=self.workout.id,name="Bench",sets=3,reps=8,rest_seconds=60))
        self.session.commit()
        self.payload=dict(workout_id=self.workout.id,exercise_id="integrity_exercise",exercise_name="Bench",set_number=1,target_reps=8,actual_reps=8,weight=60)

    async def asyncTearDown(self):
        await social.SocialTests.asyncTearDown(self)

    async def test_retries_and_same_batch_repeats_never_add_fictitious_sets(self):
        first=await self.http.post("/api/v1/exercise-results/bulk",json={"results":[self.payload,self.payload]})
        self.assertEqual(first.status_code,201,first.text)
        self.assertEqual(first.json()[0]["id"],first.json()[1]["id"])
        retry=await self.http.post("/api/v1/exercise-results/bulk",json={"results":[self.payload]})
        self.assertEqual(retry.json()[0]["id"],first.json()[0]["id"])
        self.assertEqual(len(self.session.scalars(select(ExerciseResult)).all()),1)
        revised=await self.http.post("/api/v1/exercise-results",json={**self.payload,"weight":65})
        self.assertEqual(revised.status_code,201,revised.text)
        self.assertEqual(revised.json()["id"],first.json()[0]["id"])
        self.assertEqual(revised.json()["weight"],65)

    async def test_completed_results_are_immutable_but_identical_retry_is_safe(self):
        first=await self.http.post("/api/v1/exercise-results",json=self.payload)
        self.workout.completed=True
        self.session.commit()
        retry=await self.http.post("/api/v1/exercise-results",json=self.payload)
        self.assertEqual(retry.status_code,201,retry.text)
        self.assertEqual(retry.json()["id"],first.json()["id"])
        for data in [{**self.payload,"weight":80},{**self.payload,"set_number":2}]:
            response=await self.http.post("/api/v1/exercise-results",json=data)
            self.assertEqual(response.status_code,409,response.text)
        self.assertEqual(len(self.session.scalars(select(ExerciseResult)).all()),1)

    async def test_result_write_is_owner_scoped_and_missing_exercises_are_rejected(self):
        self.current=self.stranger
        self.assertEqual((await self.http.post("/api/v1/exercise-results",json=self.payload)).status_code,403)
        self.current=self.client
        self.assertEqual((await self.http.post("/api/v1/exercise-results",json={**self.payload,"exercise_id":"missing"})).status_code,404)
        self.assertEqual(len(self.session.scalars(select(ExerciseResult)).all()),0)

    async def test_an_observation_requires_actual_reps_and_finite_weight(self):
        missing={k:v for k,v in self.payload.items() if k!="actual_reps"}
        for data in [missing,{**self.payload,"exercise_name":"   "},{**self.payload,"notes":"x"*2001}]:
            response=await self.http.post("/api/v1/exercise-results",json=data)
            self.assertEqual(response.status_code,422,response.text)
        from app.schemas.exercise_result import ExerciseResultIn
        from pydantic import ValidationError
        for weight in [float("inf"),float("nan")]:
            with self.assertRaises(ValidationError):
                ExerciseResultIn(**{**self.payload,"weight":weight})
