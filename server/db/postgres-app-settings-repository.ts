import { getPostgresPool } from './postgres';
import { assertOwnerUuid, normalizeJsonb, toJsonbParam, type PostgresExecutor } from './postgres-repository-utils';

export function createPostgresAppSettingsRepository(
  ownerId: string,
  executor: PostgresExecutor = getPostgresPool(),
) {
  const validatedOwnerId = assertOwnerUuid(ownerId);

  return {
    async readJsonSetting<T>(key: string, parse: (value: unknown, field?: string) => T, fallback: T) {
      const result = await executor.query('SELECT value_json FROM app_settings WHERE owner_id = $1 AND key = $2', [validatedOwnerId, key]);
      const row = result.rows[0] as { value_json: unknown } | undefined;
      if (!row) {
        return fallback;
      }

      return parse(normalizeJsonb(row.value_json), `Stored setting "${key}"`);
    },
    async writeJsonSetting(key: string, value: unknown) {
      await executor.query(`
        INSERT INTO app_settings (owner_id, key, value_json)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT(owner_id, key) DO UPDATE SET value_json = excluded.value_json
      `, [validatedOwnerId, key, toJsonbParam(value)]);
    },
  };
}
