import type BetterSqlite3 from 'better-sqlite3';
import { canonicalOwnerId, legacyOwnerIds } from '../ownership';

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function tableExists(database: BetterSqlite3.Database, tableName: string) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
}

export function tableHasColumn(database: BetterSqlite3.Database, tableName: string, columnName: string) {
  return (database.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all() as Array<{ name: string }>).some((column) => column.name === columnName);
}

export function recreateTable(
  database: BetterSqlite3.Database,
  tableName: string,
  createTableSql: string,
  copySql: (legacyTableName: string) => string,
) {
  if (!tableExists(database, tableName)) {
    database.exec(createTableSql);
    return;
  }

  const legacyTableName = `${tableName}__legacy_owner_migration`;
  const hadForeignKeysEnabled = Number(database.pragma('foreign_keys', { simple: true })) === 1;
  if (hadForeignKeysEnabled) {
    database.pragma('foreign_keys = OFF');
  }

  try {
    database.transaction(() => {
      database.prepare(`DROP TABLE IF EXISTS ${quoteIdentifier(legacyTableName)}`).run();
      database.prepare(`ALTER TABLE ${quoteIdentifier(tableName)} RENAME TO ${quoteIdentifier(legacyTableName)}`).run();
      database.exec(createTableSql);
      database.exec(copySql(legacyTableName));
      database.prepare(`DROP TABLE ${quoteIdentifier(legacyTableName)}`).run();
    })();
  } finally {
    if (hadForeignKeysEnabled) {
      database.pragma('foreign_keys = ON');
    }
  }
}

export function normalizeOwnerIds(database: BetterSqlite3.Database, tableName: string, ownerColumn = 'owner_id') {
  if (!tableExists(database, tableName) || !tableHasColumn(database, tableName, ownerColumn)) {
    return;
  }

  const legacyPlaceholders = legacyOwnerIds.map(() => '?').join(', ');
  database.prepare(`
    UPDATE ${quoteIdentifier(tableName)}
    SET ${quoteIdentifier(ownerColumn)} = ?
    WHERE ${quoteIdentifier(ownerColumn)} IS NULL
      OR ${quoteIdentifier(ownerColumn)} IN (${legacyPlaceholders})
  `).run(canonicalOwnerId, ...legacyOwnerIds);
}
