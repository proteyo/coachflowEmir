"""Offline map provider regressions. Never contacts Google or production."""
import unittest
from datetime import datetime, timedelta, timezone
from app.models.subscription import Subscription
from app.models.engagement import ClientEngagement
from app.models.profile import ClientProfile
from unittest.mock import patch, AsyncMock, Mock
import test_social as social
from app.services import place_details as details
from app.routers import places


class PlaceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await social.SocialTests.asyncSetUp(self)
        self.subscription = Subscription(coach_id=self.coach.id, status="active", plan_code="free", price=0, client_limit=3, end_date=datetime.now(timezone.utc)+timedelta(days=30))
        self.session.add(self.subscription)
        self.session.commit()
        details._cache.clear()
        details._limits.clear()

    async def asyncTearDown(self):
        await social.SocialTests.asyncTearDown(self)

    async def test_access_revocation_blocks_all_map_routes_before_provider_calls(self):
        routes=["/api/v1/places/access", "/api/v1/places", "/api/v1/places/nearby?lat=43&lng=76", "/api/v1/places/google_ChIJ123/details"]
        with patch.object(places,"_load_google_places",new=AsyncMock()) as nearby, patch.object(details,"google_place_details",new=AsyncMock()) as reviews:
            self.current=self.coach
            self.assertEqual((await self.http.get(routes[0])).status_code,200)
            self.subscription.status="expired";self.session.commit()
            for current in (self.coach,self.client,self.stranger):
                self.current=current
                for route in routes:
                    response=await self.http.get(route)
                    self.assertEqual(response.status_code,403,response.text)
            self.subscription.status="active";self.session.add(ClientEngagement(coach_id=self.coach.id,client_id=self.client.id,status="paused"));self.session.commit()
            self.current=self.client
            for route in routes:self.assertEqual((await self.http.get(route)).status_code,403)
            self.session.get(ClientEngagement,(self.coach.id,self.client.id)).status="active";self.session.commit()
            self.assertEqual((await self.http.get(routes[0])).status_code,200)
            self.session.get(ClientProfile,self.client.id).coach_id=None;self.session.commit()
            for route in routes:self.assertEqual((await self.http.get(route)).status_code,403)
            nearby.assert_not_awaited();reviews.assert_not_awaited()

    async def test_detail_endpoint_passes_only_valid_locale_and_requires_auth(self):
        with patch.object(details, "google_place_details", new=AsyncMock(return_value={"reviews": []})) as provider:
            response = await self.http.get("/api/v1/places/google_ChIJ123/details?language=ru")
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(provider.await_args.args[1:], ("ChIJ123", "ru"))
            self.assertEqual((await self.http.get("/api/v1/places/google_ChIJ123/details?language=evil")).status_code, 422)
        self.assertEqual((await self.http.get("/api/v1/places/missing/details")).status_code, 404)
        social.app.dependency_overrides.pop(social.get_current_user)
        self.assertEqual((await self.http.get("/api/v1/places/google_ChIJ123/details")).status_code, 401)

    async def test_google_cache_and_errors_do_not_leak_credentials(self):
        with patch.object(details, "_request_details", return_value={"reviews": []}) as provider:
            self.assertEqual(await details.google_place_details("private-key", "id", "kk"), {"reviews": []})
            await details.google_place_details("private-key", "id", "kk")
            self.assertEqual(provider.call_count, 1)
        with patch.object(details, "_request_details", side_effect=RuntimeError("private-key")):
            with self.assertRaises(Exception) as error:
                await details.google_place_details("private-key", "other", "en")
            self.assertEqual(error.exception.status_code, 503)
            self.assertNotIn("private-key", error.exception.detail)

    async def test_provider_data_is_bounded_and_urls_are_not_executable(self):
        normalized = details.normalize_details({"reviews": [{"author_name": "A", "author_url": "javascript:alert(1)", "text": "<script>literal text</script>", "rating": 4}] * 20, "editorial_summary": "unexpected", "opening_hours": {"weekday_text": None}, "rating": float("nan"), "user_ratings_total": "unexpected", "url": "https://google.com.evil.example/test"}, "id")
        self.assertEqual(len(normalized["reviews"]), 5)
        self.assertIsNone(normalized["reviews"][0]["authorUrl"])
        self.assertIsNone(normalized["rating"])
        self.assertEqual(normalized["reviewCount"], 0)
        self.assertTrue(normalized["sourceUrl"].startswith("https://www.google.com/"))
        self.assertEqual(normalized["openingHours"], [])

    async def test_nutrition_query_does_not_exclude_restaurants_without_keywords(self):
        response = Mock()
        response.read.return_value = b'{"status":"ZERO_RESULTS","results":[]}'
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        with patch.object(places.urllib.request, "urlopen", return_value=response) as request:
            places._google_nearby_request_sync(api_key="test", lat=43, lng=76, place_type="nutrition", radius=5000)
        url = request.call_args.args[0].full_url
        self.assertIn("type=restaurant", url)
        self.assertNotIn("keyword=", url)

    async def test_detail_rate_limit_is_bounded(self):
        for _ in range(40):
            details.check_budget("same-user")
        with self.assertRaises(Exception) as error:
            details.check_budget("same-user")
        self.assertEqual(error.exception.status_code, 429)
