# Postgres Migration Handoff

## Current Phase

Postgres infrastructure setup is complete for this phase. Feature repositories were intentionally not migrated.

## Completed Work

- Replaced the previous auth handoff with the required Postgres migration handoff structure.
- Added mandatory Postgres configuration validation for development, test, preview, and production startup.
- Added optional test database URL support with local/test-name safety checks.
- Added a server-side Postgres pool module with shared pool creation, transaction support, explicit cleanup, and process signal cleanup.
- Added startup validation before the real server imports route modules, so missing Postgres config fails clearly before feature repositories initialize.
- Added Docker Compose services for local Postgres 17 dev and test databases.
- Added npm scripts for database start, stop, reset, and focused Postgres tests.
- Added focused tests for missing configuration, pool creation, test database safety, pool cleanup, transaction behavior, and development/production startup validation.
- Updated docs and agent instructions for the mandatory Postgres setup.

## Files Changed

- `.env.example`
- `AGENTS.md`
- `README.md`
- `agent.md`
- `docker-compose.postgres.yml`
- `handoff.md`
- `package-lock.json`
- `package.json`
- `server/app-postgres-startup.test.ts`
- `server/app.ts`
- `server/auth/require-owner.test.ts`
- `server/config.ts`
- `server/db/postgres-config.test.ts`
- `server/db/postgres-config.ts`
- `server/db/postgres.test.ts`
- `server/db/postgres.ts`
- `server/index.ts`
- `server/startup.ts`

## Database Migrations Added

- None.

## Commands and Tests Run

- `npm install pg @types/pg`
- `npm install --save-dev @types/pg`
- `npm run test:postgres` passed.
- `npx tsx --test server/auth/require-owner.test.ts` initially failed because one auth-only startup fixture did not provide Postgres config; after fixing the fixture, it passed.
- `npm run test:files` passed.
- `npm run lint` passed.
- `npm run build` passed with the existing large chunk warning.

## Decisions and Invariants

- No credentials, connection strings, access tokens, or user content are recorded here.
- `DATABASE_URL` is required for all runtime modes.
- `POSTGRES_TEST_DATABASE_URL` is optional; when test mode uses it or `DATABASE_URL`, the target must be local and clearly named as a test database.
- The Postgres pool layer has no SQLite fallback.
- Feature repositories remain out of scope for this infrastructure phase and still use the existing SQLite store until explicit migration work begins.
- Browser code must not query Supabase tables.

## Known Issues or Blockers

- Existing server repositories are synchronous SQLite repositories. Explicit async repository contracts and a full composition root are still missing.
- Because route modules still statically import existing repository singletons, direct imports of `server/app.ts` can still load SQLite-backed modules before `createApp()` runs. The CLI startup path validates Postgres before dynamically importing `server/app.ts`.

## Migration Verification Status

- Infrastructure verification passed through focused Postgres tests, the affected `createApp()` auth test, file-length checks, TypeScript, and production build.
- No feature data migration was attempted or added.

## Next Exact Step

Introduce explicit async repository contracts and a server composition root, then migrate the first feature repository to Postgres with a real schema migration and repository-level tests.

## Last Commit

- Before this session: `80cadbc changes`.
