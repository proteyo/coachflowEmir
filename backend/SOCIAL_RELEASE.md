Social messaging release — 4 November 2026

Migration `c62026110402` adds separate conversation settings, blocks, groups,
memberships, group messages, public profile fields, stories and story views.
Existing users, coaching records and direct messages are retained. A fresh
PostgreSQL backup was restored locally; upgrade, downgrade and repeat upgrade
preserved existing row counts and account hashes before the production upgrade.

Direct conversations retain their existing message IDs and WebSocket protocol.
Unlinking a client keeps their chat history and historical assessments. Pin/mute
settings belong to one participant; a background change applies to both. Deleting
for oneself changes only that participant's visibility. Group deletion for all
members requires ownership. Group events use authenticated WebSockets with HTTP
polling as a fallback; group history supports pagination.

Public profile responses contain only explicitly published bio, birth year and
goal, plus public user identity. They never return email, weight, height, health
notes, training assignments or supplements. Client ratings stay private unless
the client enables publication. Ratings identify their author. Coaching actions
remain in a separate coach workspace rather than the public profile.

Stories default to contacts, expire after 24 hours, and may be explicitly made
public or kept as a profile publication. Only the author can edit/delete a story
or list its viewers. Received private chat media cannot be republished as a story.
The protected media endpoint rechecks group membership, story visibility, expiry
and blocks. Blocks prevent sending messages; old conversation records are kept.

Frontend changes live in `expo/src/features/social`, shared by coach and client
inboxes. Native uploads use Expo File objects with expo/fetch and retain the
existing authentication refresh logic. Plain URI objects are no longer appended
to standards-based FormData. Legacy native gesture/recording-lock controls and
their instructional text are removed; recording starts with a tap and ends with
send or cancel.

Validation: 55 backend tests, including 11 new social authorization/persistence
tests; 26 frontend regressions, including multipart upload with token refresh;
TypeScript, lint for new social modules, iOS export and mocked browser checks for
inbox search, group picker, public privacy and group chat. Native recording,
camera/library permissions and real media playback still need device testing.
No trial or paid plan was granted to either test account.
