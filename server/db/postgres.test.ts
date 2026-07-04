import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool, PoolClient } from 'pg';
import { closePostgresPool, createPostgresPool, getPostgresPool, withPostgresTransaction } from './postgres';
import { resolvePostgresConfig } from './postgres-config';

const testSource = {
  databaseUrl: 'postgresql://app:password@127.0.0.1:5432/thebestappeva_test',
  postgresPoolMax: 3,
};

test.afterEach(async () => {
  await closePostgresPool();
});

test('creates a Postgres pool without opening a connection eagerly', async () => {
  const pool = createPostgresPool(resolvePostgresConfig(testSource, 'test'));

  assert.equal(pool.totalCount, 0);
  assert.equal(typeof pool.query, 'function');

  await pool.end();
});

test('reuses and deterministically closes the shared Postgres pool', async () => {
  const firstPool = getPostgresPool(testSource, 'test');
  const secondPool = getPostgresPool(testSource, 'test');

  assert.equal(firstPool, secondPool);

  await closePostgresPool();

  assert.equal((firstPool as unknown as { ended: boolean }).ended, true);
  assert.notEqual(getPostgresPool(testSource, 'test'), firstPool);
});

test('commits successful Postgres transactions', async () => {
  const queries: string[] = [];
  let released = false;
  const client = {
    query: async (sql: string) => {
      queries.push(sql);
      return { rows: [] };
    },
    release: () => {
      released = true;
    },
  } as unknown as PoolClient;
  const pool = { connect: async () => client } as unknown as Pool;

  const result = await withPostgresTransaction(async (transactionClient) => {
    await transactionClient.query('SELECT 1');
    return 'ok';
  }, pool);

  assert.equal(result, 'ok');
  assert.deepEqual(queries, ['BEGIN', 'SELECT 1', 'COMMIT']);
  assert.equal(released, true);
});

test('rolls back failed Postgres transactions', async () => {
  const queries: string[] = [];
  let released = false;
  const client = {
    query: async (sql: string) => {
      queries.push(sql);
      return { rows: [] };
    },
    release: () => {
      released = true;
    },
  } as unknown as PoolClient;
  const pool = { connect: async () => client } as unknown as Pool;

  await assert.rejects(
    () => withPostgresTransaction(async () => {
      throw new Error('boom');
    }, pool),
    /boom/,
  );

  assert.deepEqual(queries, ['BEGIN', 'ROLLBACK']);
  assert.equal(released, true);
});
