import { serverConfig } from '../config';

interface ServerAuthConfigSource {
  appOwnerEmail: string;
  supabaseAnonKey: string;
  supabaseUrl: string;
}

export interface ServerAuthConfig {
  ownerEmail: string;
  supabaseAnonKey: string;
  supabaseUrl: string;
}

export function normalizeEmail(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function readServerAuthConfig(config: ServerAuthConfigSource = serverConfig): ServerAuthConfig {
  return {
    ownerEmail: normalizeEmail(config.appOwnerEmail),
    supabaseAnonKey: config.supabaseAnonKey.trim(),
    supabaseUrl: config.supabaseUrl.trim(),
  };
}

export function validateServerAuthConfig(config: ServerAuthConfigSource = serverConfig, environment = process.env.NODE_ENV) {
  return validateResolvedServerAuthConfig(readServerAuthConfig(config), environment);
}

export function validateResolvedServerAuthConfig(authConfig: ServerAuthConfig, environment = process.env.NODE_ENV) {
  const missing = [
    !authConfig.supabaseUrl ? 'SUPABASE_URL' : null,
    !authConfig.supabaseAnonKey ? 'SUPABASE_ANON_KEY' : null,
    !authConfig.ownerEmail ? 'APP_OWNER_EMAIL' : null,
  ].filter(Boolean) as string[];

  if (environment === 'production' && missing.length) {
    throw new Error(`Missing required authentication configuration: ${missing.join(', ')}.`);
  }

  return authConfig;
}
