import type BetterSqlite3 from 'better-sqlite3';
import { getCanonicalOwnerId } from '../ownership';
import { getDatabase } from './database';

export function createAppSettingsRepository(
  database: BetterSqlite3.Database = getDatabase(),
  ownerId = getCanonicalOwnerId(),
) {
  const selectSettingStatement = database.prepare('SELECT value_json FROM app_settings WHERE owner_id = ? AND key = ?');
  const upsertSettingStatement = database.prepare(`
    INSERT INTO app_settings (owner_id, key, value_json)
    VALUES (?, ?, ?)
    ON CONFLICT(owner_id, key) DO UPDATE SET value_json = excluded.value_json
  `);

  return {
    readJsonSetting<T>(key: string, parse: (value: unknown, field?: string) => T, fallback: T) {
      const row = selectSettingStatement.get(ownerId, key) as { value_json: string } | undefined;
      if (!row) {
        return fallback;
      }

      return parse(JSON.parse(row.value_json), `Stored setting "${key}"`);
    },
    writeJsonSetting(key: string, value: unknown) {
      upsertSettingStatement.run(ownerId, key, JSON.stringify(value));
    },
  };
}

let appSettingsRepositorySingleton: ReturnType<typeof createAppSettingsRepository> | null = null;

function getAppSettingsRepositorySingleton() {
  appSettingsRepositorySingleton ??= createAppSettingsRepository();
  return appSettingsRepositorySingleton;
}

export const appSettingsRepository = new Proxy({} as ReturnType<typeof createAppSettingsRepository>, {
  get(_target, property, receiver) {
    return Reflect.get(getAppSettingsRepositorySingleton(), property, receiver);
  },
});
