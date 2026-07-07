# Postgres Migration Handoff

## Current Phase

The application runtime now uses Postgres as the only persistence implementation. Legacy SQLite repositories, schema modules, and `better-sqlite3` remain only for one-time importer paths and focused legacy tests.

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

## Files Changed

- `AGENTS.md`
- `README.md`
- `agent.md`
- `handoff.md`
- `package.json`
- `scripts/check-server-persistence-boundaries.mjs`
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

## Migration Verification Status

- Local Postgres test service was available for validation.
- The full sorted migration set was applied by the Postgres test suite.
- Verified focused Postgres adapters for owner isolation, workspace revisions, documents, artifacts, calendar recurrence/undo, workout atomicity, nutrition behavior, skills, and automations.
- Verified real API behavior for authenticated owner resolution, migrated feature routes, owner isolation, automation background claiming/reporting, stable persistence error translation, and database outage handling.
- Verified static architecture guard blocks runtime feature imports of SQLite persistence APIs.

## Next Exact Step

Run a production-style smoke test (`npm run build` then `npm run preview`) against a real authenticated Supabase session and manually exercise the migrated tabs end-to-end.

## Last Commit

- Before this session: `87dd5ad Implement Postgres feature repositories`.
