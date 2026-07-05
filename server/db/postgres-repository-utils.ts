import type { Pool, PoolClient, QueryResult } from 'pg';
import { HttpError } from '../http';
import { getPostgresPool, withPostgresTransaction } from './postgres';

export type PostgresExecutor = {
  query: (text: string, values?: unknown[]) => Promise<QueryResult>;
};

export function assertOwnerUuid(ownerId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId)) {
    throw new HttpError(500, 'Authenticated owner id is not a valid UUID.');
  }

  return ownerId;
}

export function getOwnerUuidFromRequestContext(userId: string) {
  return assertOwnerUuid(userId);
}

export function normalizeJsonb(value: unknown) {
  return value;
}

export function toJsonbParam(value: unknown) {
  return JSON.stringify(value);
}

export function toIsoString(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

export function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : Boolean(value);
}

export function isPool(executor: PostgresExecutor | Pool | PoolClient): executor is Pool {
  return typeof (executor as Pool).connect === 'function';
}

export async function runPostgresTransaction<T>(
  executor: PostgresExecutor | Pool | PoolClient = getPostgresPool(),
  callback: (client: PoolClient) => Promise<T>,
) {
  if (isPool(executor)) {
    return withPostgresTransaction(callback, executor);
  }

  return callback(executor as PoolClient);
}
