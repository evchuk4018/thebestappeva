import type BetterSqlite3 from 'better-sqlite3';
import { canonicalOwnerId } from '../ownership';
import { normalizeOwnerIds, recreateTable, tableHasColumn } from './schema-utils';

const automationsTableSql = `
  CREATE TABLE IF NOT EXISTS automations (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
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
    updated_at TEXT NOT NULL,
    UNIQUE(owner_id, name)
  );
`;

export function ensureAutomationsSchema(database: BetterSqlite3.Database) {
  if (!tableHasColumn(database, 'automations', 'owner_id')) {
    recreateTable(database, 'automations', automationsTableSql, (legacyTableName) => `
      INSERT INTO automations (id, owner_id, name, description, kind, trigger_json, action_json, enabled, next_run_at, last_triggered_at, last_completed_at, last_run_status, last_run_summary, last_error, last_chat_id, created_at, updated_at)
      SELECT id, '${canonicalOwnerId}', name, description, kind, trigger_json, action_json, enabled, next_run_at, last_triggered_at, last_completed_at, last_run_status, last_run_summary, last_error, last_chat_id, created_at, updated_at
      FROM "${legacyTableName}"
    `);
  }

  database.exec(`
    ${automationsTableSql}

    CREATE INDEX IF NOT EXISTS idx_automations_owner_name ON automations(owner_id, name);
    CREATE INDEX IF NOT EXISTS idx_automations_owner_enabled ON automations(owner_id, enabled);
    CREATE INDEX IF NOT EXISTS idx_automations_owner_due ON automations(owner_id, kind, enabled, next_run_at);
  `);

  normalizeOwnerIds(database, 'automations');
}
