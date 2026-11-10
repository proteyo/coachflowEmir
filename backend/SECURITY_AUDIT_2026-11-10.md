# Security review — 10 November 2026

Reviewed the current CoachFlow backend and Expo sources locally. No source code,
database rows, media, credentials or private messages were submitted to a scanner.
Package audits send package names/versions to public vulnerability registries.
Cloudflare account access was unavailable; this is not a Cloudflare scan or a
certification that the application is free of vulnerabilities.

## Confirmed issues addressed

| Area | Previous exposure | Change |
| --- | --- | --- |
| Request parsing | JSON bodies had no application-level byte cap; anonymous multipart requests could spool before authentication | 1 MiB ordinary body cap, counted on actual streamed bytes; per-upload cap with multipart overhead; signature check before upload parsing, with full session/permission checks still performed by existing dependencies |
| Client discovery | A subscribed coach could repeatedly probe client codes/email invitations without a discovery-specific budget | Shared atomic limit across both actions: 10/minute and 50/day per coach, applied before client lookup |
| Open chat connections | Subscription and relationship/block permission were checked at connection time but not again before direct-chat events | Recheck before every incoming event; reject frames over 16,384 characters and non-object JSON; disconnect expired coach connections before sending broadcasts |
| Profile images | User/coach profile writes accepted arbitrary image URLs, including third-party tracking links | New writes accept only the user's own server-generated avatar/cover reference; bounded field lengths and forbidden unexpected user-update fields |
| Private response caching | Authenticated JSON responses did not consistently prohibit caching | Default `Cache-Control: no-store` for API responses, `nosniff` and `no-referrer`; existing explicit public-avatar caching retained |
| Credentials in logs | Uvicorn request URLs could contain media/WebSocket query tokens; Google Play HttpError includes purchase tokens in URL paths | Redact query data in Uvicorn access/error records; do not log Google purchase error tracebacks; expected HTTP denials roll back without logging credential-bearing exception chains |
| Development dependencies | `@typescript-eslint/typescript-estree` used affected minimatch; ngrok used affected uuid | Scoped overrides to minimatch 11.0.4 and uuid 11.1.1; Expo major versions unchanged |

Malformed JSON receives a client error. No existing account, table, media file,
training record or password was deleted or rewritten. No schema migration.
Existing profile images are not bulk-rewritten; the stricter image rule applies
when a user edits the corresponding image field.

## Verification

- 125 backend tests passed, including 12 new adversarial regression tests.
- 105 frontend tests passed; TypeScript passed.
- ESLint passed for api.ts, layout.ts and useLayout.ts; ngrok module import passed.
- `pip check`: no dependency conflicts.
- `pip-audit`: 66 resolved backend packages, zero known advisories at check time.
- `npm audit`, including development packages: zero known advisories after fixes.
- Bandit inspected 11,709 Python lines: no high-severity findings. Its two medium
  flags concern urllib calls whose HTTPS Google endpoints are hardcoded and whose
  query values are encoded; callers cannot supply an arbitrary destination. The
  low flags cover JWT type labels, translated code labels and deliberate exception
  handling. These were reviewed rather than blindly suppressed.
- Redacted pattern scan covered Git-visible text files and historical text blobs
  up to 2 MB. The sole current/historical match is a non-ASCII uppercase placeholder
  in backend/README.md's localhost database example. No matched secret was printed.
  Ignored local environment files/backups and binaries are outside this scan.

Raw local audit artifacts: workspace `artifacts/security-*2026-11-10*`.
The local secret scanner is `deployment-tools/security_secret_scan.py`.

## Publication and practical limits

Server fixes are prepared separately and require the user's approval before
updating Render. Tests use isolated local databases, mock mail/providers, and
synthetic attack strings; no attack traffic was sent to the production server.
No cloud IAM/WAF/bucket settings or actual store billing were remotely audited.
Cloudflare Security Insights would inspect the linked Cloudflare account's
DNS/TLS/WAF/Access configuration; it does not replace application authorization
tests. Proxy/platform request logs must also avoid retaining query credentials.

Previously shared API/SMTP/signing secrets must be revoked or rotated in their
providers before public release; checking code does not revoke them. Native build
permissions, private cloud buckets, durable backups, hosting/data residency and
store disclosure requirements still need the previously documented release checks.
