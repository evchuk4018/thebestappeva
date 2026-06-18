import type BetterSqlite3 from 'better-sqlite3';

export function ensureSkillsSchema(database: BetterSqlite3.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS skills (
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

    CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
    CREATE INDEX IF NOT EXISTS idx_skills_enabled ON skills(enabled);
    CREATE INDEX IF NOT EXISTS idx_skills_updated_at ON skills(updated_at);
  `);
}