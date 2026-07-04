import { Pool, type PoolClient, type PoolConfig } from 'pg';
import { resolvePostgresConfig, type PostgresConfigSource, type ResolvedPostgresConfig } from './postgres-config';

let postgresPool: Pool | null = null;
let shutdownHandlersInstalled = false;

function toPoolConfig(config: ResolvedPostgresConfig): PoolConfig {
  return {
    connectionString: config.connectionString,
    max: config.max,
    idleTimeoutMillis: config.idleTimeoutMillis,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
  };
}

export function createPostgresPool(config: ResolvedPostgresConfig = resolvePostgresConfig()) {
  return new Pool(toPoolConfig(config));
}

export function getPostgresPool(source?: PostgresConfigSource, environment = process.env.NODE_ENV) {
  if (!postgresPool) {
    postgresPool = createPostgresPool(resolvePostgresConfig(source, environment));
  }

  return postgresPool;
}

export async function closePostgresPool() {
  if (!postgresPool) {
    return;
  }

  const pool = postgresPool;
  postgresPool = null;
  await pool.end();
}

export async function withPostgresTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  pool = getPostgresPool(),
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function installPostgresPoolShutdownHandlers() {
  if (shutdownHandlersInstalled) {
    return;
  }

  shutdownHandlersInstalled = true;
  let closing = false;

  const closeForSignal = (signal: NodeJS.Signals) => {
    if (closing) {
      return;
    }

    closing = true;
    void closePostgresPool()
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Unable to close Postgres pool.';
        console.error(message);
      })
      .finally(() => {
        process.exit(signal === 'SIGINT' ? 130 : 143);
      });
  };

  process.once('SIGINT', () => closeForSignal('SIGINT'));
  process.once('SIGTERM', () => closeForSignal('SIGTERM'));
  process.once('beforeExit', () => {
    void closePostgresPool();
  });
}
