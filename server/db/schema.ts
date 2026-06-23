import type BetterSqlite3 from 'better-sqlite3';
import { ensureAutomationsSchema } from './automations-schema';
import { ensureCalendarSchema } from './calendar-schema';
import { ensureDocsSchema } from './docs-schema';
import { ensureSkillsSchema } from './skills-schema';

export function ensureDatabaseSchema(database: BetterSqlite3.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      mode TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_artifacts (
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

    CREATE TABLE IF NOT EXISTS ai_artifact_versions (
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
      created_at TEXT NOT NULL,
      FOREIGN KEY (artifact_id) REFERENCES ai_artifacts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ai_artifacts_chat_updated ON ai_artifacts(chat_id, updated_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_artifact_versions_artifact_created ON ai_artifact_versions(artifact_id, created_at DESC, id DESC);
  `);

  ensureDocsSchema(database);
  ensureSkillsSchema(database);
  ensureAutomationsSchema(database);
  ensureCalendarSchema(database);
}
