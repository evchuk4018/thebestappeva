# Postgres Migration Handoff

## Current Phase

Version-controlled Supabase/Postgres schema migrations are now in place for the AI workspace, Docs, Skills, Automations, app settings, workspace revision state, and the structured Calendar, Workout, and Nutrition feature data. Feature repositories still use SQLite; repository implementation and data import were intentionally not changed in this session.

## Completed Work

- Read the prior handoff before editing.
- Inspected current SQLite schema modules and repository query patterns for Calendar, Workout, and Nutrition before designing the Postgres schema.
- Added an idempotent feature schema migration using `uuid owner_id`, application text IDs scoped by owner, boolean flags, `jsonb` serialized data, `timestamptz` instants, `date` date-only values, and `numeric` quantities/macros/targets/weights/reps.
- Preserved current foreign-key behavior from repository-backed SQLite semantics, including Calendar cascades and category nullification, Workout child cascades, Nutrition recipe/diary cascades, and restricted food deletion through recipe ingredients.
- Preserved existing owner-scoped uniqueness where it exists today, including Calendar settings, recurrence exceptions, Workout exercise names, Nutrition foods, Nutrition goals, and Nutrition usage stats.
- Recreated and expanded query-driven indexes for Calendar date ranges and parent lookups, Workout active/finished sessions and ordering, Nutrition diary chronology, name/brand search, and parent-child lookups.
- Enabled RLS on every new owner-controlled table and added authenticated owner policies requiring `owner_id = auth.uid()`.
- Revoked anonymous/public table access for every new table; only `authenticated` receives table privileges.
- Updated the Postgres migration test harness to apply all SQL files in `supabase/migrations` in sorted order.
- Added focused migration tests for FK cascades, `ON DELETE SET NULL`, restricted food deletion, owner-scoped uniqueness, recurrence exception uniqueness, JSONB columns, date/timestamp/boolean/numeric types, numeric precision, owner-prefixed indexes, RLS owner isolation, anonymous denial, and migration reapplication.

## Files Changed

- `handoff.md`
- `server/db/postgres-migrations.test.ts`
- `supabase/migrations/20260704010000_feature_structured_tables.sql`

## Database Migrations Added

- `supabase/migrations/20260704010000_feature_structured_tables.sql`

## Tables Added

- `calendar_calendars`: owner-scoped calendars with boolean visibility and trash timestamp.
- `calendar_categories`: owner-scoped categories cascading from calendars.
- `calendar_events`: owner-scoped events cascading from calendars, with category `ON DELETE SET NULL`, `timestamptz` instants, and `date` all-day boundaries.
- `calendar_recurrence_rules`: owner-scoped event/task recurrence rule payloads without a target FK, matching current repository behavior.
- `calendar_recurrence_exceptions`: owner-scoped event occurrence actions with JSONB overrides, event cascade, and unique `(owner_id, event_id, occurrence_key)`.
- `calendar_tasks`: owner-scoped tasks with category `ON DELETE SET NULL`, optional due instant/date, completion, and trash timestamp.
- `calendar_task_recurrence_rules`: owner-scoped task recurrence rules cascading from tasks.
- `calendar_settings`: owner-scoped settings keyed by `owner_id`.
- `calendar_undo_actions`: owner-scoped undo snapshots with JSONB before/after payloads.
- `workout_exercises`: owner-scoped exercises with unique `(owner_id, name)` and boolean preset flag.
- `workout_routines`: owner-scoped routines with archive timestamp.
- `workout_routine_exercises`: owner-scoped ordered routine children cascading from routines and exercises.
- `workout_sessions`: owner-scoped sessions with nullable non-FK `routine_id`, preserving current behavior.
- `workout_session_exercises`: owner-scoped ordered session children cascading from sessions and exercises.
- `workout_sets`: owner-scoped sets cascading from session exercises with numeric reps, RIR, and weight.
- `nutrition_foods`: owner-scoped foods with JSONB servings, numeric macros, and unique `(owner_id, source_type, name, brand_name)`.
- `nutrition_recipes`: owner-scoped recipes with numeric serving count.
- `nutrition_recipe_ingredients`: owner-scoped recipe children cascading from recipes and restricting food deletion.
- `nutrition_diary_entries`: owner-scoped diary entries ordered by logged timestamp.
- `nutrition_diary_items`: owner-scoped diary item children cascading from entries; `item_id` remains polymorphic without an FK.
- `nutrition_goals`: owner-scoped macro/calorie targets keyed by `owner_id`.
- `nutrition_usage_stats`: owner-scoped item usage counters keyed by `(owner_id, item_type, item_id)`.

## Commands and Tests Run

- `npm run db:test` passed: 22 tests passed, 0 failed, 0 skipped.
- `npm run lint` passed.

## Decisions and Invariants

- No credentials, connection strings, access tokens, or user content are recorded here.
- The Express server remains the primary database caller; browser code must not query Supabase tables directly.
- Owner-controlled Postgres tables use `uuid owner_id`; future repository work must use the authenticated Supabase user ID, not the existing SQLite-only `owner-local-default` string.
- Entity IDs remain application-generated `text` values and are unique within owner scope through composite primary keys unless the current table is keyed by `owner_id` or another existing composite key.
- Calendar recurrence rules intentionally do not FK `target_id`, matching the current repository's generic event/task target behavior.
- Workout `workout_sessions.routine_id` intentionally has no FK, matching current session history behavior.
- Nutrition `nutrition_diary_items.item_id` intentionally has no FK because it is polymorphic across food and recipe items.
- No repository implementation, server composition-root changes, or data import was added in this session.

## Known Issues or Blockers

- Existing feature repositories still use synchronous SQLite repositories and have not been switched to Postgres.
- Existing server repository factories still default to the SQLite-era `canonicalOwnerId` value, which is not a UUID and cannot be used with these Postgres schemas.
- There is still no composition root that injects the authenticated `request.authContext.userId` into feature repositories.
- Nutrition's current SQLite-era `recentItemNames` query shape uses `DISTINCT` with an external `ORDER BY`; it will need a PostgreSQL-safe rewrite when Nutrition repositories are implemented.

## Migration Verification Status

- Local Postgres test service was available for validation.
- The full sorted migration set was applied against the local test Postgres service by `server/db/postgres-migrations.test.ts`.
- Verified empty-database migration, idempotent reapplication, FK cascades, `ON DELETE SET NULL`, restricted food deletion, owner-scoped uniqueness, recurrence exception uniqueness, JSONB feature columns, `date` and `timestamptz` behavior, boolean/native numeric types, numeric precision, query indexes, RLS enablement, authenticated owner isolation, and anonymous table denial.

## Next Exact Step

Introduce async Postgres repository contracts plus a server composition root that passes `request.authContext.userId` as the UUID `owner_id`, then implement the first Calendar/Workout/Nutrition Postgres-backed repository against `supabase/migrations/20260704010000_feature_structured_tables.sql` without changing unrelated SQLite repositories.

## Last Commit

- Before this session: `1ef7814 Add Postgres owner workspace migrations`.
