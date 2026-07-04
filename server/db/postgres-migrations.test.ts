import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { Pool, type PoolClient } from 'pg';
import { assertSafePostgresTestDatabase } from './postgres-config';

const migrationsUrl = new URL('../../supabase/migrations/', import.meta.url);
const migrationFileNames = (await readdir(migrationsUrl)).filter((name) => name.endsWith('.sql')).sort();
const migrationSqls = await Promise.all(migrationFileNames.map((name) => readFile(new URL(name, migrationsUrl), 'utf8')));
const connectionString = process.env.POSTGRES_TEST_DATABASE_URL
  ?? 'postgresql://thebestappeva:thebestappeva_test@127.0.0.1:54323/thebestappeva_test';

const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';

const ownerTables = [
  'app_settings',
  'ai_chats',
  'ai_artifacts',
  'ai_artifact_versions',
  'docs_documents',
  'docs_tabs',
  'docs_versions',
  'docs_citations',
  'docs_migration_sources',
  'skills',
  'automations',
  'workspace_revision_state',
  'calendar_calendars',
  'calendar_categories',
  'calendar_events',
  'calendar_recurrence_rules',
  'calendar_recurrence_exceptions',
  'calendar_tasks',
  'calendar_task_recurrence_rules',
  'calendar_settings',
  'calendar_undo_actions',
  'workout_exercises',
  'workout_routines',
  'workout_routine_exercises',
  'workout_sessions',
  'workout_session_exercises',
  'workout_sets',
  'nutrition_foods',
  'nutrition_recipes',
  'nutrition_recipe_ingredients',
  'nutrition_diary_entries',
  'nutrition_diary_items',
  'nutrition_goals',
  'nutrition_usage_stats',
] as const;

const expectedIndexes = [
  'idx_ai_chats_owner_updated',
  'idx_ai_artifacts_owner_chat_updated',
  'idx_ai_artifact_versions_owner_artifact_created',
  'idx_docs_documents_owner_updated_at',
  'idx_docs_documents_owner_last_opened_at',
  'idx_docs_tabs_owner_document_id',
  'idx_docs_versions_owner_document_created',
  'idx_docs_citations_owner_document_id',
  'idx_skills_owner_name',
  'idx_skills_owner_enabled',
  'idx_skills_owner_updated_at',
  'idx_automations_owner_name',
  'idx_automations_owner_enabled',
  'idx_automations_owner_due',
  'idx_automations_owner_updated_at',
  'idx_workspace_revision_state_owner_updated',
  'idx_calendar_calendars_owner_trash_created',
  'idx_calendar_categories_owner_calendar',
  'idx_calendar_categories_owner_name',
  'idx_calendar_events_owner_range',
  'idx_calendar_events_owner_calendar',
  'idx_calendar_events_owner_category',
  'idx_calendar_recurrence_target',
  'idx_calendar_exceptions_event',
  'idx_calendar_tasks_owner_due',
  'idx_calendar_tasks_owner_category',
  'idx_calendar_task_recurrence_task',
  'idx_calendar_undo_owner_created',
  'idx_workout_exercises_owner_category_name',
  'idx_workout_routines_owner_active_updated',
  'idx_workout_routines_owner_updated',
  'idx_workout_sessions_owner_active',
  'idx_workout_sessions_owner_finished',
  'idx_workout_routine_exercises_owner_routine',
  'idx_workout_routine_exercises_owner_exercise',
  'idx_workout_session_exercises_owner_session',
  'idx_workout_session_exercises_owner_exercise',
  'idx_workout_sets_owner_session_exercise',
  'idx_nutrition_foods_owner_source_name',
  'idx_nutrition_foods_owner_name_search',
  'idx_nutrition_foods_owner_brand_search',
  'idx_nutrition_recipes_owner_updated',
  'idx_nutrition_recipe_ingredients_owner_recipe',
  'idx_nutrition_recipe_ingredients_owner_food',
  'idx_nutrition_diary_entries_owner_logged',
  'idx_nutrition_diary_items_owner_entry',
  'idx_nutrition_diary_items_owner_item',
  'idx_nutrition_usage_stats_owner_last_used',
] as const;

