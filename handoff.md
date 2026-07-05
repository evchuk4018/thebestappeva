# Postgres Migration Handoff

## Current Phase

Postgres adapters are implemented and wired for application settings, AI workspace/chats/generated memory, AI artifacts/artifact versions, and Docs documents/tabs/versions/citations. Calendar, Workout, Nutrition, Skills, and Automations were intentionally not migrated in this session.

## Completed Work

- Read the prior handoff, current repository interfaces, and the SQLite implementations before editing.
- Added async Postgres repository adapters for app settings, AI workspace, Docs, and AI artifacts.
- Kept SQL and Postgres row mapping inside the new adapter layer while returning existing shared domain types.
- Scoped all new Postgres repository operations by validated authenticated Supabase UUID `owner_id`.
- Switched AI workspace, Docs, AI artifacts, AI memory refresh, and image vision preference reads to per-request Postgres repositories built from `request.authContext.userId`.
- Added explicit AI workspace revision responses and save requests: `{ revision, workspace }`.
- Required expected workspace revision on writes, incremented revision after successful writes, and returned 409 Conflict on stale writes.
- Replaced workspace chats atomically and deleted only absent chats for the same owner.
- Updated AI workspace settings and generated user memory in the same transaction as chat replacement.
- Preserved current sorting, pagination, defaults, JSONB parsing, not-found behavior, artifact history snapshots, and Docs version cursors.
- Updated frontend AI workspace persistence to track revision and send it on saves.
- Kept browser access routed through server APIs only; no direct browser-to-database access was added.
- Kept Calendar, Workout, Nutrition, Skills, and Automations on their existing repositories.

## Files Changed

- `handoff.md`
- `package.json`
- `server/ai-artifacts.ts`
- `server/ai-attachments/image-routes.ts`
- `server/ai-attachments/vision-provider-types.ts`
- `server/ai-attachments/vision-service.ts`
- `server/ai-memory-service.ts`
- `server/ai-memory.ts`
- `server/ai-workspace.ts`
- `server/docs.ts`
- `server/db/postgres-ai-artifacts-repository.ts`
- `server/db/postgres-ai-workspace-repository.ts`
- `server/db/postgres-app-settings-repository.ts`
- `server/db/postgres-docs-repository.ts`
- `server/db/postgres-owner-workspace-repositories.test.ts`
- `server/db/postgres-repository-utils.ts`
- `shared/ai-workspace-contract.ts`
- `src/components/ai-tab/useAiWorkspacePersistence.ts`
- `src/lib/ai-workspace-storage.test.ts`
- `src/lib/ai-workspace-storage.ts`

## Database Migrations Added

- None. This session used the existing `app_settings`, `ai_chats`, `ai_artifacts`, `ai_artifact_versions`, `docs_*`, and `workspace_revision_state` tables from prior migrations.

## Commands and Tests Run

- `npx tsx --test server/db/postgres-owner-workspace-repositories.test.ts` passed: 4 tests passed.
- `npx tsx --test src/lib/ai-workspace-storage.test.ts server/ai-memory-service.test.ts` passed: 5 tests passed.
- `npx tsx --test server/ai-attachments/image-routes.test.ts server/ai-attachments/vision-service.test.ts` passed: 12 tests passed.
- `npm run test:files` passed.
- `npm run db:test` passed: 26 tests passed, 0 failed, 0 skipped.
- `npm run lint` passed.
- `npm run build` passed with the existing large-chunk warning.

## Decisions and Invariants

- No credentials, connection strings, access tokens, or user content are recorded here.
- The Express server remains the primary database caller; browser code must not query Supabase tables directly.
- Owner-controlled Postgres adapters require a UUID owner ID from authenticated Supabase request context.
- Frontend payloads never provide or override ownership.
- Entity IDs remain application-generated `text` values scoped by `owner_id`.
- Workspace revision state uses `workspace_revision_state` with key `ai.workspace`.
- Stale workspace writes fail with HTTP 409 and do not mutate chats, settings, memory, or revision.
- `npm run test:postgres` now uses `--test-concurrency=1` because Postgres migration/repository tests reset the same local test database.

## Known Issues or Blockers

- Calendar, Workout, Nutrition, Skills, and Automations still use the existing SQLite-era repositories.
- `server/app.ts` still initializes SQLite because unmigrated features need it.
- Existing SQLite repository factories and tests still use `canonicalOwnerId`; they are retained for unmigrated features and legacy focused tests.
- Nutrition's current SQLite-era `recentItemNames` query shape still needs a PostgreSQL-safe rewrite when Nutrition repositories are implemented.

## Migration Verification Status

- Local Postgres test service was available for validation.
- The full sorted migration set was applied by `server/db/postgres-migrations.test.ts`.
- Verified repository behavior for owner isolation, workspace atomicity, stale revision rejection, concurrent writes, JSONB serialization, document pagination, compound document saves, artifact version creation, and transaction rollback.

## Next Exact Step

Implement the next scoped Postgres repository migration for one remaining feature area, preferably Calendar, while continuing to inject authenticated `request.authContext.userId` as `owner_id` and without changing Workout or Nutrition in the same session.

## Last Commit

- Before this session: `c2c85e9 Add Postgres feature schema migrations`.
