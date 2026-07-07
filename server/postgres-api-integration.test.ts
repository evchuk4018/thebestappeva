import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { Pool, type PoolClient } from 'pg';
import { createApp } from './app';
import type { AccessTokenValidator, AuthenticatedTokenUser } from './auth/supabase';
import { closePostgresPool } from './db/postgres';
import { assertSafePostgresTestDatabase } from './db/postgres-config';

const migrationsUrl = new URL('../supabase/migrations/', import.meta.url);
const migrationFileNames = (await readdir(migrationsUrl)).filter((name) => name.endsWith('.sql')).sort();
const migrationSqls = await Promise.all(migrationFileNames.map((name) => readFile(new URL(name, migrationsUrl), 'utf8')));
const connectionString = process.env.POSTGRES_TEST_DATABASE_URL
  ?? 'postgresql://thebestappeva:thebestappeva_test@127.0.0.1:54323/thebestappeva_test';

const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';

function createTokenValidator(users: Record<string, AuthenticatedTokenUser | null>): AccessTokenValidator {
  return { getUser: async (accessToken) => users[accessToken] ?? null };
}

async function probePostgres() {
  try {
    assertSafePostgresTestDatabase(connectionString, 'POSTGRES_TEST_DATABASE_URL');
    const pool = new Pool({ connectionString, connectionTimeoutMillis: 1000, max: 1 });
    await pool.query('SELECT 1');
    await pool.end();
    return null;
  } catch (error) {
    return `local test Postgres unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const skipReason = await probePostgres();

function postgresApiTest(name: string, fn: () => Promise<void>) {
  return skipReason ? test(name, { skip: skipReason }, fn) : test(name, fn);
}

async function resetDatabase(client: PoolClient) {
  await client.query(`
    DROP TABLE IF EXISTS
      nutrition_usage_stats,
      nutrition_goals,
      nutrition_diary_items,
      nutrition_diary_entries,
      nutrition_recipe_ingredients,
      nutrition_recipes,
      nutrition_foods,
      workout_sets,
      workout_session_exercises,
      workout_sessions,
      workout_routine_exercises,
      workout_routines,
      workout_exercises,
      calendar_undo_actions,
      calendar_settings,
      calendar_task_recurrence_rules,
      calendar_tasks,
      calendar_recurrence_exceptions,
      calendar_recurrence_rules,
      calendar_events,
      calendar_categories,
      calendar_calendars,
      workspace_revision_state,
      automations,
      skills,
      docs_migration_sources,
      docs_citations,
      docs_versions,
      docs_tabs,
      docs_documents,
      ai_artifact_versions,
      ai_artifacts,
      ai_chats,
      app_settings
    CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE;
  `);
}

async function applyFreshMigration(pool: Pool) {
  const client = await pool.connect();
  try {
    await resetDatabase(client);
    for (const sql of migrationSqls) await client.query(sql);
  } finally {
    client.release();
  }
}

async function withApp<T>(run: (baseUrl: string, pool: Pool) => Promise<T>) {
  await closePostgresPool();
  const pool = new Pool({ connectionString, max: 6 });
  await applyFreshMigration(pool);
  const app = await createApp('preview', {
    attachFrontend: false,
    authConfig: { ownerEmail: 'owner@example.com', supabaseAnonKey: 'anon-key', supabaseUrl: 'https://supabase.test' },
    environment: 'test',
    postgresConfig: { databaseUrl: connectionString },
    tokenValidator: createTokenValidator({
      ownerA: { userId: ownerA, email: 'owner@example.com' },
      ownerB: { userId: ownerB, email: 'owner@example.com' },
    }),
  });
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const next = app.listen(0, '127.0.0.1', () => resolve(next));
  });
  const { port } = server.address() as AddressInfo;
  try {
    return await run(`http://127.0.0.1:${port}`, pool);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await closePostgresPool();
    await pool.end();
  }
}

