import { getDatabase } from './database';

const selectSettingStatement = () =>
  getDatabase().prepare('SELECT value_json FROM app_settings WHERE key = ?');

const upsertSettingStatement = () =>
  getDatabase().prepare(`
    INSERT INTO app_settings (key, value_json)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
  `);

export function readJsonSetting<T>(key: string, parse: (value: unknown, field?: string) => T, fallback: T) {
  const row = selectSettingStatement().get(key) as { value_json: string } | undefined;
  if (!row) {
    return fallback;
  }

  return parse(JSON.parse(row.value_json), `Stored setting "${key}"`);
}

export function writeJsonSetting(key: string, value: unknown) {
  upsertSettingStatement().run(key, JSON.stringify(value));
}
