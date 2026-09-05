# Smart Cinema Platform

Phase 1: Transaction Feedback QR. Angular 21 customer SSR and admin CSR applications, a Go/Gin API, MongoDB and Keycloak. Product requirements live in [the design handoff](design_handoff_transaction_feedback_qr/README.md); implementation details are in [architecture](docs/architecture.md).

## Local development

Prerequisites: Node.js 24, **pnpm 11.10.0**, Go 1.26, Docker with Compose, Python 3 (optional identity setup utility).

```sh
# From the repository root
pnpm --dir frontend install --frozen-lockfile
docker compose up -d
cp backend/.env.example backend/.env
# Replace IP_HASH_SECRET in backend/.env with a random value.
./scripts/dev-api.sh
```

In separate terminals:

```sh
pnpm --dir frontend dev:admin
pnpm --dir frontend dev:customer
```

- Admin: http://localhost:4200
- Customer: use a public URL copied from **Quản lý QR** in Admin.
- API health: http://localhost:8080/readyz
- Keycloak: http://localhost:8081

Use `localhost` consistently during OIDC login. Customer URLs are generated from `PUBLIC_URL`. Admin identity configuration lives in `frontend/apps/smart-admin/public/app-config.json`; deploy a corresponding runtime file for each environment.

`SEED_DEVELOPMENT=true` seeds two cinemas, eight synthetic staff, random QR tokens and synthetic feedback into an empty database. It does not overwrite existing records. Set this to `false` outside local development.

### Local accounts

All sample application accounts use password `CinemaLocal2026!`: `manager` (Nguyễn Du), `manager2` (Bình Tân), `headoffice`, and `sysadmin`. These credentials are exclusively for the isolated local realm. The Keycloak console account is `local-admin`; its development password defaults to `local-development-only` and can be overridden with `KEYCLOAK_ADMIN_PASSWORD` before first startup.

For a previously imported local realm, run `python3 scripts/configure-local-identity.py` to configure the service client and admin-only `cinema_id` profile attribute. Fresh imports already contain both. Users cannot edit their own cinema scope. Set `KEYCLOAK_SERVICE_SECRET` for the Go API to enable user administration. The checked-in development secret must be replaced for any deployment.

## Verification

```sh
pnpm --dir frontend typecheck
pnpm --dir frontend build
cd backend
go test ./...
TEST_MONGODB_URI='mongodb://127.0.0.1:27018/?replicaSet=rs0&directConnection=true' go test ./... -count=1
```

Integration tests create and delete only their own `smart_cinema_test_*` databases. Without `TEST_MONGODB_URI`, they skip; domain tests still run. See [UAT checklist](docs/uat.md) for browser, print/scan and operational acceptance.

To serve the built customer app:

```sh
cd frontend
API_INTERNAL_URL=http://127.0.0.1:8080 SSR_ALLOWED_HOSTS=localhost,127.0.0.1 PORT=4201 node dist/apps/smart-customer/server/server.mjs
```

## Project layout

- `frontend/apps/smart-admin`, `frontend/apps/smart-customer`: application entrypoints and routing.
- `frontend/libs/core`: API contracts, authentication and shared client utilities.
- `frontend/libs/feature`: admin feature screens.
- `frontend/libs/ui`: shared rating control and design tokens/styles.
- `backend/internal/domain`, `auth`, `repository`, `server`: validation/models, identity, persistence and API handlers.
- `infra/keycloak`, `compose.yaml`: isolated local dependencies.
- `docs`: architecture, API contract, implementation status and UAT.

## Deployment notes

Local Compose uses MongoDB 7 because MongoDB 8 rejects the current Podman host kernel; use a supported database/kernel combination in deployment. MongoDB requires a replica set for transactions. Local Keycloak uses its development database; production needs PostgreSQL, TLS, backups and a hardened realm configuration.

Set `SSR_ALLOWED_HOSTS` to the deployed customer hostname. Apply HTTPS at the reverse proxy, set explicit CORS origins and trusted proxy IPs, replace all local credentials, configure Keycloak redirect URIs/audience, and disable development seeding. Feedback pages must remain `noindex,nofollow`. Pilot rollout requires a cinema's operational sign-off; local tests do not constitute a completed pilot.
