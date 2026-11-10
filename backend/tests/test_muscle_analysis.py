import unittest
from datetime import datetime, timezone
from urllib.parse import urlencode
from pydantic import ValidationError
import test_social as social
from app.models.exercise_result import ExerciseResult
from app.schemas.auth import RegisterRequest


class MuscleAnalysisTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await social.SocialTests.asyncSetUp(self)

    async def asyncTearDown(self):
        await social.SocialTests.asyncTearDown(self)

    async def test_gender_is_required_and_cannot_be_changed_by_direct_api(self):
        body = dict(name="Client", email="new@example.com", password="Strong123!", role="client",age=30,terms_version="2026-11-10",adult_confirmed=True,health_data_consent=True)
        for gender in [None, "other", ""]:
            with self.assertRaises(ValidationError):
                RegisterRequest(**body, gender=gender)
        self.assertEqual(RegisterRequest(**body, gender="female").gender, "female")
        same = await self.http.patch("/api/v1/users/me/client-profile", json={"gender": "male"})
        self.assertEqual(same.status_code, 200, same.text)
        changed = await self.http.patch("/api/v1/users/me/client-profile", json={"gender": "female"})
        self.assertEqual(changed.status_code, 422, changed.text)
        current = await self.http.get("/api/v1/users/me/client-profile")
        self.assertEqual(current.json()["gender"], "male")

    async def test_results_window_pagination_and_ownership_are_enforced_on_server(self):
        for number, (client, at) in enumerate([
            (self.client, "2026-11-04"), (self.client, "2026-11-05"),
            (self.client, "2026-10-01"), (self.stranger, "2026-11-04"),
        ]):
            self.session.add(ExerciseResult(id=f"analysis_{number}",client_id=client.id,coach_id=self.coach.id,workout_id="fixture",exercise_name="Barbell Squat",set_number=1,actual_reps=8,weight=80,created_at=datetime.fromisoformat(at).replace(tzinfo=timezone.utc)))
        self.session.commit()
        params=dict(client_id=self.stranger.id,date_from="2026-11-02T00:00:00Z",date_to="2026-11-09T00:00:00Z",limit=1)
        pages=[]
        for offset in [0,1,2]:
            response=await self.http.get("/api/v1/exercise-results?"+urlencode(dict(params,offset=offset)))
            self.assertEqual(response.status_code,200,response.text)
            pages.extend(response.json())
        self.assertEqual({p["id"] for p in pages},{"analysis_0","analysis_1"})
        self.assertTrue(all(p["clientId"]==self.client.id for p in pages))
        self.current=self.stranger
        response=await self.http.get("/api/v1/exercise-results?"+urlencode(dict(params,client_id=self.client.id)))
        self.assertEqual(response.status_code,403,response.text)

    async def test_invalid_or_unbounded_analysis_windows_are_rejected(self):
        for params in [dict(limit=501),dict(limit=0),dict(offset=-1),dict(date_from="2026-11-01T00:00:00Z"),dict(date_from="2026-01-01T00:00:00Z",date_to="2026-11-01T00:00:00Z",limit=500),dict(date_from="2026-11-01",date_to="2026-11-03",limit=500)]:
            response=await self.http.get("/api/v1/exercise-results?"+urlencode(params))
            self.assertEqual(response.status_code,422,response.text)
