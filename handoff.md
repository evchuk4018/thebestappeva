# Postgres Migration Handoff

## Current Phase

Version-controlled Supabase/Postgres schema migrations are now in place for the AI workspace, Docs, Skills, Automations, app settings, and workspace revision state tables. Feature repositories were intentionally not migrated in this session.

## Completed Work

- Read the prior handoff and inspected the current SQLite schemas and repository query patterns before editing.
- Inspected the working tree before editing; it was clean and `main` was ahead of `origin/main` by one commit.
- Started Docker Desktop, brought up the local Postgres dev/test services, and confirmed both containers were healthy.
- Added an idempotent Supabase/Postgres migration with owner-scoped composite keys, `uuid` `owner_id`, application-generated text entity IDs, `timestamptz` instants, boolean flags, `jsonb` serialized data, and appropriate integer/double/bigint numeric types.
- Preserved current foreign-key behavior for the requested tables, including artifact-version cascade, document child cascade, and document-version tab nullification.
- Added indexes matching the current repository access patterns for owner filtering, recency ordering, due automation claims, tab ordering, citation ordering, and version cursor pagination.
- Enabled RLS on every owner-controlled table and added authenticated owner policies requiring `owner_id = auth.uid()`.
- Did not grant anonymous table access. Anonymous table access is explicitly revoked.
- Added focused Postgres migration tests covering empty-database migration, safe reapplication, foreign keys, unique constraints, JSONB columns, owner indexes, RLS enabled, authenticated owner policies, and anonymous access denial.
- Wired the migration tests into `npm run test:postgres` and `npm run db:test`.

## Files Changed

- `handoff.md`
- `package.json`
- `server/db/postgres-migrations.test.ts`
- `supabase/migrations/20260704000000_owner_workspace_tables.sql`

## Database Migrations Added

- `supabase/migrations/20260704000000_owner_workspace_tables.sql`

## Tables Added

- `app_settings`: owner-scoped JSON settings with primary key `(owner_id, key)`.
- `ai_chats`: owner-scoped AI chat records with application text `id` and JSONB chat payloads.
- `ai_artifacts`: owner-scoped artifact records keyed by `(owner_id, id)`, preserving chat scoping by `chat_id` without adding a chat FK.
- `ai_artifact_versions`: owner-scoped artifact snapshots with cascade delete from `ai_artifacts`.
- `docs_documents`: owner-scoped document records with boolean `starred`, `double precision` `zoom`, and JSONB page settings.
- `docs_tabs`: owner-scoped document tabs with cascade delete from `docs_documents` and tab-order indexes.
- `docs_versions`: owner-scoped document versions with cascade delete from `docs_documents` and `ON DELETE SET NULL (tab_id)` from `docs_tabs`.
- `docs_citations`: owner-scoped document citations with cascade delete from `docs_documents`.
- `docs_migration_sources`: owner-scoped migration-source records; still required by the current Docs browser-storage import flow.
- `skills`: owner-scoped skills with unique `(owner_id, name)`, boolean `enabled`, and JSONB compatibility/metadata payloads.
- `automations`: owner-scoped automations with unique `(owner_id, name)`, boolean `enabled`, JSONB trigger/action payloads, and due-run indexes.
- `workspace_revision_state`: owner-scoped revision state keyed by `(owner_id, workspace_key)` with `bigint revision` and JSONB state metadata.

## Commands and Tests Run

- `docker version` initially failed because Docker Desktop was not running.
- Started Docker Desktop from `C:\Program Files\Docker\Docker\Docker Desktop.exe`.
- `npm run db:up` started the local Postgres dev and test containers.
- Docker health check confirmed `thebestappeva-postgres` and `thebestappeva-postgres-test` were healthy.
- First `npm run db:test` exposed migration-test assertion issues in the new test harness; fixed the skip handling and `pg_policies.roles` assertion.
- `npm run db:test` passed after fixes: 19 tests passed, 0 failed, 0 skipped.

## Decisions and Invariants

- No credentials, connection strings, access tokens, or user content are recorded here.
- The Express server remains the primary database caller; browser code must not query Supabase tables directly.
- The migration includes guarded local compatibility setup for `auth.uid()`, `anon`, and `authenticated` only when missing, so the same migration can run against the plain local Postgres test service.
- Owner-controlled Postgres tables use `uuid owner_id`; future repository work must use the authenticated Supabase user ID, not the existing SQLite-only `owner-local-default` string.
- Entity IDs remain application-generated `text` values and are unique within owner scope through composite primary keys.
- Docs migration-source records remain in scope because `docsRepository.hasMigration()` and `docsRepository.importMigration()` still use them.
- No feature repository implementation was added in this session.

## Known Issues or Blockers

- Existing feature repositories still use synchronous SQLite repositories and have not been switched to Postgres.
- Existing server repository factories still default to the SQLite-era `canonicalOwnerId` value, which is not a UUID and cannot be used with these Postgres schemas.
- There is still no composition root that injects the authenticated `request.authContext.userId` into feature repositories.
- `workspace_revision_state` is a forward-looking owner/workspace-key revision table; exact repository semantics and callers are still unresolved.

## Migration Verification Status

- Local Postgres dev and test services were operational and healthy before migration validation.
- The migration was applied against the local test Postgres service by `server/db/postgres-migrations.test.ts`.
- Verified empty migration, idempotent reapplication, FK cascade/nullification, owner-scoped uniqueness, JSONB columns, owner-prefixed indexes, RLS enablement, authenticated owner policy predicates, and anonymous table denial.

## Next Exact Step

Introduce async Postgres repository contracts plus a server composition root that passes `request.authContext.userId` as the UUID `owner_id`, then implement the first Postgres-backed repository against `supabase/migrations/20260704000000_owner_workspace_tables.sql` without changing the remaining SQLite repositories.

## Last Commit

- Before this session: `2522819 Add Postgres infrastructure`.
