# Postgres Migration Handoff

## Current Phase

Postgres adapters are implemented and wired for application settings, AI workspace/chats/generated memory, AI artifacts/artifact versions, Docs documents/tabs/versions/citations, Calendar, Workout, Nutrition, Skills, and Automations.

## Completed Work

- Read the prior handoff, current SQLite-era repositories, shared contracts, route handlers, services, Postgres utilities, and Supabase migrations before editing.
- Added async Postgres repository adapters for Calendar, Workout, Nutrition, Skills, and Automations.
- Scoped all new repository operations by validated authenticated Supabase UUID `owner_id`.
- Kept SQL, Postgres row normalization, JSONB conversion, boolean/numeric/date/timestamptz conversion, and row mapping inside the persistence adapters.
- Switched Calendar, Workout, Nutrition, Skills, and Automations HTTP handlers to per-request Postgres repositories built from `request.authContext.userId`.
- Converted Skills and Automations service paths to support async repositories while preserving built-in skill behavior, linked-skill validation, name-conflict handling, and route error mapping.
- Preserved Calendar defaults, event/task recurrence expansion, occurrence overrides/cancellations, conflict flags, task ordering, settings, trash behavior, and undo rollback semantics.
- Preserved Workout preset seeding, routine saves, active-session reuse, expired-session completion, routine-session set creation, session replacement, history filtering, and logged-session atomicity.
- Preserved Nutrition seed foods/goals, brand foods, recipes, diary entries/items, history filtering, search ranking, recent item names, and usage-stat rebuilds.
- Preserved Skills user skill CRUD, enabled filtering, summary shape, built-in ordering through the service layer, and owner-scoped name uniqueness.
- Preserved Automations CRUD, scheduling fields, run-report fields, name uniqueness, linked-skill resolution, and due ordering.
- Implemented concurrency-safe scheduled automation claiming with `FOR UPDATE SKIP LOCKED`, updating claim state, trigger time, next run, and status in one transaction.
- Updated Nutrition AI food-log context/search hooks to allow async repository-backed dependencies.
- Added focused Postgres feature repository tests covering cross-owner isolation, Calendar recurrence and undo, Workout compound writes and completion, Nutrition recipe/diary/usage behavior, Skill uniqueness, concurrent automation claims, transaction rollback, and ordering/behavior compatibility.
- Added the new Postgres feature test file to `npm run test:postgres` / `npm run db:test`.

## Files Changed

- `handoff.md`
- `package.json`
- `server/automations-service.test.ts`
- `server/automations-service.ts`
- `server/automations.ts`
- `server/calendar.ts`
- `server/db/postgres-automations-repository.ts`
- `server/db/postgres-calendar-repository.ts`
- `server/db/postgres-feature-repositories.test.ts`
- `server/db/postgres-nutrition-repository.ts`
- `server/db/postgres-skills-repository.ts`
- `server/db/postgres-workout-repository.ts`
- `server/nutrition-ai-food-log.ts`
- `server/nutrition.ts`
- `server/skills-service.test.ts`
- `server/skills-service.ts`
- `server/skills.ts`
- `server/workout.ts`

## Database Migrations Added

- None. This session used the existing feature tables from `supabase/migrations/20260704000000_owner_workspace_tables.sql` and `supabase/migrations/20260704010000_feature_structured_tables.sql`.

## Commands and Tests Run

- `npm run lint` passed.
- `npx tsx --test server/db/postgres-feature-repositories.test.ts` passed: 6 tests passed.
- `npx tsx --test server/db/postgres-owner-workspace-repositories.test.ts` passed: 4 tests passed.
- `npx tsx --test server/skills-service.test.ts server/automations-service.test.ts server/nutrition-ai-food-log.test.ts` passed: 11 tests passed.
- `npm run db:test` passed: 32 tests passed.
- `npm run test:files` passed.
- `npm run build` passed with the existing large-chunk warning.
- `npx tsx --test server/db/calendar-repository.test.ts server/db/workout-repository.test.ts server/db/nutrition-repository.test.ts server/db/skills-repository.test.ts server/db/automations-repository.test.ts` passed: 28 tests passed.

## Decisions and Invariants

- No credentials, connection strings, access tokens, or user content are recorded here.
- Browser code still does not query Supabase tables directly; feature access remains through server APIs.
- Owner-controlled Postgres adapters require a UUID owner ID from authenticated Supabase request context.
- Frontend payloads never provide or override ownership.
- Entity IDs remain application-generated `text` values scoped by `owner_id`.
- Database row formats, Postgres `Date` values, JSONB values, numeric strings, and booleans are normalized before returning shared domain types.
- Calendar task recurrence continues to use `calendar_recurrence_rules` with `target_kind = 'task'`, preserving current repository behavior even though the migration also includes `calendar_task_recurrence_rules`.
- Calendar undo still creates the corresponding inverse undo entry through the same domain operation pattern as the SQLite-era repository.
- Nutrition `recentItemNames` uses a PostgreSQL-safe grouped query ordered by last logged time.
- Automation due claims are ordered by `next_run_at ASC, id ASC` and locked with `FOR UPDATE SKIP LOCKED` so concurrent callers do not receive the same scheduled occurrence.
- `npm run test:postgres` continues to use `--test-concurrency=1` because migration/repository tests reset the same local test database.

## Known Issues or Blockers

- `server/app.ts` still initializes SQLite with `getDatabase()` at startup. The migrated features no longer use SQLite through their route handlers, but legacy SQLite repository tests and remaining local-era infrastructure still require the SQLite schema path.
- Existing SQLite repository factories and tests still use `canonicalOwnerId`; they are retained for legacy focused tests.
- Build still reports the pre-existing large JavaScript chunk warning.

## Migration Verification Status

- Local Postgres test service was available for validation.
- The full sorted migration set was applied by the Postgres test suite.
- Verified repository behavior for owner isolation, recurrence, undo rollback, routine/session/set atomicity, session completion, recipe/diary writes, usage-stat rebuilds, skill uniqueness, concurrent automation claiming, run reporting, ordering compatibility, and failed transaction rollback.

## Next Exact Step

Run a production-style smoke test (`npm run build` then `npm run preview`) against a real authenticated session and verify the migrated feature tabs end-to-end through the UI/API.

## Last Commit

- Before this session: `c2c85e9 Add Postgres feature schema migrations`.
