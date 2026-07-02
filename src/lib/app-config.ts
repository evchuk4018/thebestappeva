export type ApiMode = 'offline' | 'online';

export interface AppConfig {
  apiMode: ApiMode;
  apiBaseUrl: string;
}

let testOverride: Partial<AppConfig> | null = null;

function normalizeApiBaseUrl(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function readBuildTimeApiBaseUrl() {
  const env = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env;
  return normalizeApiBaseUrl(env?.VITE_API_BASE_URL);
}

function resolveApiMode(apiBaseUrl: string, explicitMode?: ApiMode) {
  if (explicitMode) {
    return explicitMode;
  }

  return apiBaseUrl === '/api' ? 'offline' : 'online';
}

export function getAppConfig(): AppConfig {
  const apiBaseUrl = normalizeApiBaseUrl(testOverride?.apiBaseUrl) ?? readBuildTimeApiBaseUrl() ?? '/api';
  const apiMode = resolveApiMode(apiBaseUrl, testOverride?.apiMode);
  return { apiMode, apiBaseUrl };
}

export function getApiMode() {
  return getAppConfig().apiMode;
}

export function getApiBaseUrl() {
  return getAppConfig().apiBaseUrl;
}

export const appConfig = {
  get apiMode() {
    return getApiMode();
  },
  get apiBaseUrl() {
    return getApiBaseUrl();
  },
};

export function setAppConfigForTests(override: Partial<AppConfig> | null) {
  testOverride = override;
}

export function resetAppConfigForTests() {
  testOverride = null;
}
