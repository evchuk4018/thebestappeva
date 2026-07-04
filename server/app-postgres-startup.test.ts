import assert from 'node:assert/strict';
import test from 'node:test';
import { validateServerStartupConfig } from './startup';

const authConfig = {
  ownerEmail: 'owner@example.com',
  supabaseAnonKey: 'anon-key',
  supabaseUrl: 'https://supabase.test',
};

test('fails development startup validation when DATABASE_URL is missing', () => {
  assert.throws(
    () => validateServerStartupConfig({
      authConfig,
      environment: 'development',
      postgresConfig: { databaseUrl: '' },
    }),
    /Missing required Postgres configuration: DATABASE_URL\./,
  );
});

test('fails production startup validation when DATABASE_URL is missing', () => {
  assert.throws(
    () => validateServerStartupConfig({
      authConfig,
      environment: 'production',
      postgresConfig: { databaseUrl: '' },
    }),
    /Missing required Postgres configuration: DATABASE_URL\./,
  );
});

test('accepts production startup validation when Postgres and auth config are present', () => {
  const result = validateServerStartupConfig({
    authConfig,
    environment: 'production',
    postgresConfig: { databaseUrl: 'postgresql://app:password@db.example.com:5432/thebestappeva' },
  });

  assert.equal(result.postgres.connectionSource, 'DATABASE_URL');
  assert.equal(result.auth.ownerEmail, 'owner@example.com');
});
