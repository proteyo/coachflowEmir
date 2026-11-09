# CoachFlow: publication preparation, 10 November 2026

Public operator, explicitly supplied by the owner: Эмир Камилов, Kazakhstan.
Initial audience: adults aged 18 or older. Documents: Russian, Kazakh, English.

## Local implementation

- Public privacy, terms and account-deletion pages; in-app document reader.
- Explicit adult declaration, current terms acceptance, and client health-data consent. Existing users retain their accounts and are asked to accept in the interface. These are declarations, not identity or age verification.
- Password-authenticated account deletion, revoked sessions, personal-record removal, anonymous purchase-replay protection, and retryable owner-file cleanup. Other users' accounts and messages are preserved.
- Private abuse-report queue, operator moderation CLI, authenticated visibility checks, bounded submission rates. The text filter is a basic safeguard, not exhaustive moderation or image analysis.
- Expired coach training and CRM access closed; profile, renewal, safety actions and account rights remain available.

Migration `c62026110901` adds the reports table and four nullable consent-receipt columns. It does not backfill, delete or rewrite existing records. Deployment itself does not delete accounts. Account deletion requires an explicit reauthenticated request.

## Required before a public launch

1. Resolve Kazakhstan data-location requirements before collecting production personal data. Article 12 requires storage in a database/digital object in Kazakhstan. The previously supplied Render dashboard showed Oregon. Upgrading the instance alone does not establish compliance. Obtain jurisdiction-specific legal review and choose the database, media and backup arrangement accordingly. No infrastructure relocation is performed by this patch.
2. Confirm the document text against actual storage, backup retention and third-party configuration. Do not claim a backup rotation schedule until configured and tested.
3. Publish the backend only with the owner's approval, apply the additive migration, then distribute the matching client. The new client consent gate requires the new API; do not distribute it against the old API.
4. Supply reachable HTTPS privacy, terms, support and external account-deletion links in store listings; complete Apple privacy disclosures and Google Data Safety accurately, including health data, media, location and user content.
5. Configure a real operator process for reviewing reports, contacting support and acting on abusive content. Check the queue daily and review reports within 24 hours. CLI: `python -m app.moderation list`; inspect necessary evidence only in the trusted operator environment, then resolve a report with hide/dismiss/suspend. No admin credentials belong in the client.
6. Configure and test production email, durable object storage, backups and restoration. Local ephemeral Render files are not durable storage. Payments and store purchase rules require a separate implementation and review; this change does not enable live charging.
7. Build native iOS/Android binaries to apply purpose strings and blocked Android permissions. Expo Go uses its own native permission descriptions. Verify real-device photo selection, limited access, microphone denial, settings recovery and delivery of scheduled notifications.
8. Complete store age/content ratings, reviewer access and purchased model/media licence checks. Code and policy documents cannot guarantee store approval or absence of vulnerabilities.

## Primary references

- Kazakhstan personal data law, Article 12: https://old.adilet.zan.kz/rus/docs/Z1300000094
- Apple review guidelines, privacy/deletion and user-generated content: https://developer.apple.com/app-store/review/guidelines/
- Google Play user data: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Expo system photo picker and native permission configuration: https://docs.expo.dev/versions/latest/sdk/imagepicker/
