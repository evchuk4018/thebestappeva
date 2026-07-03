import type BetterSqlite3 from 'better-sqlite3';
import { canonicalOwnerId } from '../ownership';
import { ensureAutomationsSchema } from './automations-schema';
import { ensureCalendarSchema } from './calendar-schema';
import { ensureDocsSchema } from './docs-schema';
import { ensureNutritionSchema } from './nutrition-schema';
import { normalizeOwnerIds, recreateTable, tableHasColumn } from './schema-utils';
import { ensureSkillsSchema } from './skills-schema';
import { ensureWorkoutSchema } from './workout-schema';

const appSettingsTableSql = `
  CREATE TABLE IF NOT EXISTS app_settings (
    owner_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value_json TEXT NOT NULL,
    PRIMARY KEY (owner_id, key)
  );
`;

const aiChatsTableSql = `
  CREATE TABLE IF NOT EXISTS ai_chats (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    mode TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );
`;

const aiArtifactsTableSql = `
  CREATE TABLE IF NOT EXISTS ai_artifacts (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
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
`;

const aiArtifactVersionsTableSql = `
  CREATE TABLE IF NOT EXISTS ai_artifact_versions (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
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
    created_at TEXT NOT NULL,
    FOREIGN KEY (artifact_id) REFERENCES ai_artifacts(id) ON DELETE CASCADE
  );
`;

function ensureCoreSchemaMigrations(database: BetterSqlite3.Database) {
  if (!tableHasColumn(database, 'app_settings', 'owner_id')) {
    recreateTable(database, 'app_settings', appSettingsTableSql, (legacyTableName) => `
      INSERT INTO app_settings (owner_id, key, value_json)
      SELECT '${canonicalOwnerId}', key, value_json
      FROM "${legacyTableName}"
    `);
  }

  if (!tableHasColumn(database, 'ai_chats', 'owner_id')) {
    recreateTable(database, 'ai_chats', aiChatsTableSql, (legacyTableName) => `
      INSERT INTO ai_chats (id, owner_id, title, mode, updated_at, payload_json)
      SELECT id, '${canonicalOwnerId}', title, mode, updated_at, payload_json
      FROM "${legacyTableName}"
    `);
  }

  if (!tableHasColumn(database, 'ai_artifacts', 'owner_id')) {
    recreateTable(database, 'ai_artifacts', aiArtifactsTableSql, (legacyTableName) => `
      INSERT INTO ai_artifacts (id, owner_id, chat_id, title, type, schema_version, content_markdown, context_policy_json, citations_json, linked_doc_id, last_exported_at, created_at, updated_at)
      SELECT id, '${canonicalOwnerId}', chat_id, title, type, schema_version, content_markdown, context_policy_json, citations_json, linked_doc_id, last_exported_at, created_at, updated_at
      FROM "${legacyTableName}"
    `);
  }

  if (!tableHasColumn(database, 'ai_artifact_versions', 'owner_id')) {
    recreateTable(database, 'ai_artifact_versions', aiArtifactVersionsTableSql, (legacyTableName) => `
      INSERT INTO ai_artifact_versions (id, owner_id, artifact_id, title, type, content_markdown, context_policy_json, citations_json, linked_doc_id, last_exported_at, actor, reason, created_at)
      SELECT legacy.id, artifact.owner_id, legacy.artifact_id, legacy.title, legacy.type, legacy.content_markdown, legacy.context_policy_json, legacy.citations_json, legacy.linked_doc_id, legacy.last_exported_at, legacy.actor, legacy.reason, legacy.created_at
      FROM "${legacyTableName}" legacy
      JOIN ai_artifacts artifact ON artifact.id = legacy.artifact_id
    `);
  }
}

export function ensureDatabaseSchema(database: BetterSqlite3.Database) {
  ensureCoreSchemaMigrations(database);
  database.exec(`
    ${appSettingsTableSql}
    ${aiChatsTableSql}
    ${aiArtifactsTableSql}
    ${aiArtifactVersionsTableSql}

    CREATE INDEX IF NOT EXISTS idx_ai_chats_owner_updated ON ai_chats(owner_id, updated_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_artifacts_owner_chat_updated ON ai_artifacts(owner_id, chat_id, updated_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_artifact_versions_owner_artifact_created ON ai_artifact_versions(owner_id, artifact_id, created_at DESC, id DESC);
  `);

  normalizeOwnerIds(database, 'app_settings');
  normalizeOwnerIds(database, 'ai_chats');
  normalizeOwnerIds(database, 'ai_artifacts');
  normalizeOwnerIds(database, 'ai_artifact_versions');

  ensureDocsSchema(database);
  ensureSkillsSchema(database);
  ensureAutomationsSchema(database);
  ensureCalendarSchema(database);
  ensureWorkoutSchema(database);
  ensureNutritionSchema(database);
}
