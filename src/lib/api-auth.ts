import { getApiBaseUrl } from './app-config';

type AuthFailureReason = 'refresh-failed' | 'unauthorized';

interface ApiAuthBridge {
  getAccessToken: () => Promise<string | null>;
  refreshAccessToken: () => Promise<string | null>;
  onAuthFailure: (reason: AuthFailureReason) => Promise<void> | void;
}

const defaultBridge: ApiAuthBridge = {
  getAccessToken: async () => null,
  refreshAccessToken: async () => null,
  onAuthFailure: async () => undefined,
};

let apiAuthBridge = defaultBridge;
let refreshInFlight: Promise<string | null> | null = null;

function toUrl(value: string) {
  return new URL(value, 'http://localhost');
}

function normalizeBaseUrl(value: string) {
  const parsed = toUrl(value);
  const pathname = parsed.pathname.endsWith('/') ? parsed.pathname.slice(0, -1) : parsed.pathname;
  return { origin: parsed.origin, pathname };
}

function shouldAttachAuth(url: string) {
  const target = toUrl(url);
  const apiBase = normalizeBaseUrl(getApiBaseUrl());
  return target.origin === apiBase.origin && (target.pathname === apiBase.pathname || target.pathname.startsWith(`${apiBase.pathname}/`));
}

async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = apiAuthBridge.refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

async function attachAuthorization(headers: Headers, explicitAuthorization: string | null) {
  if (explicitAuthorization || headers.has('Authorization')) {
    return headers;
  }

  const token = await apiAuthBridge.getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

async function buildAuthenticatedRequestInit(requestInit: RequestInit) {
  const headers = new Headers(requestInit.headers ?? undefined);
  const explicitAuthorization = headers.get('Authorization');
  await attachAuthorization(headers, explicitAuthorization);
  return { ...requestInit, headers } satisfies RequestInit;
}

async function retryWithRefresh(url: string, requestInit: RequestInit) {
  try {
    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) {
      await apiAuthBridge.onAuthFailure('refresh-failed');
      return null;
    }

    const retryHeaders = new Headers(requestInit.headers ?? undefined);
    retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);
    const retriedResponse = await fetch(url, { ...requestInit, headers: retryHeaders });
    if (retriedResponse.status === 401) {
      await apiAuthBridge.onAuthFailure('unauthorized');
    }
    return retriedResponse;
  } catch {
    await apiAuthBridge.onAuthFailure('refresh-failed');
    return null;
  }
}

export async function fetchApiWithAuth(url: string, requestInit: RequestInit) {
  if (!shouldAttachAuth(url)) {
    return fetch(url, requestInit);
  }

  const hasExplicitAuthorization = new Headers(requestInit.headers ?? undefined).has('Authorization');
  const authenticatedRequestInit = await buildAuthenticatedRequestInit(requestInit);
  const response = await fetch(url, authenticatedRequestInit);
  if (response.status !== 401 || hasExplicitAuthorization) {
    return response;
  }

  const retriedResponse = await retryWithRefresh(url, requestInit);
  return retriedResponse ?? response;
}

export function registerApiAuthBridge(bridge: Partial<ApiAuthBridge> | null) {
  apiAuthBridge = bridge
    ? {
        getAccessToken: bridge.getAccessToken ?? defaultBridge.getAccessToken,
        refreshAccessToken: bridge.refreshAccessToken ?? defaultBridge.refreshAccessToken,
        onAuthFailure: bridge.onAuthFailure ?? defaultBridge.onAuthFailure,
      }
    : defaultBridge;
}

export function resetApiAuthBridgeForTests() {
  apiAuthBridge = defaultBridge;
  refreshInFlight = null;
}
