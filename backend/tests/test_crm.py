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

    async def test_first_income_count_is_account_wide_and_ignores_contract_prices(self):
        empty=await self.http.get("/api/v1/crm?month=2026-11")
        self.assertEqual(empty.json()["recordedPaymentCount"],0)
        self.session.add(ClientEngagement(coach_id=self.coach.id,client_id=self.client.id,monthly_fee=Decimal("50000")))
        self.session.add(ClientPayment(coach_id=self.coach.id,client_id=self.client.id,amount=Decimal("10000"),paid_on=datetime(2025,1,2).date(),request_id="old-real-payment"))
        self.session.add(ClientPayment(coach_id="other_coach",client_id=self.client.id,amount=Decimal("90000"),paid_on=datetime(2026,11,2).date(),request_id="not-my-payment"))
        self.session.commit()
        current=await self.http.get("/api/v1/crm?month=2026-11")
        self.assertEqual(current.status_code,200,current.text)
        self.assertEqual(current.json()["recordedPaymentCount"],1)
        self.assertEqual(current.json()["paymentCount"],0)
        self.assertEqual(Decimal(current.json()["received"]),0)

    async def test_code_link_cannot_claim_another_coachs_client_and_is_idempotent(self):
        self.client.client_code = "CLAIM123"
        self.session.commit()
        same = await self.http.post("/api/v1/clients/link", json={"client_code": "CLAIM123"})
        self.assertEqual(same.status_code, 200, same.text)
        self.stranger.role = "coach"
        self.session.add(Subscription(coach_id=self.stranger.id, status="active", plan_code="free", price=0, client_limit=3, end_date=datetime.now(timezone.utc) + timedelta(days=30)))
        self.session.commit()
        self.current = self.stranger
        stolen = await self.http.post("/api/v1/clients/link", json={"client_code": "CLAIM123"})
        self.assertEqual(stolen.status_code, 400, stolen.text)
        self.session.expire_all()
        profile = self.session.scalar(select(ClientProfile).where(ClientProfile.user_id == self.client.id))
        self.assertEqual(profile.coach_id, self.coach.id)

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

    async def test_workout_save_edit_preserves_exercise_identity_and_rejects_invalid_input(self):
        payload = {"client_id": self.client.id, "date": "2026-11-05", "name": "Leg day", "exercises": [{"name": "Squat", "sets": 3, "reps": 10, "rest_seconds": 60}]}
        response = await self.http.post("/api/v1/workouts", json=payload)
        self.assertEqual(response.status_code, 201, response.text)
        workout = response.json(); exercise_id = workout["exercises"][0]["id"]
        edited = await self.http.patch(f"/api/v1/workouts/{workout['id']}", json={"name": "Updated", "exercises": [{**payload["exercises"][0], "id": exercise_id, "sets": 4}]})
        self.assertEqual(edited.status_code, 200, edited.text)
        self.assertEqual(edited.json()["exercises"][0]["id"], exercise_id)
        self.assertEqual(edited.json()["exercises"][0]["sets"], 4)
        self.assertEqual(len(edited.json()["exercises"]), 1)
        for patch in ({"name": " "}, {"name": "a" * 121}, {"date": "2026-02-30"}, {"exercises": [{**payload["exercises"][0], "sets": -1}]}, {"exercises": [{**payload["exercises"][0], "weight": "NaN"}]}):
            invalid = await self.http.post("/api/v1/workouts", json={**payload, **patch})
            self.assertEqual(invalid.status_code, 422, invalid.text)
        forbidden = await self.http.patch(f"/api/v1/workouts/{workout['id']}", json={"exercises": [{**payload["exercises"][0], "id": "foreign-exercise"}]})
        self.assertEqual(forbidden.status_code, 403)
        self.session.rollback()
        self.current = self.stranger
        self.assertEqual((await self.http.get(f"/api/v1/workouts/{workout['id']}")).status_code, 403)

    async def test_supplement_schedule_rejects_missing_fields_invalid_times_and_dosage(self):
        item = {"name": "Vitamin", "dosage": "1 mg", "times_per_day": 1, "specific_times": ["09:00"], "days_of_week": ["Mon"]}
        payload = {"client_id": self.client.id, "start_date": "2026-11-05", "items": [item]}
        for patch in ({"name": " "}, {"dosage": ""}, {"times_per_day": 2}, {"specific_times": ["30:00"]}, {"days_of_week": ["Fake"]}, {"notes": "x" * 2001}):
            response = await self.http.post("/api/v1/supplements/plans", json={**payload, "items": [{**item, **patch}]})
            self.assertEqual(response.status_code, 422, response.text)

    async def test_expenses_are_private_idempotent_and_in_month_balance(self):
        today = datetime.now(timezone.utc).date().isoformat()
        payload = {"amount": "125.50", "paid_on": today, "note": "Equipment", "request_id": "expense_test_123"}
        first = await self.http.post("/api/v1/crm/expenses", json=payload)
        self.assertEqual(first.status_code, 201, first.text)
        again = await self.http.post("/api/v1/crm/expenses", json=payload)
        self.assertEqual(first.json()["id"], again.json()["id"])
        data = (await self.http.get("/api/v1/crm")).json()
        self.assertEqual(float(data["expensesTotal"]), 125.50)
        self.assertEqual(sum(float(d["expense"]) for d in data["daily"]), 125.50)
        self.assertEqual(float(data["afterTariffEstimate"]), -125.50)
        invalid = await self.http.post("/api/v1/crm/expenses", json={**payload, "coach_id": self.stranger.id})
        self.assertEqual(invalid.status_code, 422)
        self.stranger.role = "coach"; self.session.commit(); self.current = self.stranger
        self.assertEqual((await self.http.delete("/api/v1/crm/expenses/" + first.json()["id"])).status_code, 404)
        self.current = self.client
        self.assertEqual((await self.http.post("/api/v1/crm/expenses", json=payload)).status_code, 403)
        self.current = self.coach
        self.assertEqual((await self.http.delete("/api/v1/crm/expenses/" + first.json()["id"])).status_code, 204)

    async def test_coach_rating_button_requires_real_client_relationship(self):
        self.current = self.client
        profile = (await self.http.get(f"/api/v1/social/profile/{self.coach.id}")).json()
        self.assertTrue(profile["canReviewCoach"])
        result = await self.http.post(f"/api/v1/reviews/coaches/{self.coach.id}", json={"rating": 4, "comment": "Helpful"})
        self.assertEqual(result.status_code, 200, result.text)
        self.current = self.stranger
        profile = (await self.http.get(f"/api/v1/social/profile/{self.coach.id}")).json()
        self.assertFalse(profile["canReviewCoach"])
        result = await self.http.post(f"/api/v1/reviews/coaches/{self.coach.id}", json={"rating": 5})
        self.assertEqual(result.status_code, 403)

    async def test_story_reply_honors_visibility_blocks_and_owner_preference(self):
        from app.models.social import Story, UserBlock
        story = Story(user_id=self.coach.id, media_url="/api/v1/uploads/images/u_coach_own.jpg", media_type="image", caption="Hello", visibility="contacts", replies_enabled=False)
        self.session.add(story); self.session.commit()
        self.current = self.coach
        edit = await self.http.patch(f"/api/v1/social/stories/{story.id}", json={"caption": "Updated", "visibility": "contacts"})
        self.assertEqual(edit.status_code, 200)
        self.assertFalse(self.session.get(Story, story.id).replies_enabled)
        self.current = self.client
        payload = {"text": "Nice session", "request_id": "story_reply_123"}
        endpoint = f"/api/v1/social/stories/{story.id}/reply"
        self.assertEqual((await self.http.post(endpoint, json=payload)).status_code, 403)
        story.replies_enabled = True; self.session.commit()
        result = await self.http.post(endpoint, json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        duplicate = await self.http.post(endpoint, json=payload)
        self.assertEqual(result.json()["id"], duplicate.json()["id"])
        self.current = self.stranger
        self.assertEqual((await self.http.post(endpoint, json=payload)).status_code, 404)
        self.current = self.client
        self.session.add(UserBlock(user_id=self.coach.id, target_id=self.client.id)); self.session.commit()
        self.assertEqual((await self.http.post(endpoint, json=payload)).status_code, 404)

    async def test_attendance_summary_uses_marks_and_counts_lifetime_without_leaking_other_clients(self):
        self.session.add_all([Attendance(coach_id=self.coach.id, client_id=self.client.id, date="2026-11-01", status="attended"), Attendance(coach_id=self.coach.id, client_id=self.client.id, date="2026-11-02", status="rest"), Attendance(coach_id=self.coach.id, client_id=self.client.id, date="2026-11-03", status="attended"), Attendance(coach_id=self.coach.id, client_id=self.client.id, date="2026-11-04", status="missed")]); self.session.commit()
        summary = (await self.http.get("/api/v1/attendance/summary")).json()
        item = next(r for r in summary if r["clientId"] == self.client.id)
        self.assertEqual(item["currentStreak"], 0); self.assertEqual(item["attended"], 2)
        self.assertNotIn(self.stranger.id, str(summary))
        self.current = self.client
        self.assertEqual((await self.http.get("/api/v1/streak")).json()["currentStreak"], 0)
        self.assertEqual((await self.http.post("/api/v1/streak/activity")).json()["currentStreak"], 0)
        self.current = self.stranger
        summary = (await self.http.get("/api/v1/attendance/summary")).json()
        self.assertEqual([r["clientId"] for r in summary], [self.stranger.id])

    async def test_membership_can_record_a_payment_atomically_once_and_analytics_periods_match(self):
        today = datetime.now(timezone.utc).date().isoformat()
        body = {"monthly_fee": "30000", "starts_on": today, "ends_on": "2099-01-01", "payment": {"amount": "90000", "paid_on": today, "note": "Three months", "request_id": "membership_payment_123"}}
        for _ in range(2):
            response = await self.http.patch(f"/api/v1/crm/clients/{self.client.id}", json=body)
            self.assertEqual(response.status_code, 200, response.text)
        for period, count in (("month", None), ("quarter", 3), ("year", 12)):
            response = await self.http.get(f"/api/v1/crm?period={period}")
            self.assertEqual(response.status_code, 200, response.text)
            result = response.json(); self.assertEqual(float(result["received"]), 90000)
            self.assertEqual(result["clientsPaid"], 1); self.assertEqual(result["paymentCount"], 1)
            if count: self.assertEqual(len(result["daily"]), count)
            paid = next(d for d in result["daily"] if float(d["income"]) > 0)
            self.assertIn("date", paid); self.assertEqual(paid["clientsPaid"], 1)
        response = await self.http.patch(f"/api/v1/crm/clients/{self.client.id}", json={**body, "payment": {**body["payment"], "amount": "91000"}})
        self.assertEqual(response.status_code, 409)
        self.assertEqual((await self.http.get("/api/v1/crm")).json()["paymentCount"], 1)

    async def test_workout_completion_is_confirmed_once_updates_goal_and_cannot_bypass_archive(self):
        from app.models.weekly_goal import WeeklyGoal
        now = datetime.now(timezone.utc) + timedelta(minutes=300)
        week = (now.date() - timedelta(days=now.weekday())).isoformat()
        goal = WeeklyGoal(client_id=self.client.id, week_start=week, target_minutes=100, target_workouts=3, completed_minutes=0, completed_workouts=0)
        workout = WorkoutAssignment(coach_id=self.coach.id, client_id=self.client.id, date=now.date().isoformat(), name="Session", completed=False, duration_minutes=45)
        self.session.add_all([goal, workout]); self.session.commit()
        self.current = self.coach
        self.assertEqual((await self.http.post(f"/api/v1/workouts/{workout.id}/complete", json={"duration_minutes": 30})).status_code, 403)
        self.current = self.client
        for _ in range(2):
            response = await self.http.post(f"/api/v1/workouts/{workout.id}/complete", json={"duration_minutes": 30, "utc_offset_minutes": 300})
            self.assertEqual(response.status_code, 200, response.text)
        self.session.refresh(goal)
        self.assertEqual(goal.completed_minutes, 30); self.assertEqual(goal.completed_workouts, 1)
        self.assertEqual((await self.http.get("/api/v1/streak")).json()["currentStreak"], 0)
        pending = WorkoutAssignment(coach_id=self.coach.id, client_id=self.client.id, date=now.date().isoformat(), name="Pending", completed=False)
        self.session.add(pending); self.session.commit()
        self.current = self.coach
        await self.http.delete(f"/api/v1/clients/{self.client.id}")
        self.current = self.client
        self.assertEqual((await self.http.post(f"/api/v1/workouts/{pending.id}/complete")).status_code, 403)
        self.assertFalse(self.session.get(WorkoutAssignment, pending.id).completed)

    async def test_receipts_use_the_submitted_bounded_local_timezone(self):
        from app.routers.crm import PaymentIn
        from unittest.mock import patch
        from datetime import date
        with patch("app.routers.crm.datetime") as clock:
            clock.now.return_value = datetime(2026, 11, 5, 22, 0, tzinfo=timezone.utc)
            data = PaymentIn(amount="10", paid_on=date(2026, 11, 6), utc_offset_minutes=300, request_id="timezone_test")
            self.assertEqual(data.paid_on.day, 6)
            with self.assertRaises(ValueError):
                PaymentIn(amount="10", paid_on=date(2026, 11, 6), utc_offset_minutes=0, request_id="timezone_test")

    async def test_attendance_rejects_malformed_days_oversized_notes_and_owner_injection(self):
        body = {"client_id": self.client.id, "date": "2026-11-06", "status": "attended"}
        for change in ({"date": "2026-02-30"}, {"date": "not-a-date"}, {"notes": "x" * 2001}, {"coach_id": self.stranger.id}):
            response = await self.http.post("/api/v1/attendance", json={**body, **change})
            self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual(len(self.session.scalars(select(Attendance)).all()), 0)
