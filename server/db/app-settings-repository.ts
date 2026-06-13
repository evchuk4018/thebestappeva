import type BetterSqlite3 from 'better-sqlite3';
import { getDatabase } from './database';

function selectSettingStatement(database: BetterSqlite3.Database) {
  return database.prepare('SELECT value_json FROM app_settings WHERE key = ?');
}

function upsertSettingStatement(database: BetterSqlite3.Database) {
  return database.prepare(`
    INSERT INTO app_settings (key, value_json)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
  `);
}

export function readJsonSetting<T>(
  database: BetterSqlite3.Database | string,
  keyOrParse: string | ((value: unknown, field?: string) => T),
  parseOrFallback: ((value: unknown, field?: string) => T) | T,
  fallbackMaybe?: T,
) {
  const databaseHandle = typeof database === 'string' ? getDatabase() : database;
  const key = typeof database === 'string' ? database : (keyOrParse as string);
  const parse = (typeof database === 'string' ? keyOrParse : parseOrFallback) as (value: unknown, field?: string) => T;
  const fallback = (typeof database === 'string' ? parseOrFallback : fallbackMaybe) as T;
  const row = selectSettingStatement(databaseHandle).get(key) as { value_json: string } | undefined;
  if (!row) {
    return fallback;
  }

  return parse(JSON.parse(row.value_json), `Stored setting "${key}"`);
}

export function writeJsonSetting(database: BetterSqlite3.Database | string, keyOrValue: string | unknown, maybeValue?: unknown) {
  const databaseHandle = typeof database === 'string' ? getDatabase() : database;
  const key = typeof database === 'string' ? database : (keyOrValue as string);
  const value = typeof database === 'string' ? keyOrValue : maybeValue;
  upsertSettingStatement(databaseHandle).run(key, JSON.stringify(value));
}
