# Postgres Migration Handoff

## Current Phase

The application runtime now uses Postgres as the only persistence implementation. Legacy SQLite repositories, schema modules, and `better-sqlite3` remain only for one-time importer paths and focused legacy tests. A temporary one-time SQLite-to-Postgres importer command has been added, but the requested Supabase import has not run because `DATABASE_URL` and the destination owner UUID were not available in this shell.

## Completed Work

- Read the prior handoff, startup wiring, authentication middleware, request context, service constructors, route handlers, SQLite-era repository imports, Postgres adapters, and focused tests before changing runtime wiring.
- Added `server/composition-root.ts` as the server composition root for owner-scoped Postgres repository and service construction.
- Removed `getDatabase()` and SQLite schema initialization from `server/app.ts` startup.
- Routed owner resolution through the validated auth request context and `getOwnerUuidFromRequestContext(request.authContext.userId)`; hosted requests no longer use a fixed canonical local owner id.
- Refactored AI workspace, AI artifacts, Docs, Calendar, Workout, Nutrition, Skills, Automations, AI memory refresh, and image vision-mode lookup handlers to receive repositories/services from the app wiring instead of constructing persistence dependencies in feature modules.
- Removed runtime imports of SQLite repository singletons from `skills-service.ts`, `automations-service.ts`, and `nutrition-ai-food-log.ts`.
- Kept background-style operations owner-explicit by passing owner-scoped services into AI memory refresh and automation claim/report routes.
- Added centralized persistence error translation in `server/http.ts` and wired async Express route wrappers through `server/app.ts`.
- Mapped persistence failures to stable HTTP behavior without exposing SQL or connection details: unique conflict `409`, invalid relation/domain input `400`, database unavailable `503`, unexpected persistence failure `500`.
- Added API integration coverage through the real Express API for authentication plus owner isolation, AI workspace, Docs, Calendar, Workout, Nutrition, Skills, Automations, invalid relation handling, unexpected persistence failure handling, and database outage handling.
- Added an architecture check preventing runtime feature modules from importing `better-sqlite3`, SQLite `getDatabase`, or SQLite schema modules while allowing legacy SQLite tests and importer modules to remain.
- Updated README, `agent.md`, `AGENTS.md`, and visible Docs UI copy from SQLite-era wording to Postgres runtime persistence.
- Added `npm run db:migrate-to-postgres` as a temporary one-time importer. It reads `LOCAL_DB_PATH` with SQLite `readonly` and `query_only`, writes to `DATABASE_URL`, requires `--owner-id <uuid>`, supports `--dry-run`, validates target Postgres schema compatibility, imports with transactions and idempotent upserts, maps `owner-local-default` and `local-user` to the supplied owner UUID, converts integer booleans, parses JSON text to JSONB, preserves entity IDs/timestamps, and emits a content-free verification report.

## Files Changed

- `AGENTS.md`
- `README.md`
- `agent.md`
- `handoff.md`
- `package.json`
- `scripts/check-server-persistence-boundaries.mjs`
- `scripts/db-migrate-to-postgres.ts`
- `server/ai-artifacts.ts`
- `server/ai-attachments/image-routes.ts`
- `server/ai-memory.ts`
- `server/ai-workspace.ts`
- `server/app.ts`
- `server/automations-service.ts`
- `server/automations.ts`
- `server/calendar.ts`
- `server/composition-root.ts`
- `server/docs.ts`
- `server/http.ts`
- `server/nutrition-ai-food-log.ts`
- `server/nutrition.ts`
- `server/postgres-api-integration.test.ts`
- `server/skills-service.ts`
- `server/skills.ts`
- `server/workout.ts`
- `src/components/docs/DocsEditorHeader.tsx`
- `src/components/docs/DocsHomeHeader.tsx`

## Database Migrations Added

- None. This session used the existing Postgres migration set.

## Commands and Tests Run

