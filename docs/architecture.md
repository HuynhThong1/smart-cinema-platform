# Phase 1 architecture

The implementation follows the Phase 1 handoff. Angular 21 and PrimeNG render two applications in an Nx workspace; the Go/Gin API persists to MongoDB using the official driver and a repository interface. Keycloak owns credentials, login, password reset, session management, and role membership.

## Request paths

- Customer `/f/:qrToken`: Angular SSR resolves token validity and active configuration from the public API before rendering. The public validation response contains only validity and server time. No staff or cinema identities are returned to this page.
- Submission: validate consent version, Unicode name length, normalized Vietnamese phone, active rating and allowed/required reasons; resolve QR/staff/cinema; persist snapshots and server UTC time. A repeated phone/staff combination within ten minutes is flagged, not deduplicated.
- Admin: browser completes Authorization Code + S256 PKCE with Keycloak. Access tokens remain in memory. Go verifies issuer, audience, signature, expiration and roles. Manager cinema scope comes from the verified `cinema_id` claim.
- Queries: server-side filtering/pagination and MongoDB aggregation produce scoped dashboard and ranking data. Suspicious records are excluded unless explicitly included. Feedback list/export phones are masked; authorized detail views expose contact information for service follow-up.
- Mutations: staff, cinema, configuration, QR and coaching changes commit with their audit entry in one MongoDB transaction. Local MongoDB therefore runs as a single-node replica set.
- Users: a backend-only Keycloak service account manages users. MongoDB records intent before each external mutation and success/failure after it. This is not a distributed transaction; a failed identity request may require reconciliation before retry.
- Rate limiting: shared atomic MongoDB minute counters limit public GETs by IP and submissions by IP and QR. Counters expire using a TTL index. HMAC-SHA256 IP hashes use a deployment secret.

## Design and configuration

The handoff README takes precedence for final copy and visual details: Source Serif 4, Galaxy orange/blue, minimal borders and whitespace-separated sections. HTML prototype runtimes are not imported. Production login is a redirect to Keycloak rather than an application-owned password form.

Admin configuration is loaded from `/app-config.json` before Angular starts. API connection and identity settings use backend environment variables. Customer SSR uses `API_INTERNAL_URL`; browser public API requests use the same-origin proxy. Explicitly configure trusted proxy addresses; never trust arbitrary forwarding headers from the internet.

Future modules (recovery, incident and seat requests) remain outside Phase 1. No deployment to the suggested public domains is performed by local setup.

## Manager feedback notifications

See [notification behavior, configuration and UAT](manager-feedback-notifications.md). In-app inbox and Resend email outbox extend the original Phase 1 scope.
