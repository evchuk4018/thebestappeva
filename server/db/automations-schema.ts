import type BetterSqlite3 from 'better-sqlite3';

export function ensureAutomationsSchema(database: BetterSqlite3.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS automations (
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

    CREATE INDEX IF NOT EXISTS idx_automations_name ON automations(name);
    CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(enabled);
    CREATE INDEX IF NOT EXISTS idx_automations_due ON automations(kind, enabled, next_run_at);
  `);
}
