# API v1

Machine-readable contract: [OpenAPI 3.1](openapi.json). Local base URL: `http://localhost:8080/api/v1`.

All admin requests require `Authorization: Bearer <access_token>` issued by the configured Keycloak realm for audience `smart-cinema-api`. The API, not a client-provided role, decides cinema scope. A manager cannot read/write another cinema, including detail URLs.

## Public flow

1. `GET /public/feedback/{qrToken}` returns `{ "valid": true, "serverTime": "...Z" }`. Unknown, revoked, disabled, inactive-staff and inactive-cinema cases all return the same generic 404.
2. `GET /public/feedback-config` returns rating type/options, active reasons, consent version and ranking threshold.
3. `POST /public/feedback` accepts:

```json
{
  "qrToken": "<32-character opaque token from QR URL>",
  "rating": 5,
  "reasons": ["FRIENDLY"],
  "name": "Khách thử nghiệm",
  "phone": "0912345678",
  "comment": "Phục vụ nhanh",
  "consent": true,
  "consentVersion": "v1"
}
```

Success is `201 { "createdAt": "...Z" }`. Each successful submission creates a new record. The API normalizes phones to `84...`; repeated phone/staff within ten minutes is suspicious. It never returns staff identity to the public form.

## Query conventions

Paginated lists return `{items, total, page, pageSize}`. Pages are one-based, page size defaults to 20 and is capped at 100. Staff/cinema/customer searches use escaped literal matching, not user-controlled regex.

Feedback, dashboard and ranking filters: `cinemaId`, `staffId`, `from`, `to`, `rating`, `reason`, `search`, `includeSuspicious`, `suspicious`. `from` is inclusive and `to` exclusive, both RFC3339 instants. For a whole Vietnam day use `2026-09-06T00:00:00+07:00` through `2026-09-07T00:00:00+07:00` (URL-encode the `+`). Rating supports `1`–`5`, `negative` (1–2), `neutral` (3), `positive` (4–5). Suspicious records are excluded by default.

Dashboard returns `summary`, `distribution`, `trend`, `hours`, `reasons`, `staff`, `cinemas`, `eligible`, and `minimumFeedbackForRanking`. Grouped metrics contain `count`, `average`, `positive`, `neutral`, `negative`; staff/cinema rows include snapshot `unit`. Ranking returns top/bottom 20 eligible units and up to 100 ineligible units. The dashboard staff summary is capped at 100; the staff management list remains paginated.

## Import and download

`POST /admin/staff/import` is multipart: `file` plus `confirm=false` for preview, then the same file with `confirm=true`. Columns must be `Staff Code`, `Full Name`, `Cinema Code`. Limits: 5 MB, 1,000 data rows. Confirmation revalidates; concurrent duplicate codes fail the transaction instead of partially committing. The response includes per-row errors and `total`, `valid`, `invalid`, `imported`, `confirmed`.

QR download: `/admin/staff/{id}/qr/download?format=png|svg|pdf`. ZIP: `/admin/staff/qr/package?cinemaId=...`. Feedback export: `/admin/feedbacks/export` with the same filters, masked phones and formula-safe CSV cells; narrow filters if more than 10,000 records match.

## Errors and permissions

Errors use `{error, requestId}` with `X-Request-ID`. Statuses: 400 malformed query/body, 401 invalid session, 403 denied scope/role, 404 missing/unavailable, 409 duplicate code, 413 oversize, 422 invalid input, 429 rate limit, 500 internal failure, 502/503 unavailable dependency. Rate-limited requests include `Retry-After: 60`.

Configuration/cinema management requires a global role. User management requires System Admin and a configured backend Keycloak service client. A user change records request intent and success/failure because MongoDB and Keycloak cannot commit atomically; inspect the account after a failed request before retrying.

## User administration

System Admins manage login accounts with `GET/POST /admin/users` and `PUT/DELETE /admin/users/{id}`. Creation requires a temporary password of at least 12 characters; Keycloak prompts the user to replace it at first login. Updates can change name, roles, cinema scope and enabled status. Use `enabled: false` to suspend access temporarily. Deletion is permanent, requires confirmation in the admin UI and cannot target the currently signed-in account.

## Manager feedback notifications

See [notification behavior, configuration and UAT](manager-feedback-notifications.md). In-app inbox and Resend email outbox extend the original Phase 1 scope.
