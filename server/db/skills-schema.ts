import type BetterSqlite3 from 'better-sqlite3';
import { canonicalOwnerId } from '../ownership';
import { normalizeOwnerIds, recreateTable, tableHasColumn } from './schema-utils';

const skillsTableSql = `
  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    instructions TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    compatible_modes_json TEXT NOT NULL DEFAULT 'null',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(owner_id, name)
  );
`;

export function ensureSkillsSchema(database: BetterSqlite3.Database) {
  if (!tableHasColumn(database, 'skills', 'owner_id')) {
    recreateTable(database, 'skills', skillsTableSql, (legacyTableName) => `
      INSERT INTO skills (id, owner_id, name, description, instructions, enabled, compatible_modes_json, metadata_json, created_at, updated_at)
      SELECT id, '${canonicalOwnerId}', name, description, instructions, enabled, compatible_modes_json, metadata_json, created_at, updated_at
      FROM "${legacyTableName}"
    `);
  }

  database.exec(`
    ${skillsTableSql}

    CREATE INDEX IF NOT EXISTS idx_skills_owner_name ON skills(owner_id, name);
    CREATE INDEX IF NOT EXISTS idx_skills_owner_enabled ON skills(owner_id, enabled);
    CREATE INDEX IF NOT EXISTS idx_skills_owner_updated_at ON skills(owner_id, updated_at DESC, id DESC);
  `);

  normalizeOwnerIds(database, 'skills');
}
