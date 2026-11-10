import unittest
from datetime import datetime,timedelta,timezone
from unittest.mock import patch
import test_social as base
from app.models.user import User
from app.models.profile import ClientProfile
from app.models.message import Message
from app.models.social import Story,UserBlock


class StoryCircleTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp=base.SocialTests.asyncSetUp
    asyncTearDown=base.SocialTests.asyncTearDown

    async def test_circle_includes_coach_clients_and_peers_but_not_an_old_chat_partner(self):
        peer=self.stranger
        outside=User(id="outside",name="Outside",role="client",email="outside@example.invalid",password_hash="test",email_verified=True)
        self.session.add(outside);self.session.flush()
        self.session.add(ClientProfile(user_id=peer.id,coach_id=self.coach.id))
        self.session.add(Message(sender_id=outside.id,receiver_id=self.client.id,content="Old conversation"))
        for owner in (self.client,self.coach,peer,outside):
            self.session.add(Story(user_id=owner.id,media_url=f"/api/v1/uploads/images/{owner.id}_test.jpg",media_type="image",visibility="circle"))
        self.session.commit()
        feed=(await self.http.get("/api/v1/social/stories")).json()
        self.assertEqual({story["owner"]["id"] for story in feed},{self.client.id,self.coach.id,peer.id})
        self.current=self.coach
        self.assertEqual({story["owner"]["id"] for story in (await self.http.get("/api/v1/social/stories")).json()},{self.client.id,self.coach.id,peer.id})
        self.current=self.client
        self.session.add(UserBlock(user_id=peer.id,target_id=self.client.id));self.session.commit()
        self.assertNotIn(peer.id,{story["owner"]["id"] for story in (await self.http.get("/api/v1/social/stories")).json()})

    async def test_exact_24h_boundary_and_saved_posts_leaving_feed_without_deletion(self):
        fixed=datetime(2026,11,10,12,tzinfo=timezone.utc)
        fresh=Story(user_id=self.coach.id,media_url="fresh",media_type="image",created_at=fixed-timedelta(hours=23),expires_at=fixed+timedelta(hours=1))
        old_post=Story(user_id=self.coach.id,media_url="old-post",media_type="image",created_at=fixed-timedelta(days=2),expires_at=None)
        boundary=Story(user_id=self.coach.id,media_url="boundary",media_type="image",created_at=fixed-timedelta(hours=24),expires_at=None)
        expired=Story(user_id=self.coach.id,media_url="expired",media_type="image",created_at=fixed-timedelta(hours=5),expires_at=fixed)
        self.session.add_all([fresh,old_post,boundary,expired]);self.session.commit()
        with patch("app.routers.social.now",return_value=fixed):
            self.assertEqual([s["mediaUrl"] for s in (await self.http.get("/api/v1/social/stories")).json()],["fresh"])
            profile=(await self.http.get(f"/api/v1/social/stories?owner_id={self.coach.id}")).json()
            self.assertEqual({s["mediaUrl"] for s in profile},{"fresh","old-post","boundary"})
        self.assertIsNotNone(self.session.get(Story,old_post.id))

    async def test_unlinking_removes_peer_private_story_access_without_deleting_chats(self):
        self.session.add(ClientProfile(user_id=self.stranger.id,coach_id=self.coach.id))
        story=Story(user_id=self.stranger.id,media_url="peer",media_type="image",visibility="circle")
        self.session.add(story);self.session.commit()
        self.assertEqual((await self.http.patch(f"/api/v1/social/stories/{story.id}/view",json={})).status_code,200)
        self.session.get(ClientProfile,self.stranger.id).coach_id=None;self.session.commit()
        self.assertEqual((await self.http.patch(f"/api/v1/social/stories/{story.id}/view",json={})).status_code,404)

    async def test_story_reply_can_start_a_chat_between_current_peers_not_strangers(self):
        self.session.add(ClientProfile(user_id=self.stranger.id,coach_id=self.coach.id))
        story=Story(user_id=self.stranger.id,media_url="peer",media_type="image",visibility="circle",replies_enabled=True)
        self.session.add(story);self.session.commit()
        response=await self.http.post(f"/api/v1/social/stories/{story.id}/reply",json={"text":"Nice work","request_id":"peer_reply_123"})
        self.assertEqual(response.status_code,201,response.text)
        other=User(id="different-circle",name="Different",role="client",email="different@example.invalid",password_hash="test",email_verified=True)
        self.session.add(other);story.visibility="public";self.session.commit();self.current=other
        response=await self.http.post(f"/api/v1/social/stories/{story.id}/reply",json={"text":"Unrelated","request_id":"different_123"})
        self.assertEqual(response.status_code,403,response.text)

    async def test_legacy_private_story_does_not_gain_a_new_peer_audience(self):
        self.session.add(ClientProfile(user_id=self.stranger.id,coach_id=self.coach.id))
        legacy=Story(user_id=self.stranger.id,media_url="legacy",media_type="image",visibility="contacts")
        current=Story(user_id=self.stranger.id,media_url="current",media_type="image",visibility="circle")
        self.session.add_all([legacy,current]);self.session.commit()
        feed=(await self.http.get("/api/v1/social/stories")).json()
        self.assertEqual([story["mediaUrl"] for story in feed],["current"])
        self.assertEqual((await self.http.patch(f"/api/v1/social/stories/{legacy.id}/view",json={})).status_code,404)
        self.current=self.stranger
        self.assertEqual((await self.http.patch(f"/api/v1/social/stories/{legacy.id}",json={"caption":"Edited caption"})).status_code,200)
        self.assertEqual(self.session.get(Story,legacy.id).visibility,"contacts")
