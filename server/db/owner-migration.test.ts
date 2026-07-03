import assert from 'node:assert/strict';
import test from 'node:test';
import BetterSqlite3 from 'better-sqlite3';
import { canonicalOwnerId } from '../ownership';
import { ensureDatabaseSchema } from './schema';

function hasColumn(database: BetterSqlite3.Database, tableName: string, columnName: string) {
  return (database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).some((column) => column.name === columnName);
}

test('ensureDatabaseSchema backfills canonical owner IDs across legacy tables idempotently', () => {
  const database = new BetterSqlite3(':memory:');
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
    CREATE TABLE ai_chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      mode TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE ai_artifacts (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      content_markdown TEXT NOT NULL,
      context_policy_json TEXT NOT NULL,
      citations_json TEXT NOT NULL,
      linked_doc_id TEXT,
      last_exported_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE ai_artifact_versions (
      id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      context_policy_json TEXT NOT NULL,
      citations_json TEXT NOT NULL,
      linked_doc_id TEXT,
      last_exported_at TEXT,
      actor TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE docs_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_opened_at TEXT NOT NULL,
      starred INTEGER NOT NULL,
      trashed_at TEXT,
      template_id TEXT NOT NULL,
      active_tab_id TEXT NOT NULL,
      layout_mode TEXT NOT NULL,
      zoom REAL NOT NULL,
      page_settings_json TEXT NOT NULL
    );
    CREATE TABLE docs_tabs (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      parent_tab_id TEXT,
      title TEXT NOT NULL,
      tab_order INTEGER NOT NULL,
      outline_visible INTEGER NOT NULL,
      content TEXT NOT NULL,
      content_format TEXT NOT NULL,
      text_content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE docs_versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      tab_id TEXT,
      created_at TEXT NOT NULL,
      label TEXT NOT NULL,
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      content_format TEXT NOT NULL,
      snapshot_title TEXT NOT NULL
    );
    CREATE TABLE docs_citations (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      label TEXT NOT NULL,
      details TEXT NOT NULL
    );
    CREATE TABLE docs_migration_sources (
      source_key TEXT PRIMARY KEY,
      imported_at TEXT NOT NULL
    );
    CREATE TABLE skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      instructions TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      compatible_modes_json TEXT NOT NULL DEFAULT 'null',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE automations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      kind TEXT NOT NULL,
      trigger_json TEXT NOT NULL,
      action_json TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      next_run_at TEXT,
      last_triggered_at TEXT,
      last_completed_at TEXT,
      last_run_status TEXT NOT NULL DEFAULT 'idle',
      last_run_summary TEXT,
      last_error TEXT,
      last_chat_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE calendar_settings (
      owner_id TEXT PRIMARY KEY,
      timezone TEXT NOT NULL,
      week_start TEXT NOT NULL,
      hour_cycle TEXT NOT NULL,
      working_hours_start TEXT NOT NULL,
      working_hours_end TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE workout_exercises (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      equipment TEXT NOT NULL,
      is_preset INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(owner_id, name)
    );
    CREATE TABLE workout_routines (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT
    );
    CREATE TABLE workout_routine_exercises (
      id TEXT PRIMARY KEY,
      routine_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      target_sets INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE workout_sessions (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      routine_id TEXT,
      name TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE workout_session_exercises (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      notes TEXT NOT NULL
    );
    CREATE TABLE workout_sets (
      id TEXT PRIMARY KEY,
      session_exercise_id TEXT NOT NULL,
      set_index INTEGER NOT NULL,
      rir REAL,
      reps REAL,
      weight REAL,
      completed INTEGER NOT NULL
    );
    CREATE TABLE nutrition_foods (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      name TEXT NOT NULL,
      brand_name TEXT,
      barcode_text TEXT,
      servings_json TEXT NOT NULL,
      calories_per_100g REAL NOT NULL,
      protein_g_per_100g REAL NOT NULL,
      carbs_g_per_100g REAL NOT NULL,
      fat_g_per_100g REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(owner_id, source_type, name, brand_name)
    );
    CREATE TABLE nutrition_recipes (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      note TEXT NOT NULL,
      servings REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE nutrition_recipe_ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      food_id TEXT NOT NULL,
      amount_g REAL NOT NULL,
      order_index INTEGER NOT NULL
    );
    CREATE TABLE nutrition_diary_entries (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      logged_at TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE nutrition_diary_items (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      amount_g REAL NOT NULL,
      serving_id TEXT,
      serving_label TEXT
    );
    CREATE TABLE nutrition_goals (
      owner_id TEXT PRIMARY KEY,
      calories_target REAL NOT NULL,
      protein_target_g REAL NOT NULL,
      carbs_target_g REAL NOT NULL,
      fat_target_g REAL NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.prepare('INSERT INTO app_settings (key, value_json) VALUES (?, ?)').run('ai.selected-provider', JSON.stringify({ selectedProvider: 'ollama' }));
  database.prepare('INSERT INTO ai_chats (id, title, mode, updated_at, payload_json) VALUES (?, ?, ?, ?, ?)').run('chat-1', 'Chat', 'thinking', '2026-06-24T12:00:00.000Z', '{"id":"chat-1","title":"Chat","titleStatus":"done","messages":[],"activeArtifactId":null,"includedArtifactIds":[],"mode":"thinking","updatedAt":"2026-06-24T12:00:00.000Z"}');
  database.prepare('INSERT INTO ai_artifacts (id, chat_id, title, type, schema_version, content_markdown, context_policy_json, citations_json, linked_doc_id, last_exported_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)').run('artifact-1', 'chat-1', 'Artifact', 'markdown', 1, 'Alpha', '{}', '[]', '2026-06-24T12:00:00.000Z', '2026-06-24T12:00:00.000Z');
  database.prepare('INSERT INTO ai_artifact_versions (id, artifact_id, title, type, content_markdown, context_policy_json, citations_json, linked_doc_id, last_exported_at, actor, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)').run('artifact-version-1', 'artifact-1', 'Artifact', 'markdown', 'Alpha', '{}', '[]', 'assistant', 'Initial', '2026-06-24T12:00:00.000Z');
  database.prepare('INSERT INTO docs_documents (id, title, created_at, updated_at, last_opened_at, starred, trashed_at, template_id, active_tab_id, layout_mode, zoom, page_settings_json) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)').run('doc-1', 'Doc', '2026-06-24T12:00:00.000Z', '2026-06-24T12:00:00.000Z', '2026-06-24T12:00:00.000Z', 0, 'blank', 'tab-1', 'pages', 100, '{}');
  database.prepare('INSERT INTO docs_tabs (id, document_id, parent_tab_id, title, tab_order, outline_visible, content, content_format, text_content, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)').run('tab-1', 'doc-1', 'Main', 0, 1, '<p>Doc</p>', 'html', 'Doc', '2026-06-24T12:00:00.000Z', '2026-06-24T12:00:00.000Z');
  database.prepare('INSERT INTO docs_versions (id, document_id, tab_id, created_at, label, kind, content, content_format, snapshot_title) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('version-1', 'doc-1', 'tab-1', '2026-06-24T12:00:00.000Z', 'Imported', 'import', '<p>Doc</p>', 'html', 'Doc');
  database.prepare('INSERT INTO docs_citations (id, document_id, label, details) VALUES (?, ?, ?, ?)').run('citation-1', 'doc-1', 'Source', 'Details');
  database.prepare('INSERT INTO docs_migration_sources (source_key, imported_at) VALUES (?, ?)').run('legacy-browser', '2026-06-24T12:00:00.000Z');
  database.prepare('INSERT INTO skills (id, name, description, instructions, enabled, compatible_modes_json, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('skill-1', 'writer', 'desc', 'inst', 1, 'null', '{}', '2026-06-24T12:00:00.000Z', '2026-06-24T12:00:00.000Z');
  database.prepare('INSERT INTO automations (id, name, description, kind, trigger_json, action_json, enabled, next_run_at, last_triggered_at, last_completed_at, last_run_status, last_run_summary, last_error, last_chat_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, NULL, NULL, ?, ?)').run('automation-1', 'daily-recap', 'desc', 'conversation', '{}', '{}', 1, 'idle', '2026-06-24T12:00:00.000Z', '2026-06-24T12:00:00.000Z');
  database.prepare('INSERT INTO calendar_settings (owner_id, timezone, week_start, hour_cycle, working_hours_start, working_hours_end, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('local-user', 'UTC', 'sun', '12', '09:00', '17:00', '2026-06-24T12:00:00.000Z');
  database.prepare('INSERT INTO workout_exercises (id, owner_id, name, category, equipment, is_preset, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('ex-1', 'local-user', 'Bench', 'Push', 'Barbell', 0, '2026-06-24T12:00:00.000Z', '2026-06-24T12:00:00.000Z');
  database.prepare('INSERT INTO workout_routines (id, owner_id, name, created_at, updated_at, archived_at) VALUES (?, ?, ?, ?, ?, NULL)').run('routine-1', 'local-user', 'Push Day', '2026-06-24T12:00:00.000Z', '2026-06-24T12:00:00.000Z');
  database.prepare('INSERT INTO workout_routine_exercises (id, routine_id, exercise_id, order_index, target_sets, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('rex-1', 'routine-1', 'ex-1', 0, 3, '2026-06-24T12:00:00.000Z');
  database.prepare('INSERT INTO workout_sessions (id, owner_id, routine_id, name, started_at, finished_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('session-1', 'local-user', 'routine-1', 'Push Day', '2026-06-24T10:00:00.000Z', '2026-06-24T11:00:00.000Z', '2026-06-24T11:00:00.000Z');
  database.prepare('INSERT INTO workout_session_exercises (id, session_id, exercise_id, order_index, notes) VALUES (?, ?, ?, ?, ?)').run('sex-1', 'session-1', 'ex-1', 0, 'note');
  database.prepare('INSERT INTO workout_sets (id, session_exercise_id, set_index, rir, reps, weight, completed) VALUES (?, ?, ?, ?, ?, ?, ?)').run('set-1', 'sex-1', 0, 2, 8, 185, 1);
  database.prepare('INSERT INTO nutrition_foods (id, owner_id, source_type, name, brand_name, barcode_text, servings_json, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)').run('food-1', 'local-user', 'brand', 'Yogurt', '[]', 100, 10, 10, 5, '2026-06-24T12:00:00.000Z', '2026-06-24T12:00:00.000Z');
  database.prepare('INSERT INTO nutrition_recipes (id, owner_id, name, note, servings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('recipe-1', 'local-user', 'Bowl', '', 1, '2026-06-24T12:00:00.000Z', '2026-06-24T12:00:00.000Z');
  database.prepare('INSERT INTO nutrition_recipe_ingredients (id, recipe_id, food_id, amount_g, order_index) VALUES (?, ?, ?, ?, ?)').run('ingredient-1', 'recipe-1', 'food-1', 100, 0);
  database.prepare('INSERT INTO nutrition_diary_entries (id, owner_id, logged_at, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run('entry-1', 'local-user', '2026-06-24T08:00:00.000Z', 'Breakfast', '2026-06-24T08:00:00.000Z', '2026-06-24T08:00:00.000Z');
  database.prepare('INSERT INTO nutrition_diary_items (id, entry_id, item_type, item_id, quantity, unit, amount_g, serving_id, serving_label) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)').run('item-1', 'entry-1', 'food', 'food-1', 100, 'gram', 100);
  database.prepare('INSERT INTO nutrition_goals (owner_id, calories_target, protein_target_g, carbs_target_g, fat_target_g, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run('local-user', 2200, 160, 220, 70, '2026-06-24T12:00:00.000Z');

  ensureDatabaseSchema(database);
  ensureDatabaseSchema(database);

  assert.equal(hasColumn(database, 'app_settings', 'owner_id'), true);
  assert.equal(hasColumn(database, 'ai_chats', 'owner_id'), true);
  assert.equal(hasColumn(database, 'ai_artifacts', 'owner_id'), true);
  assert.equal(hasColumn(database, 'ai_artifact_versions', 'owner_id'), true);
  assert.equal(hasColumn(database, 'docs_tabs', 'owner_id'), true);
  assert.equal(hasColumn(database, 'docs_versions', 'owner_id'), true);
  assert.equal(hasColumn(database, 'docs_citations', 'owner_id'), true);
  assert.equal(hasColumn(database, 'workout_sets', 'owner_id'), true);
  assert.equal(hasColumn(database, 'nutrition_diary_items', 'owner_id'), true);

  assert.equal((database.prepare('SELECT owner_id FROM app_settings WHERE key = ?').get('ai.selected-provider') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM ai_chats WHERE id = ?').get('chat-1') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM ai_artifacts WHERE id = ?').get('artifact-1') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM ai_artifact_versions WHERE id = ?').get('artifact-version-1') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM docs_documents WHERE id = ?').get('doc-1') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM docs_tabs WHERE id = ?').get('tab-1') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM docs_versions WHERE id = ?').get('version-1') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM docs_citations WHERE id = ?').get('citation-1') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM docs_migration_sources WHERE source_key = ?').get('legacy-browser') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM skills WHERE id = ?').get('skill-1') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM automations WHERE id = ?').get('automation-1') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM calendar_settings').get() as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM workout_exercises WHERE id = ?').get('ex-1') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM workout_routine_exercises WHERE id = ?').get('rex-1') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM workout_session_exercises WHERE id = ?').get('sex-1') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM workout_sets WHERE id = ?').get('set-1') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM nutrition_foods WHERE id = ?').get('food-1') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM nutrition_recipe_ingredients WHERE id = ?').get('ingredient-1') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM nutrition_diary_items WHERE id = ?').get('item-1') as { owner_id: string }).owner_id, canonicalOwnerId);
  assert.equal((database.prepare('SELECT owner_id FROM nutrition_goals').get() as { owner_id: string }).owner_id, canonicalOwnerId);

  assert.equal((database.prepare('SELECT COUNT(*) AS count FROM docs_tabs').get() as { count: number }).count, 1);
  assert.equal((database.prepare('SELECT COUNT(*) AS count FROM ai_artifact_versions').get() as { count: number }).count, 1);
  assert.equal((database.prepare('SELECT COUNT(*) AS count FROM workout_sets').get() as { count: number }).count, 1);
  assert.equal((database.prepare('SELECT COUNT(*) AS count FROM nutrition_diary_items').get() as { count: number }).count, 1);
});