async function probePostgres() {
  try {
    assertSafePostgresTestDatabase(connectionString, 'POSTGRES_TEST_DATABASE_URL');
    const pool = new Pool({ connectionString, connectionTimeoutMillis: 1000, max: 1 });
    await pool.query('SELECT 1');
    await pool.end();
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `local test Postgres unavailable: ${message}`;
  }
}

const skipReason = await probePostgres();

function migrationTest(name: string, fn: () => Promise<void>) {
  return skipReason ? test(name, { skip: skipReason }, fn) : test(name, fn);
}

async function withClient<T>(run: (client: PoolClient) => Promise<T>) {
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();
  try {
    return await run(client);
  } finally {
    client.release();
    await pool.end();
  }
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

async function applyMigration(client: PoolClient) {
  for (const sql of migrationSqls) {
    await client.query(sql);
  }
}

async function applyFreshMigration(client: PoolClient) {
  await resetDatabase(client);
  await applyMigration(client);
}

async function expectRejected(client: PoolClient, sql: string, values: unknown[] = []) {
  await assert.rejects(() => client.query(sql, values));
}

async function seedCalendarBase(client: PoolClient, ownerId = ownerA) {
  await client.query(`
    INSERT INTO calendar_calendars (owner_id, id, name, color, visible, created_at, updated_at)
    VALUES ($1, 'cal-1', 'Calendar', '#111111', true, now(), now())
  `, [ownerId]);
  await client.query(`
    INSERT INTO calendar_categories (owner_id, id, calendar_id, name, color, created_at, updated_at)
    VALUES ($1, 'cat-1', 'cal-1', 'Category', '#222222', now(), now())
  `, [ownerId]);
}

async function seedCalendarEvent(client: PoolClient, ownerId = ownerA) {
  await client.query(`
    INSERT INTO calendar_events (owner_id, id, calendar_id, category_id, title, notes, location, timezone, starts_at, ends_at, all_day, start_date, end_date, created_at, updated_at)
    VALUES ($1, 'event-1', 'cal-1', 'cat-1', 'Event', '', '', 'UTC', '2026-07-04T09:00:00Z', '2026-07-04T10:00:00Z', false, '2026-07-04', '2026-07-04', now(), now())
  `, [ownerId]);
}

async function seedWorkoutBase(client: PoolClient, ownerId = ownerA) {
  await client.query(`
    INSERT INTO workout_exercises (owner_id, id, name, category, equipment, is_preset, created_at, updated_at)
    VALUES ($1, 'exercise-1', 'Squat', 'Legs', 'Barbell', false, now(), now())
  `, [ownerId]);
  await client.query(`
    INSERT INTO workout_routines (owner_id, id, name, created_at, updated_at)
    VALUES ($1, 'routine-1', 'Strength', now(), now())
  `, [ownerId]);
  await client.query(`
    INSERT INTO workout_sessions (owner_id, id, routine_id, name, started_at, updated_at)
    VALUES ($1, 'session-1', 'missing-routine-is-allowed', 'Session', now(), now())
  `, [ownerId]);
}

async function seedNutritionFood(client: PoolClient, ownerId = ownerA) {
  await client.query(`
    INSERT INTO nutrition_foods (owner_id, id, source_type, name, brand_name, barcode_text, servings_json, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, created_at, updated_at)
    VALUES ($1, 'food-1', 'custom', 'Yogurt', 'Brand', NULL, '[{"id":"100g","label":"100 g","grams":100}]', 59.1250, 10.2500, 3.5000, 0.4000, now(), now())
  `, [ownerId]);
}

migrationTest('applies owner workspace migration to an empty database', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);

    const tables = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name
    `, [ownerTables]);

    assert.deepEqual(tables.rows.map((row) => row.table_name), [...ownerTables].sort());
  });
});

migrationTest('safely reapplies the owner workspace migration', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);
    await applyMigration(client);

    const policies = await client.query<{ count: string }>(`
      SELECT COUNT(*) AS count
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
    `, [ownerTables]);

    assert.equal(Number(policies.rows[0].count), ownerTables.length);
  });
});

migrationTest('enforces migrated foreign-key cascade and nullification behavior', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);

    await client.query(`
      INSERT INTO ai_artifacts (owner_id, id, chat_id, title, type, schema_version, content_markdown, context_policy_json, citations_json, created_at, updated_at)
      VALUES ($1, 'artifact-1', 'chat-1', 'Artifact', 'markdown', 1, 'Body', '{}', '[]', now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO ai_artifact_versions (owner_id, id, artifact_id, title, type, content_markdown, context_policy_json, citations_json, actor, reason, created_at)
      VALUES ($1, 'artifact-version-1', 'artifact-1', 'Artifact', 'markdown', 'Body', '{}', '[]', 'assistant', 'snapshot', now())
    `, [ownerA]);
    await client.query('DELETE FROM ai_artifacts WHERE owner_id = $1 AND id = $2', [ownerA, 'artifact-1']);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM ai_artifact_versions')).rows[0].count), 0);

    await client.query(`
      INSERT INTO docs_documents (owner_id, id, title, created_at, updated_at, last_opened_at, starred, template_id, active_tab_id, layout_mode, zoom, page_settings_json)
      VALUES ($1, 'doc-1', 'Doc', now(), now(), now(), false, 'blank', 'tab-1', 'pages', 100, '{}')
    `, [ownerA]);
    await client.query(`
      INSERT INTO docs_tabs (owner_id, id, document_id, title, tab_order, outline_visible, content, content_format, text_content, created_at, updated_at)
      VALUES ($1, 'tab-1', 'doc-1', 'Tab', 0, true, '<p>Body</p>', 'html', 'Body', now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO docs_versions (owner_id, id, document_id, tab_id, created_at, label, kind, content, content_format, snapshot_title)
      VALUES ($1, 'version-1', 'doc-1', 'tab-1', now(), 'Autosave', 'auto', '<p>Body</p>', 'html', 'Doc')
    `, [ownerA]);
    await client.query('DELETE FROM docs_tabs WHERE owner_id = $1 AND id = $2', [ownerA, 'tab-1']);
    assert.equal((await client.query('SELECT tab_id FROM docs_versions WHERE owner_id = $1 AND id = $2', [ownerA, 'version-1'])).rows[0].tab_id, null);

    await client.query(`
      INSERT INTO docs_tabs (owner_id, id, document_id, title, tab_order, outline_visible, content, content_format, text_content, created_at, updated_at)
      VALUES ($1, 'tab-2', 'doc-1', 'Tab 2', 0, true, '<p>Body</p>', 'html', 'Body', now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO docs_citations (owner_id, id, document_id, label, details)
      VALUES ($1, 'citation-1', 'doc-1', 'Source', 'Details')
    `, [ownerA]);
    await client.query('DELETE FROM docs_documents WHERE owner_id = $1 AND id = $2', [ownerA, 'doc-1']);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM docs_versions')).rows[0].count), 0);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM docs_citations')).rows[0].count), 0);

    await expectRejected(client, `
      INSERT INTO docs_tabs (owner_id, id, document_id, title, tab_order, outline_visible, content, content_format, text_content, created_at, updated_at)
      VALUES ($1, 'tab-bad', 'missing-doc', 'Bad', 0, true, '', 'html', '', now(), now())
    `, [ownerA]);
  });
});

migrationTest('enforces feature foreign-key cascade, set null, and restrict behavior', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);

    await seedCalendarBase(client);
    await seedCalendarEvent(client);
    await client.query(`
      INSERT INTO calendar_recurrence_exceptions (owner_id, id, event_id, occurrence_key, action, override_json, created_at, updated_at)
      VALUES ($1, 'exception-1', 'event-1', '2026-07-04T09:00:00Z', 'cancel', '{"reason":"busy"}', now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO calendar_tasks (owner_id, id, category_id, title, notes, timezone, priority, created_at, updated_at)
      VALUES ($1, 'task-1', 'cat-1', 'Task', '', 'UTC', 'none', now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO calendar_task_recurrence_rules (owner_id, id, task_id, frequency, interval_count, by_weekday_json, rrule_text, created_at, updated_at)
      VALUES ($1, 'task-rule-1', 'task-1', 'WEEKLY', 1, '["MO"]', 'FREQ=WEEKLY', now(), now())
    `, [ownerA]);
    await client.query('DELETE FROM calendar_categories WHERE owner_id = $1 AND id = $2', [ownerA, 'cat-1']);
    assert.equal((await client.query('SELECT category_id FROM calendar_events WHERE owner_id = $1 AND id = $2', [ownerA, 'event-1'])).rows[0].category_id, null);
    assert.equal((await client.query('SELECT category_id FROM calendar_tasks WHERE owner_id = $1 AND id = $2', [ownerA, 'task-1'])).rows[0].category_id, null);
    await client.query('DELETE FROM calendar_tasks WHERE owner_id = $1 AND id = $2', [ownerA, 'task-1']);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM calendar_task_recurrence_rules')).rows[0].count), 0);
    await client.query('DELETE FROM calendar_calendars WHERE owner_id = $1 AND id = $2', [ownerA, 'cal-1']);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM calendar_events')).rows[0].count), 0);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM calendar_recurrence_exceptions')).rows[0].count), 0);

    await seedWorkoutBase(client);
    await client.query(`
      INSERT INTO workout_routine_exercises (owner_id, id, routine_id, exercise_id, order_index, target_sets, created_at)
      VALUES ($1, 'routine-exercise-1', 'routine-1', 'exercise-1', 0, 3, now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO workout_session_exercises (owner_id, id, session_id, exercise_id, order_index, notes)
      VALUES ($1, 'session-exercise-1', 'session-1', 'exercise-1', 0, '')
    `, [ownerA]);
    await client.query(`
      INSERT INTO workout_sets (owner_id, id, session_exercise_id, set_index, reps, weight, completed)
      VALUES ($1, 'set-1', 'session-exercise-1', 0, 5.5, 225.125, true)
    `, [ownerA]);
    await client.query('DELETE FROM workout_sessions WHERE owner_id = $1 AND id = $2', [ownerA, 'session-1']);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM workout_session_exercises')).rows[0].count), 0);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM workout_sets')).rows[0].count), 0);
    await client.query('DELETE FROM workout_routines WHERE owner_id = $1 AND id = $2', [ownerA, 'routine-1']);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM workout_routine_exercises')).rows[0].count), 0);

    await seedNutritionFood(client);
    await client.query(`
      INSERT INTO nutrition_recipes (owner_id, id, name, note, servings, created_at, updated_at)
      VALUES ($1, 'recipe-1', 'Bowl', '', 2.5, now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO nutrition_recipe_ingredients (owner_id, id, recipe_id, food_id, amount_g, order_index)
      VALUES ($1, 'ingredient-1', 'recipe-1', 'food-1', 125.2500, 0)
    `, [ownerA]);
    await expectRejected(client, 'DELETE FROM nutrition_foods WHERE owner_id = $1 AND id = $2', [ownerA, 'food-1']);
    await client.query('DELETE FROM nutrition_recipes WHERE owner_id = $1 AND id = $2', [ownerA, 'recipe-1']);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM nutrition_recipe_ingredients')).rows[0].count), 0);
    await client.query(`
      INSERT INTO nutrition_diary_entries (owner_id, id, logged_at, note, created_at, updated_at)
      VALUES ($1, 'entry-1', now(), '', now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO nutrition_diary_items (owner_id, id, entry_id, item_type, item_id, quantity, unit, amount_g)
      VALUES ($1, 'item-1', 'entry-1', 'food', 'food-1', 1.25, 'g', 125.2500)
    `, [ownerA]);
    await client.query('DELETE FROM nutrition_diary_entries WHERE owner_id = $1 AND id = $2', [ownerA, 'entry-1']);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM nutrition_diary_items')).rows[0].count), 0);
  });
});

migrationTest('enforces owner-scoped unique constraints', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);

    await client.query(`
      INSERT INTO skills (owner_id, id, name, description, instructions, created_at, updated_at)
      VALUES ($1, 'skill-1', 'writer', 'Mine', 'Write', now(), now())
    `, [ownerA]);
    await expectRejected(client, `
      INSERT INTO skills (owner_id, id, name, description, instructions, created_at, updated_at)
      VALUES ($1, 'skill-2', 'writer', 'Duplicate', 'Write', now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO skills (owner_id, id, name, description, instructions, created_at, updated_at)
      VALUES ($1, 'skill-2', 'writer', 'Other owner', 'Write', now(), now())
    `, [ownerB]);

    await client.query(`
      INSERT INTO app_settings (owner_id, key, value_json)
      VALUES ($1, 'docs.preferences', '{"sort":"updatedAt"}')
    `, [ownerA]);
    await expectRejected(client, `
      INSERT INTO app_settings (owner_id, key, value_json)
      VALUES ($1, 'docs.preferences', '{}')
    `, [ownerA]);

    await client.query(`
      INSERT INTO calendar_settings (owner_id, timezone, week_start, hour_cycle, working_hours_start, working_hours_end, updated_at)
      VALUES ($1, 'UTC', 'sun', '24', '09:00', '17:00', now())
    `, [ownerA]);
    await expectRejected(client, `
      INSERT INTO calendar_settings (owner_id, timezone, week_start, hour_cycle, working_hours_start, working_hours_end, updated_at)
      VALUES ($1, 'UTC', 'mon', '12', '08:00', '16:00', now())
    `, [ownerA]);

    await client.query(`
      INSERT INTO workout_exercises (owner_id, id, name, category, equipment, is_preset, created_at, updated_at)
      VALUES ($1, 'exercise-1', 'Squat', 'Legs', 'Barbell', false, now(), now())
    `, [ownerA]);
    await expectRejected(client, `
      INSERT INTO workout_exercises (owner_id, id, name, category, equipment, is_preset, created_at, updated_at)
      VALUES ($1, 'exercise-2', 'Squat', 'Legs', 'Barbell', false, now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO workout_exercises (owner_id, id, name, category, equipment, is_preset, created_at, updated_at)
      VALUES ($1, 'exercise-1', 'Squat', 'Legs', 'Barbell', false, now(), now())
    `, [ownerB]);

    await client.query(`
      INSERT INTO nutrition_foods (owner_id, id, source_type, name, brand_name, barcode_text, servings_json, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, created_at, updated_at)
      VALUES ($1, 'food-1', 'custom', 'Yogurt', 'Brand', NULL, '[]', 10, 1, 2, 3, now(), now())
    `, [ownerA]);
    await expectRejected(client, `
      INSERT INTO nutrition_foods (owner_id, id, source_type, name, brand_name, barcode_text, servings_json, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, created_at, updated_at)
      VALUES ($1, 'food-2', 'custom', 'Yogurt', 'Brand', NULL, '[]', 10, 1, 2, 3, now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO nutrition_foods (owner_id, id, source_type, name, brand_name, barcode_text, servings_json, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, created_at, updated_at)
      VALUES ($1, 'food-1', 'custom', 'Yogurt', 'Brand', NULL, '[]', 10, 1, 2, 3, now(), now())
    `, [ownerB]);
  });
});

migrationTest('enforces recurrence exception uniqueness per owner event occurrence', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);
    await seedCalendarBase(client);
    await seedCalendarEvent(client);

    await client.query(`
      INSERT INTO calendar_recurrence_exceptions (owner_id, id, event_id, occurrence_key, action, created_at, updated_at)
      VALUES ($1, 'exception-1', 'event-1', '2026-07-04T09:00:00Z', 'cancel', now(), now())
    `, [ownerA]);
    await expectRejected(client, `
      INSERT INTO calendar_recurrence_exceptions (owner_id, id, event_id, occurrence_key, action, created_at, updated_at)
      VALUES ($1, 'exception-2', 'event-1', '2026-07-04T09:00:00Z', 'override', now(), now())
    `, [ownerA]);

    await seedCalendarBase(client, ownerB);
    await seedCalendarEvent(client, ownerB);
    await client.query(`
      INSERT INTO calendar_recurrence_exceptions (owner_id, id, event_id, occurrence_key, action, created_at, updated_at)
      VALUES ($1, 'exception-1', 'event-1', '2026-07-04T09:00:00Z', 'cancel', now(), now())
    `, [ownerB]);
  });
});

migrationTest('uses JSONB for serialized application data columns', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);

    const jsonColumns = await client.query<{ table_name: string; column_name: string; data_type: string }>(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (table_name, column_name) IN (
          ('app_settings', 'value_json'),
          ('ai_chats', 'payload_json'),
          ('ai_artifacts', 'context_policy_json'),
          ('ai_artifacts', 'citations_json'),
          ('ai_artifact_versions', 'context_policy_json'),
          ('ai_artifact_versions', 'citations_json'),
          ('docs_documents', 'page_settings_json'),
          ('skills', 'compatible_modes_json'),
          ('skills', 'metadata_json'),
          ('automations', 'trigger_json'),
          ('automations', 'action_json'),
          ('workspace_revision_state', 'state_json'),
          ('calendar_recurrence_rules', 'by_weekday_json'),
          ('calendar_recurrence_exceptions', 'override_json'),
          ('calendar_task_recurrence_rules', 'by_weekday_json'),
          ('calendar_undo_actions', 'before_json'),
          ('calendar_undo_actions', 'after_json'),
          ('nutrition_foods', 'servings_json')
        )
    `);

    assert.equal(jsonColumns.rows.length, 18);
    assert.equal(jsonColumns.rows.every((row) => row.data_type === 'jsonb'), true);

    await client.query('INSERT INTO app_settings (owner_id, key, value_json) VALUES ($1, $2, $3)', [ownerA, 'ai.enabled-tools', { webSearch: true }]);
    const row = await client.query("SELECT value_json->>'webSearch' AS enabled FROM app_settings WHERE owner_id = $1", [ownerA]);
    assert.equal(row.rows[0].enabled, 'true');

    await seedCalendarBase(client);
    await seedCalendarEvent(client);
    await client.query(`
      INSERT INTO calendar_recurrence_rules (owner_id, id, target_kind, target_id, frequency, interval_count, by_weekday_json, rrule_text, created_at, updated_at)
      VALUES ($1, 'rule-1', 'event', 'event-1', 'WEEKLY', 1, '["MO","WE"]', 'FREQ=WEEKLY', now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO calendar_recurrence_exceptions (owner_id, id, event_id, occurrence_key, action, override_json, created_at, updated_at)
      VALUES ($1, 'exception-1', 'event-1', '2026-07-04T09:00:00Z', 'override', '{"title":"Moved"}', now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO calendar_undo_actions (owner_id, id, action_kind, entity_kind, entity_id, before_json, after_json, created_at)
      VALUES ($1, 'undo-1', 'update', 'event', 'event-1', '{"title":"Before"}', '{"title":"After"}', now())
    `, [ownerA]);
    await seedNutritionFood(client);

    const featureJson = await client.query(`
      SELECT
        (SELECT by_weekday_json->>0 FROM calendar_recurrence_rules WHERE owner_id = $1 AND id = 'rule-1') AS weekday,
        (SELECT override_json->>'title' FROM calendar_recurrence_exceptions WHERE owner_id = $1 AND id = 'exception-1') AS override_title,
        (SELECT after_json->>'title' FROM calendar_undo_actions WHERE owner_id = $1 AND id = 'undo-1') AS undo_title,
        (SELECT servings_json->0->>'label' FROM nutrition_foods WHERE owner_id = $1 AND id = 'food-1') AS serving_label
    `, [ownerA]);
    assert.deepEqual(featureJson.rows[0], {
      weekday: 'MO',
      override_title: 'Moved',
      undo_title: 'After',
      serving_label: '100 g',
    });
  });
});

migrationTest('uses date, timestamptz, boolean, and numeric feature column types', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);

    const typedColumns = await client.query<{ table_name: string; column_name: string; data_type: string }>(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (table_name, column_name) IN (
          ('calendar_events', 'starts_at'),
          ('calendar_events', 'start_date'),
          ('calendar_events', 'all_day'),
          ('calendar_tasks', 'due_at'),
          ('calendar_tasks', 'due_date'),
          ('workout_exercises', 'is_preset'),
          ('workout_sets', 'weight'),
          ('nutrition_foods', 'calories_per_100g'),
          ('nutrition_diary_entries', 'logged_at'),
          ('nutrition_diary_items', 'quantity')
        )
      ORDER BY table_name, column_name
    `);
    assert.deepEqual(typedColumns.rows, [
      { table_name: 'calendar_events', column_name: 'all_day', data_type: 'boolean' },
      { table_name: 'calendar_events', column_name: 'start_date', data_type: 'date' },
      { table_name: 'calendar_events', column_name: 'starts_at', data_type: 'timestamp with time zone' },
      { table_name: 'calendar_tasks', column_name: 'due_at', data_type: 'timestamp with time zone' },
      { table_name: 'calendar_tasks', column_name: 'due_date', data_type: 'date' },
      { table_name: 'nutrition_diary_entries', column_name: 'logged_at', data_type: 'timestamp with time zone' },
      { table_name: 'nutrition_diary_items', column_name: 'quantity', data_type: 'numeric' },
      { table_name: 'nutrition_foods', column_name: 'calories_per_100g', data_type: 'numeric' },
      { table_name: 'workout_exercises', column_name: 'is_preset', data_type: 'boolean' },
      { table_name: 'workout_sets', column_name: 'weight', data_type: 'numeric' },
    ]);

    await client.query("SET TIME ZONE 'UTC'");
    await seedCalendarBase(client);
    await client.query(`
      INSERT INTO calendar_events (owner_id, id, calendar_id, title, notes, location, timezone, starts_at, ends_at, all_day, start_date, end_date, created_at, updated_at)
      VALUES ($1, 'event-1', 'cal-1', 'Event', '', '', 'America/Chicago', '2026-07-04T09:30:00-05:00', '2026-07-04T10:30:00-05:00', true, '2026-07-04', '2026-07-04', now(), now())
    `, [ownerA]);
    const event = await client.query<{ starts_at: string; start_date: string; all_day: boolean }>(`
      SELECT starts_at::text AS starts_at, to_char(start_date, 'YYYY-MM-DD') AS start_date, all_day
      FROM calendar_events
      WHERE owner_id = $1 AND id = 'event-1'
    `, [ownerA]);
    assert.equal(event.rows[0].starts_at, '2026-07-04 14:30:00+00');
    assert.equal(event.rows[0].start_date, '2026-07-04');
    assert.equal(event.rows[0].all_day, true);

    await seedWorkoutBase(client);
    await client.query(`
      INSERT INTO workout_session_exercises (owner_id, id, session_id, exercise_id, order_index, notes)
      VALUES ($1, 'session-exercise-1', 'session-1', 'exercise-1', 0, '')
    `, [ownerA]);
    await client.query(`
      INSERT INTO workout_sets (owner_id, id, session_exercise_id, set_index, rir, reps, weight, completed)
      VALUES ($1, 'set-1', 'session-exercise-1', 0, 1.125, 8.500, 225.125, true)
    `, [ownerA]);
    await seedNutritionFood(client);
    await client.query(`
      INSERT INTO nutrition_goals (owner_id, calories_target, protein_target_g, carbs_target_g, fat_target_g, updated_at)
      VALUES ($1, 2200.1250, 160.2500, 220.5000, 70.7500, now())
    `, [ownerA]);
    const numericValues = await client.query(`
      SELECT
        (SELECT weight::text FROM workout_sets WHERE owner_id = $1 AND id = 'set-1') AS weight,
        (SELECT calories_per_100g::text FROM nutrition_foods WHERE owner_id = $1 AND id = 'food-1') AS calories,
        (SELECT protein_target_g::text FROM nutrition_goals WHERE owner_id = $1) AS protein_target
    `, [ownerA]);
    assert.deepEqual(numericValues.rows[0], {
      weight: '225.125',
      calories: '59.1250',
      protein_target: '160.2500',
    });
  });
});

migrationTest('creates owner-prefixed indexes for repository access patterns', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);

    const indexes = await client.query<{ indexname: string; indexdef: string }>(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])
      ORDER BY indexname
    `, [expectedIndexes]);

    assert.deepEqual(indexes.rows.map((row) => row.indexname), [...expectedIndexes].sort());
    for (const row of indexes.rows) {
      assert.match(row.indexdef, /owner_id/);
    }
    assert.match(indexes.rows.find((row) => row.indexname === 'idx_docs_versions_owner_document_created')?.indexdef ?? '', /created_at DESC, id DESC/);
    assert.match(indexes.rows.find((row) => row.indexname === 'idx_docs_tabs_owner_document_id')?.indexdef ?? '', /tab_order, id/);
  });
});

migrationTest('enables RLS with authenticated owner policies and denies anonymous table access', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);

    const rls = await client.query<{ relname: string; relrowsecurity: boolean }>(`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname = ANY($1::text[])
    `, [ownerTables]);

    assert.equal(rls.rows.length, ownerTables.length);
    assert.equal(rls.rows.every((row) => row.relrowsecurity), true);

    const policies = await client.query<{ tablename: string; roles: string; qual: string; with_check: string }>(`
      SELECT tablename, array_to_string(roles, ',') AS roles, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
      ORDER BY tablename
    `, [ownerTables]);

    assert.equal(policies.rows.length, ownerTables.length);
    for (const policy of policies.rows) {
      assert.equal(policy.roles, 'authenticated');
      assert.equal(policy.qual, '(owner_id = auth.uid())');
      assert.equal(policy.with_check, '(owner_id = auth.uid())');
    }

    await client.query('INSERT INTO app_settings (owner_id, key, value_json) VALUES ($1, $2, $3)', [ownerA, 'private', { ok: true }]);
    await client.query('INSERT INTO app_settings (owner_id, key, value_json) VALUES ($1, $2, $3)', [ownerB, 'private', { ok: false }]);
    await client.query(`
      INSERT INTO workout_exercises (owner_id, id, name, category, equipment, is_preset, created_at, updated_at)
      VALUES ($1, 'exercise-a', 'Owner A Squat', 'Legs', 'Barbell', false, now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO workout_exercises (owner_id, id, name, category, equipment, is_preset, created_at, updated_at)
      VALUES ($1, 'exercise-b', 'Owner B Squat', 'Legs', 'Barbell', false, now(), now())
    `, [ownerB]);

    await client.query('BEGIN');
    try {
      await client.query('SELECT set_config($1, $2, true)', ['request.jwt.claim.sub', ownerA]);
      await client.query('SET LOCAL ROLE authenticated');
      const visible = await client.query('SELECT owner_id, key FROM app_settings ORDER BY owner_id');
      assert.deepEqual(visible.rows, [{ owner_id: ownerA, key: 'private' }]);
      const featureVisible = await client.query('SELECT owner_id, name FROM workout_exercises ORDER BY owner_id');
      assert.deepEqual(featureVisible.rows, [{ owner_id: ownerA, name: 'Owner A Squat' }]);
    } finally {
      await client.query('ROLLBACK');
    }

    await client.query('BEGIN');
    try {
      await client.query('SET LOCAL ROLE anon');
      await expectRejected(client, 'SELECT * FROM app_settings');
      await expectRejected(client, 'SELECT * FROM workout_exercises');
    } finally {
      await client.query('ROLLBACK');
    }
  });
});
