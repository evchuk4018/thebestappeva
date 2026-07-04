import { serverConfig } from '../config';

export interface PostgresConfigSource {
  databaseUrl: string;
  postgresTestDatabaseUrl?: string;
  postgresPoolMax?: number;
  postgresIdleTimeoutMs?: number;
  postgresConnectionTimeoutMs?: number;
}

export interface ResolvedPostgresConfig {
  connectionString: string;
  connectionSource: 'DATABASE_URL' | 'POSTGRES_TEST_DATABASE_URL';
  environment: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

const localTestHosts = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'postgres-test',
  'thebestappeva-postgres-test',
]);

function normalizeEnvironment(environment = process.env.NODE_ENV) {
  return environment === 'test' || environment === 'production' ? environment : 'development';
}

function normalizeConnectionString(value: string | undefined) {
  return value?.trim() ?? '';
}

function parsePostgresUrl(connectionString: string, variableName: string) {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error(`${variableName} must be a valid Postgres connection URL.`);
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error(`${variableName} must use the postgres:// or postgresql:// protocol.`);
  }

  return parsed;
}

function isClearlyTestDatabaseName(pathname: string) {
  const databaseName = decodeURIComponent(pathname.replace(/^\/+/, '')).toLowerCase();
  return /(^|[_-])test($|[_-])/.test(databaseName);
}

export function assertSafePostgresTestDatabase(connectionString: string, variableName = 'DATABASE_URL') {
  const parsed = parsePostgresUrl(connectionString, variableName);
  const hostname = parsed.hostname.toLowerCase();

  if (!localTestHosts.has(hostname)) {
    throw new Error(`${variableName} for tests must point at a local Postgres host.`);
  }

  if (!isClearlyTestDatabaseName(parsed.pathname)) {
    throw new Error(`${variableName} for tests must use a database name containing "test".`);
  }
}

export function resolvePostgresConfig(
  source: PostgresConfigSource = serverConfig,
  environment = process.env.NODE_ENV,
): ResolvedPostgresConfig {
  const normalizedEnvironment = normalizeEnvironment(environment);
  const databaseUrl = normalizeConnectionString(source.databaseUrl);
  const testDatabaseUrl = normalizeConnectionString(source.postgresTestDatabaseUrl);

  if (!databaseUrl) {
    throw new Error('Missing required Postgres configuration: DATABASE_URL.');
  }

  const connectionSource = normalizedEnvironment === 'test' && testDatabaseUrl
    ? 'POSTGRES_TEST_DATABASE_URL'
    : 'DATABASE_URL';
  const connectionString = connectionSource === 'POSTGRES_TEST_DATABASE_URL' ? testDatabaseUrl : databaseUrl;

  parsePostgresUrl(connectionString, connectionSource);

  if (normalizedEnvironment === 'test') {
    assertSafePostgresTestDatabase(connectionString, connectionSource);
  }

  return {
    connectionString,
    connectionSource,
    environment: normalizedEnvironment,
    max: source.postgresPoolMax ?? 10,
    idleTimeoutMillis: source.postgresIdleTimeoutMs ?? 30000,
    connectionTimeoutMillis: source.postgresConnectionTimeoutMs ?? 5000,
  };
}

export function validatePostgresConfig(source: PostgresConfigSource = serverConfig, environment = process.env.NODE_ENV) {
  return resolvePostgresConfig(source, environment);
}
