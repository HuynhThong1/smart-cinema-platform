# Phase 1 implementation status

Source: `design_handoff_transaction_feedback_qr/reference/PLAN.md`, sections 44–46. Status reflects the local implementation and evidence collected on 2026-09-06.

| Sprint | Delivered locally | Verification |
| --- | --- | --- |
| 0 | Nx Angular admin CSR/customer SSR, Go API, MongoDB replica set, Keycloak realm, Dockerfiles, Compose and CI | pnpm locked install, typecheck, production builds and container smoke tests pass |
| 1 | OIDC PKCE, JWT verification, roles, cinema scope and cinema CRUD | Signed-token and cross-cinema integration tests pass; real local logins pass |
| 2 | Staff CRUD/status and CSV/XLSX preview-confirm import | CSV/XLSX, duplicate and no-write-before-confirm tests pass |
| 3 | Opaque QR lifecycle, PNG/SVG/PDF and missing-only batch ZIP | Lifecycle/download tests pass; existing tokens are preserved |
| 4 | SSR feedback, dynamic rating/reasons, consent and generic error states | Initial HTML contains the form; browser submit creates exactly one record |
| 5–6 | Scoped feedback list/detail/export, suspicious filter, rating/reason configuration | API integration tests and local browser flows pass |
| 7–8 | Scoped KPIs, trends, distribution, comparisons and eligible rankings | Aggregation and minimum-feedback tests pass |
| 9 | Coaching create/update/follow-up with staff history | Integration test passes |
| 10 | Shared rate limits, repeat detection, audit, masking, headers and privacy controls | Race-enabled authorization/rate-limit/audit tests pass |
| 11 | Automated API tests, 320/390 px browser QA and UAT checklist | No horizontal overflow, staff identity leak, console or hydration errors found |
| 12 | One-cinema pilot and operational review | Pending real deployment, printed QR/device scans and cinema participants |

## Verified commands

```sh
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend typecheck
pnpm --dir frontend format:check
NX_DAEMON=false pnpm --dir frontend build
cd backend
go vet ./...
TEST_MONGODB_URI='mongodb://127.0.0.1:27018/?replicaSet=rs0&directConnection=true' go test -race ./... -count=1
```

The fresh Keycloak realm import was also checked with a disposable realm: the service client is enabled, manager cinema attributes survive import, and `cinema_id` is editable only by administrators. A System Admin browser flow created `qa.manager` scoped to Galaxy Bình Tân.

## Remaining acceptance work

Physical A6/A5/sticker printing and scans on real iOS/Android devices, Safari/Firefox coverage, production TLS/proxy/backup/retention review and the one-cinema pilot require the deployment owner and cinema participants. Dashboard staff rows are capped at 100, ranking returns top/bottom 20 plus up to 100 ineligible rows, and UI selector lists currently load the first 100 cinemas/staff. These bounds should be revisited if the pilot dataset exceeds them.

Local infrastructure contains synthetic data and development credentials only. It is evidence for engineering readiness, not production or pilot sign-off.