function headers(token = 'ownerA') {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function requestJson(baseUrl: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...headers(), ...init.headers } });
  const body = await response.json() as Record<string, unknown>;
  return { response, body };
}

function workspace(memory: string) {
  return {
    chats: [],
    generatedUserMemory: memory,
    selectedProvider: 'ollama',
    selectedModel: 'qwen3.5:9b',
    visionMode: 'offline',
    enabledTools: { web_search: true },
    customSystemPrompt: '',
  };
}

postgresApiTest('authenticated API routes use owner-scoped Postgres persistence', async () => {
  await withApp(async (baseUrl, pool) => {
    assert.equal((await fetch(`${baseUrl}/api/auth/session`)).status, 401);
    assert.equal((await requestJson(baseUrl, '/api/auth/session')).response.status, 200);

    const loadedWorkspace = await requestJson(baseUrl, '/api/ai/workspace');
    await requestJson(baseUrl, '/api/ai/workspace', { method: 'PUT', body: JSON.stringify({ revision: loadedWorkspace.body.revision, workspace: workspace('owner-a-memory') }) });
    const otherWorkspace = await fetch(`${baseUrl}/api/ai/workspace`, { headers: headers('ownerB') });
    assert.notEqual(((await otherWorkspace.json()) as { workspace: { generatedUserMemory: string } }).workspace.generatedUserMemory, 'owner-a-memory');

    const createdDoc = await requestJson(baseUrl, '/api/docs', { method: 'POST', body: JSON.stringify({ templateId: 'blank' }) });
    const docId = ((createdDoc.body as { doc: { id: string } }).doc.id);
    assert.equal((await requestJson(baseUrl, '/api/docs')).response.status, 200);
    assert.equal((await requestJson(baseUrl, '/api/docs/migration/status?sourceKey=api-test')).body.migrated, false);
    await requestJson(baseUrl, '/api/docs/migration/import', { method: 'POST', body: JSON.stringify({ sourceKey: 'api-test', docs: [], tabs: [], versions: [], citations: [], preferences: null }) });
    assert.equal((await requestJson(baseUrl, '/api/docs/migration/status?sourceKey=api-test')).body.migrated, true);
    assert.equal((await requestJson(baseUrl, `/api/docs/${docId}`)).response.status, 200);

    const calendar = await requestJson(baseUrl, '/api/calendar/bootstrap');
    const calendarId = (calendar.body as { calendars: Array<{ id: string }> }).calendars[0].id;
    await requestJson(baseUrl, '/api/calendar/events', { method: 'POST', body: JSON.stringify({ calendarId, title: 'API event', startsAt: '2026-07-04T09:00:00.000Z', endsAt: '2026-07-04T10:00:00.000Z' }) });
    await requestJson(baseUrl, '/api/calendar/tasks', { method: 'POST', body: JSON.stringify({ title: 'API task', dueDate: '2026-07-04' }) });

    const workout = await requestJson(baseUrl, '/api/workout/bootstrap');
    const exerciseId = (workout.body as { exercises: Array<{ id: string }> }).exercises[0].id;
    const routine = await requestJson(baseUrl, '/api/workout/routines', { method: 'POST', body: JSON.stringify({ name: 'API routine', exercises: [{ exerciseId, targetSets: 1 }] }) });
    await requestJson(baseUrl, `/api/workout/sessions/from-routine/${(routine.body as { item: { id: string } }).item.id}`, { method: 'POST' });
    assert.equal((await requestJson(baseUrl, '/api/workout/history')).response.status, 200);

    await requestJson(baseUrl, '/api/nutrition/bootstrap?date=2026-07-04');
    await requestJson(baseUrl, '/api/nutrition/goals', { method: 'PUT', body: JSON.stringify({ caloriesTarget: 2200, proteinTargetG: 150, carbsTargetG: 250, fatTargetG: 70 }) });
    await requestJson(baseUrl, '/api/nutrition/entries', { method: 'POST', body: JSON.stringify({ loggedAt: '2026-07-04T08:00:00.000Z', items: [{ itemType: 'food', itemId: 'food_apple', quantity: 1, unit: 'serving', servingId: 'serving_1_cup' }] }) });
    assert.equal((await requestJson(baseUrl, '/api/nutrition/search?query=apple')).response.status, 200);

    const skill = await requestJson(baseUrl, '/api/skills', { method: 'POST', body: JSON.stringify({ name: 'api-writer', description: 'Drafts text.', instructions: 'Write clearly.' }) });
    assert.equal((await requestJson(baseUrl, '/api/skills/by-name/api-writer')).response.status, 200);
    const duplicateSkill = await requestJson(baseUrl, '/api/skills', { method: 'POST', body: JSON.stringify({ name: 'api-writer', description: 'Duplicate.', instructions: 'Nope.' }) });
    assert.equal(duplicateSkill.response.status, 409);

    const automation = await requestJson(baseUrl, '/api/automations', { method: 'POST', body: JSON.stringify({ name: 'api-daily', description: 'Run daily.', kind: 'schedule', trigger: { cadence: 'daily', timezone: 'UTC', startDate: null, endDate: null, jitterMinutes: null, timeOfDay: '00:00' }, action: { prompt: 'Summarize.', linkedSkillId: (skill.body as { skill: { id: string } }).skill.id, linkedSkillName: null, requiredTools: [], disabledTools: [] } }) });
    const automationId = (automation.body as { automation: { id: string } }).automation.id;
    await pool.query('UPDATE automations SET next_run_at = $1 WHERE owner_id = $2 AND id = $3', ['2020-01-01T00:00:00.000Z', ownerA, automationId]);
    assert.equal(((await requestJson(baseUrl, '/api/automations/claim-due', { method: 'POST' })).body as { runs: unknown[] }).runs.length, 1);
    assert.equal((await requestJson(baseUrl, `/api/automations/${automationId}/report-run`, { method: 'POST', body: JSON.stringify({ status: 'success', summary: 'Done.' }) })).response.status, 200);

    const invalidRelation = await requestJson(baseUrl, '/api/workout/routines', { method: 'POST', body: JSON.stringify({ name: 'Broken', exercises: [{ exerciseId: 'missing-exercise', targetSets: 1 }] }) });
    assert.deepEqual({ status: invalidRelation.response.status, error: invalidRelation.body.error }, { status: 400, error: 'Invalid persistence input.' });

    await pool.query('DROP TABLE skills CASCADE');
    const unexpectedPersistence = await requestJson(baseUrl, '/api/skills');
    assert.deepEqual({ status: unexpectedPersistence.response.status, error: unexpectedPersistence.body.error }, { status: 500, error: 'Unexpected persistence failure.' });
  });
});

test('API reports database outage without exposing connection details', async () => {
  await closePostgresPool();
  const app = await createApp('preview', {
    attachFrontend: false,
    authConfig: { ownerEmail: 'owner@example.com', supabaseAnonKey: 'anon-key', supabaseUrl: 'https://supabase.test' },
    environment: 'test',
    postgresConfig: { databaseUrl: 'postgresql://app:password@127.0.0.1:9/thebestappeva_test', postgresConnectionTimeoutMs: 100 },
    tokenValidator: createTokenValidator({ ownerA: { userId: ownerA, email: 'owner@example.com' } }),
  });
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const next = app.listen(0, '127.0.0.1', () => resolve(next));
  });
  const { port } = server.address() as AddressInfo;
  try {
    const result = await requestJson(`http://127.0.0.1:${port}`, '/api/ai/workspace');
    assert.deepEqual({ status: result.response.status, error: result.body.error }, { status: 503, error: 'Database is unavailable.' });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await closePostgresPool();
  }
});
