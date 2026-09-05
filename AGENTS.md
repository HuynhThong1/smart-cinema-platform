# Repository Guidelines

## Project Structure & Module Organization

- `frontend/apps/smart-admin/`: Angular 21 admin CSR entrypoints and routes.
- `frontend/apps/smart-customer/`: customer SSR routes and Node server.
- `frontend/libs/core/`, `feature/`, `ui/`: shared API/auth contracts, admin features, reusable controls and styles.
- `backend/cmd/api/`: Go/Gin API entrypoint. `backend/internal/` contains domain validation, authentication, repositories and handlers; tests live beside their implementation.
- `infra/keycloak/` and `compose.yaml`: isolated local infrastructure.
- `docs/`: architecture, OpenAPI contract, implementation status and UAT.
- `design_handoff_transaction_feedback_qr/`: original requirements and design references. Read its README and `reference/PLAN.md` before changing product behavior; never port prototype runtimes into production.

## Build, Test, and Development Commands

Use **pnpm**, not npm or Yarn. Run from the repository root unless stated otherwise:

- `pnpm --dir frontend install --frozen-lockfile`: install locked dependencies.
- `docker compose up -d`: start local MongoDB replica set and Keycloak.
- `./scripts/dev-api.sh`: run Go API using `backend/.env`.
- `pnpm --dir frontend dev:admin` / `dev:customer`: serve the Angular apps.
- `pnpm --dir frontend build`: build both applications.
- `pnpm --dir frontend typecheck` / `format:check`: verify TypeScript and formatting.
- From `backend/`, `go test ./...` and `go vet ./...`: run tests and static checks. Set `TEST_MONGODB_URI` to include integration tests; otherwise they skip.

## Coding Style & Naming Conventions

Use two-space indentation and Prettier for TypeScript, HTML and CSS; run `pnpm --dir frontend format`. Use `gofmt` for Go and `*_test.go` filenames for tests. Prefer descriptive kebab-case frontend filenames, standalone Angular components, Signals and shared typed API models. Preserve Galaxy colors, Source Serif 4, and Vietnamese-primary/English-secondary copy.

## Testing Guidelines

Cover authorization, cinema scope, validation, snapshots, QR lifecycle and persistence changes with focused Go tests. Integration tests must use disposable `smart_cinema_test_*` databases. For UI changes, verify customer widths 320/390px, admin 1366px, error/empty states and keyboard interaction. Record browser checks and screenshots; physical QR scans require UAT.

## Commit & Pull Request Guidelines

Follow Commitizen: `type(scope): concise description`, such as `feat(qr): add batch download`. Keep commits focused. PRs should explain behavior, link relevant issues, list verification and include screenshots for UI changes.

## Security & Configuration

Use synthetic data and local-only credentials. Never expose staff identity publicly. Enforce role/cinema scope in Go, keep access tokens in memory, mask list/export phones and audit privileged changes. Update OpenAPI and environment examples when contracts change. Never commit real secrets or `.env` files.
