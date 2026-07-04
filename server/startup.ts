import { readServerAuthConfig, validateResolvedServerAuthConfig, type ServerAuthConfig } from './auth/config';
import { validatePostgresConfig, type PostgresConfigSource } from './db/postgres-config';

interface StartupConfigOptions {
  authConfig?: ServerAuthConfig;
  environment?: string;
  postgresConfig?: PostgresConfigSource;
}

export function validateServerStartupConfig(options: StartupConfigOptions = {}) {
  const environment = options.environment ?? process.env.NODE_ENV;
  const postgres = validatePostgresConfig(options.postgresConfig, environment);
  const auth = validateResolvedServerAuthConfig(options.authConfig ?? readServerAuthConfig(), environment);

  return { auth, postgres };
}
