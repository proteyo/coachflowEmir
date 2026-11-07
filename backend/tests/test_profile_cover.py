import unittest
import test_social as social


class ProfileCoverTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await social.SocialTests.asyncSetUp(self)

    async def asyncTearDown(self):
        await social.SocialTests.asyncTearDown(self)

    async def test_owned_cover_is_public_and_survives_unrelated_edits(self):
        url = "/api/v1/uploads/avatars/u_client_0123456789abcdef.jpg"
        response = await self.http.patch("/api/v1/social/profile", json={"cover_image_url": url, "cover_opacity": 0.5})
        self.assertEqual(response.status_code, 200, response.text)
        await self.http.patch("/api/v1/social/profile", json={"bio": "Updated"})
        self.current = self.coach
        profile = (await self.http.get("/api/v1/social/profile/u_client")).json()
        self.assertEqual(profile["coverImageUrl"], url)
        self.assertEqual(profile["coverOpacity"], 0.5)

    async def test_cover_rejects_other_owners_external_urls_and_invalid_opacity(self):
        for url in ["/api/v1/uploads/avatars/u_coach_0123456789abcdef.jpg", "https://evil.example/pixel.jpg", "javascript:alert(1)", "/api/v1/uploads/avatars/../secret"]:
            self.assertEqual((await self.http.patch("/api/v1/social/profile", json={"cover_image_url": url})).status_code, 400)
        for value in [-1, 2, None]:
            response = await self.http.patch("/api/v1/social/profile", json={"cover_opacity": value})
            self.assertIn(response.status_code, [400, 422])

    async def test_payment_feed_has_no_coach_notes_or_other_clients(self):
        from app.models.engagement import ClientPayment
        from datetime import date
        from decimal import Decimal
        self.session.add_all([
            ClientPayment(coach_id=self.coach.id, client_id=self.client.id, amount=Decimal("100"), paid_on=date.today(), note="Private coach note", request_id="one"),
            ClientPayment(coach_id=self.coach.id, client_id=self.stranger.id, amount=Decimal("999"), paid_on=date.today(), note="Other client's note", request_id="two"),
        ])
        self.session.commit()
        result = (await self.http.get("/api/v1/crm/payments/me")).json()
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["amount"], "100.00")
        self.assertNotIn("note", result[0])
        self.current = self.coach
        self.assertEqual((await self.http.get("/api/v1/crm/payments/me")).status_code, 403)
