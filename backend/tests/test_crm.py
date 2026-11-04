"""CRM, archival and public profile authorization at the HTTP boundary."""
import json
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy import select
import test_social as social
from app.models.profile import CoachProfile, ClientProfile
from app.models.subscription import Subscription
from app.models.engagement import ClientEngagement, ClientPayment
from app.models.workout import WorkoutAssignment
from app.models.message import Message
from app.models.attendance import Attendance
from app.models.social import SocialProfile
from app.models.user import User


class CrmTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await social.SocialTests.asyncSetUp(self)
        self.session.add(CoachProfile(user_id=self.coach.id, specialty="Strength", bio="About me", experience_years=7, achievements=json.dumps(["Champion"]), certificates=json.dumps(["Certified"]), cover_image_url="/api/v1/uploads/avatars/u_coach_cover.jpg"))
        self.session.flush()
        self.session.add(Subscription(coach_id=self.coach.id, status="active", plan_code="free", price=0, client_limit=3, end_date=datetime.now(timezone.utc) + timedelta(days=30)))
        self.session.commit()
        self.current = self.coach

    async def asyncTearDown(self):
        await social.SocialTests.asyncTearDown(self)

    async def test_archive_preserves_data_but_closes_every_training_router(self):
        workout = WorkoutAssignment(coach_id=self.coach.id, client_id=self.client.id, date="2026-11-01", name="Keep")
        message = Message(sender_id=self.coach.id, receiver_id=self.client.id, content="Keep chat")
        self.session.add_all([workout, message, Attendance(coach_id=self.coach.id, client_id=self.client.id, date="2026-11-01", status="missed")]); self.session.commit()
        response = await self.http.delete(f"/api/v1/clients/{self.client.id}")
        self.assertEqual(response.status_code, 204, response.text)
        self.assertIsNotNone(self.session.get(WorkoutAssignment, workout.id))
        self.assertIsNotNone(self.session.get(Message, message.id))
        self.assertEqual(len(self.session.scalars(select(Attendance)).all()), 1)
        self.current = self.client
        self.assertFalse((await self.http.get("/api/v1/crm/access")).json()["allowed"])
        for path in ("workouts", "progress", "attendance", "weekly-goals", "streak", "supplements/plans", "exercise-results"):
            response = await self.http.get("/api/v1/" + path)
            self.assertEqual(response.status_code, 403, (path, response.text))
        self.assertEqual((await self.http.get(f"/api/v1/social/profile/{self.coach.id}")).status_code, 200)
        self.assertEqual((await self.http.post("/api/v1/messages", json={"receiver_id": self.coach.id, "content": "Still here"})).status_code, 201)

    async def test_expiry_and_resume_preserve_assignment_and_enforce_quota(self):
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date()
        self.session.add(ClientEngagement(coach_id=self.coach.id, client_id=self.client.id, ends_on=yesterday)); self.session.commit()
        self.current = self.client
        self.assertFalse((await self.http.get("/api/v1/crm/access")).json()["allowed"])
        self.current = self.coach
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()
        result = await self.http.patch(f"/api/v1/crm/clients/{self.client.id}", json={"status": "active", "ends_on": tomorrow})
        self.assertEqual(result.status_code, 200, result.text)
        self.current = self.client
        self.assertTrue((await self.http.get("/api/v1/crm/access")).json()["allowed"])
        self.current = self.coach
        await self.http.delete(f"/api/v1/clients/{self.client.id}")
        subscription = self.session.scalar(select(Subscription)); subscription.client_limit = 1
        self.session.add(ClientProfile(user_id=self.stranger.id, coach_id=self.coach.id)); self.session.commit()
        result = await self.http.patch(f"/api/v1/crm/clients/{self.client.id}", json={"status": "active"})
        self.assertEqual(result.status_code, 403, result.text)
        self.assertIsNone(self.session.get(ClientProfile, self.client.id).coach_id)

    async def test_old_coach_cannot_steal_client_or_read_new_coach_data(self):
        await self.http.delete(f"/api/v1/clients/{self.client.id}")
        other = User(id="other_coach", role="coach", name="Other", email="other@example.com", password_hash="test", email_verified=True)
        self.session.add(other); self.session.flush()
        self.session.get(ClientProfile, self.client.id).coach_id = other.id; self.session.commit()
        result = await self.http.patch(f"/api/v1/crm/clients/{self.client.id}", json={"status": "active"})
        self.assertEqual(result.status_code, 409, result.text)
        profile = (await self.http.get(f"/api/v1/social/profile/{self.client.id}")).json()
        self.assertFalse(profile["canSeeTraining"])
        self.assertIsNone(profile["attendance"])

    async def test_decimal_payments_are_private_idempotent_and_not_forgeable(self):
        today = datetime.now(timezone.utc).date().isoformat()
        body = {"amount": "0.10", "paid_on": today, "request_id": "request-0001"}
        first = await self.http.post(f"/api/v1/crm/clients/{self.client.id}/payments", json=body)
        retry = await self.http.post(f"/api/v1/crm/clients/{self.client.id}/payments", json=body)
        self.assertEqual(first.status_code, 201, first.text)
        self.assertEqual(first.json(), retry.json())
        await self.http.post(f"/api/v1/crm/clients/{self.client.id}/payments", json={**body, "amount": "0.20", "request_id": "request-0002"})
        result = (await self.http.get("/api/v1/crm")).json()
        self.assertEqual(Decimal(result["received"]), Decimal("0.30"))
        self.assertEqual(len(result["payments"]), 2)
        self.current = self.client
        self.assertEqual((await self.http.get("/api/v1/crm")).status_code, 403)
        self.assertEqual((await self.http.delete(f"/api/v1/crm/payments/{first.json()['id']}")).status_code, 403)
        self.current = self.coach
        self.assertEqual((await self.http.patch(f"/api/v1/crm/clients/{self.stranger.id}", json={"monthly_fee": "1"})).status_code, 404)
        for invalid in ({"coach_id": self.stranger.id}, {"amount": "NaN"}, {"amount": "1; DROP TABLE users"}, {"paid_on": "2099-01-01"}):
            response = await self.http.post(f"/api/v1/crm/clients/{self.client.id}/payments", json={**body, **invalid})
            self.assertEqual(response.status_code, 422, response.text)

    async def test_reviews_author_identity_attendance_and_public_professional_fields(self):
        self.session.add(Attendance(coach_id=self.coach.id, client_id=self.client.id, date="2026-11-01", status="missed")); self.session.commit()
        payload = {"disciplineRating": 5, "progressRating": 4, "communicationRating": 5, "comment": "Good"}
        result = await self.http.post(f"/api/v1/reviews/clients/{self.client.id}/assessment", json=payload)
        self.assertEqual(result.status_code, 200, result.text)
        result = await self.http.post(f"/api/v1/reviews/clients/{self.client.id}/assessment", json={**payload, "coachId": self.stranger.id})
        self.assertEqual(result.status_code, 422)
        profile = (await self.http.get(f"/api/v1/social/profile/{self.client.id}")).json()
        self.assertTrue(profile["canAssess"])
        self.assertEqual(profile["attendance"]["missed"], 1)
        self.assertEqual(profile["assessments"][0]["author"]["experienceYears"], 7)
        self.assertEqual(profile["assessments"][0]["author"]["role"], "coach")
        self.current = self.stranger
        profile = (await self.http.get(f"/api/v1/social/profile/{self.client.id}")).json()
        self.assertFalse(profile["isOwn"]); self.assertFalse(profile["canAssess"]); self.assertFalse(profile["canManageClient"])
        self.assertIsNone(profile["attendance"]); self.assertEqual(len(profile["assessments"]), 1)
        coach = (await self.http.get(f"/api/v1/social/profile/{self.coach.id}")).json()
        self.assertEqual(coach["coach"]["certificates"], ["Certified"])
        self.assertIn("cover", coach["coach"]["coverImageUrl"])
        self.assertNotIn("monthlyFee", json.dumps(coach))

    async def test_message_injection_is_stored_as_literal_text(self):
        attack = "'; DROP TABLE users; -- <script>fetch('/crm')</script>"
        result = await self.http.post("/api/v1/messages", json={"receiver_id": self.client.id, "content": attack})
        self.assertEqual(result.status_code, 201, result.text)
        self.assertEqual(self.session.scalar(select(Message)).content, attack)
        self.assertEqual(len(self.session.scalars(select(User)).all()), 3)

    async def test_empty_bio_does_not_break_cover_save_or_public_profile(self):
        cover = "/api/v1/uploads/avatars/u_coach_new.jpg"
        response = await self.http.patch("/api/v1/users/me/coach-profile", json={"bio": "", "specialty": "", "cover_image_url": cover})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["bio"], "")
        self.current = self.client
        public = (await self.http.get(f"/api/v1/social/profile/{self.coach.id}")).json()
        self.assertEqual(public["coach"]["coverImageUrl"], cover)
        denied = await self.http.patch("/api/v1/users/me/coach-profile", json={"cover_image_url": cover})
        self.assertEqual(denied.status_code, 403)

    async def test_editing_public_goal_does_not_erase_coach_bio(self):
        response = await self.http.patch("/api/v1/social/profile", json={"goal": "New goal", "birth_year": "1995"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.session.get(CoachProfile, self.coach.id).bio, "About me")
