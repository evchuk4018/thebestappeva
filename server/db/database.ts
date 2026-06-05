import fs from 'node:fs';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { serverConfig } from '../config';
import { ensureDatabaseSchema } from './schema';

let database: BetterSqlite3.Database | null = null;

export function getDatabase() {
  if (database) {
    return database;
  }

  fs.mkdirSync(path.dirname(serverConfig.localDbPath), { recursive: true });
  database = new BetterSqlite3(serverConfig.localDbPath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  ensureDatabaseSchema(database);
  return database;
}