- `npm run test:files` passed.
- `npm run lint` passed.
- `npm run db:test` passed: 34 tests passed.
- `npx tsx --test server/skills-service.test.ts server/automations-service.test.ts server/nutrition-ai-food-log.test.ts server/ai-memory.test.ts` passed: 12 tests passed.
- `npx tsx --test server/auth/require-owner.test.ts` passed: 10 tests passed.
- `npm run build` passed with the existing large-chunk warning.
- `npm run db:migrate-to-postgres -- --help` passed.
- `npm run db:migrate-to-postgres -- --owner-id 11111111-1111-4111-8111-111111111111 --dry-run` refused to run because `DATABASE_URL` was not set.
- `npm run lint` passed after adding the importer.
- `npm run test:files` passed after adding the importer.
- `npm run db:test` passed: 34 tests passed.
- `npx tsx --test server/db/postgres-migrations.test.ts` passed: 10 tests passed.
- Local test database dry run passed with synthetic owner UUID: 1160 rows processed and verification `PASSED`.
- Local test database import passed with synthetic owner UUID: 1160 rows processed and verification `PASSED`.
- Local test database idempotency rerun passed with synthetic owner UUID: 1160 rows processed and verification `PASSED`.

## Decisions and Invariants

- No credentials, connection strings, access tokens, or user content are recorded here.
- `DATABASE_URL` remains required in every environment; test mode may use `POSTGRES_TEST_DATABASE_URL` only through existing safe local test database validation.
- Browser code does not receive or use database credentials; feature access remains through same-origin server APIs.
- Runtime repository creation is centralized in `server/composition-root.ts` and scoped by authenticated Supabase UUID owner id.
- Frontend payloads never provide or override ownership.
- Entity IDs remain application-generated `text` values scoped by `owner_id`.
- SQLite modules remain available for legacy focused tests and one-time importer paths, but runtime feature modules are guarded by `scripts/check-server-persistence-boundaries.mjs`.
- `npm run test:postgres` continues to use `--test-concurrency=1` because migration/repository/API tests reset the same local test database.

## Known Issues or Blockers

- Legacy SQLite repository factories, schema modules, and `LOCAL_DB_PATH` config still exist for focused legacy tests and one-time importer support; they are not application runtime persistence.
- Build still reports the pre-existing large JavaScript chunk warning when `npm run build` is run.
- Supabase API URL and publishable key were provided, but the importer requires a direct Postgres `DATABASE_URL` and an explicit destination Supabase owner UUID. The requested Supabase dry run, import, verification, and idempotency rerun were not executed.

## Migration Verification Status

- FAILED for the requested Supabase migration because required live inputs were unavailable: `DATABASE_URL` and the destination owner UUID.
- Runtime persistence remains confirmed Postgres-only through startup validation, composition-root wiring, and the SQLite import guard.
- Inspected the current SQLite source schema read-only from the default `LOCAL_DB_PATH` and inspected all current Postgres migration files before writing importer logic.
- Source owner scan found 1160 rows mappable from `owner-local-default` or `local-user` and 0 unmapped owner rows.
- Source row counts used for validation: app settings 7, AI chats 15, AI artifacts 4, AI artifact versions 0, docs documents 4, docs tabs 4, docs versions 821, docs citations 0, docs migration sources 1, calendar calendars 1, calendar categories 3, calendar events 0, calendar recurrence rules 0, calendar recurrence exceptions 0, calendar tasks 0, calendar task recurrence rules 0, calendar settings 1, calendar undo actions 0, workout exercises 81, workout routines 3, workout routine exercises 11, workout sessions 0, workout session exercises 0, workout sets 0, nutrition foods 202, nutrition recipes 0, nutrition recipe ingredients 0, nutrition diary entries 0, nutrition diary items 0, nutrition goals 1, nutrition usage stats 0, skills 1, automations 0, workspace revision state 0.
- Local test database dry run/import/idempotency rerun all passed. Each processed 1160 rows and verified row counts, entity IDs, owner mapping, foreign-key validity, JSON validity, timestamp min/max ranges, document tab/version counts, calendar recurrence/exception counts, workout session/set counts, nutrition entry/item counts, and skill/automation counts.

## Next Exact Step

Provide a direct Postgres `DATABASE_URL` for the Supabase target and the destination Supabase owner UUID, then run `npm run db:migrate-to-postgres -- --owner-id <uuid> --dry-run`, `npm run db:migrate-to-postgres -- --owner-id <uuid>`, and a second `npm run db:migrate-to-postgres -- --owner-id <uuid>` to prove idempotency.

## Last Commit

- Before this session: `87dd5ad Implement Postgres feature repositories`.
