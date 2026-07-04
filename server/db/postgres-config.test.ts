import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSafePostgresTestDatabase, resolvePostgresConfig } from './postgres-config';

test('requires DATABASE_URL even when a test database URL is provided', () => {
  assert.throws(
    () => resolvePostgresConfig({ databaseUrl: '', postgresTestDatabaseUrl: 'postgresql://app:password@127.0.0.1:5432/thebestappeva_test' }, 'test'),
    /Missing required Postgres configuration: DATABASE_URL\./,
  );
});

test('uses POSTGRES_TEST_DATABASE_URL in test mode when present', () => {
  const config = resolvePostgresConfig({
    databaseUrl: 'postgresql://app:password@127.0.0.1:5432/thebestappeva_dev',
    postgresTestDatabaseUrl: 'postgresql://app:password@127.0.0.1:5432/thebestappeva_test',
  }, 'test');

  assert.equal(config.connectionSource, 'POSTGRES_TEST_DATABASE_URL');
  assert.equal(config.environment, 'test');
});

test('allows DATABASE_URL in test mode only when it is clearly a local test database', () => {
  const config = resolvePostgresConfig({
    databaseUrl: 'postgresql://app:password@localhost:5432/test_thebestappeva',
  }, 'test');

  assert.equal(config.connectionSource, 'DATABASE_URL');
});

test('rejects test database URLs pointing at non-local hosts', () => {
  assert.throws(
    () => assertSafePostgresTestDatabase('postgresql://app:password@db.example.com:5432/thebestappeva_test'),
    /must point at a local Postgres host/,
  );
});

test('rejects test database URLs without a test database name', () => {
  assert.throws(
    () => assertSafePostgresTestDatabase('postgresql://app:password@127.0.0.1:5432/thebestappeva_dev'),
    /database name containing "test"/,
  );
});
