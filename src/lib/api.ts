import { getApiBaseUrl } from './app-config';

export type ApiQueryValue = string | number | boolean | null | undefined;

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | null;
  json?: unknown;
  query?: Record<string, ApiQueryValue>;
}

export class ApiError extends Error {
  payload: unknown;
  status: number | null;
  url: string | null;

  constructor(message: string, options: { payload?: unknown; status?: number | null; url?: string | null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.payload = options.payload;
    this.status = options.status ?? null;
    this.url = options.url ?? null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractErrorMessage(payload: unknown) {
  return isRecord(payload) && typeof payload.error === 'string' && payload.error.trim() ? payload.error.trim() : null;
}

function normalizeApiPath(path: string) {
  if (!path || path === '/') {
    return '';
  }

  return path.startsWith('/') ? path : `/${path}`;
}

function applyQuery(searchParams: URLSearchParams, query?: Record<string, ApiQueryValue>) {
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  }
}

function buildRelativeApiUrl(baseUrl: string, path: string, query?: Record<string, ApiQueryValue>) {
  const url = new URL(`${baseUrl}${normalizeApiPath(path)}`, 'http://localhost');
  applyQuery(url.searchParams, query);
  return `${url.pathname}${url.search}`;
}

function isAbsoluteUrl(value: string) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) || value.startsWith('//');
}

function createInvalidJsonError(rawBody: string, response: Response) {
  const detail = /^\s*</.test(rawBody) ? 'HTML instead of JSON' : 'invalid JSON';
  return new ApiError(`The API returned ${detail}. The app and API may be out of sync.`, {
    status: response.status,
    url: response.url || null,
  });
}

function createResponseError(response: Response, payload: unknown) {
  return new ApiError(extractErrorMessage(payload) ?? `API request failed with ${response.status}.`, {
    payload,
    status: response.status,
    url: response.url || null,
  });
}

function buildRequestInit(options: ApiRequestOptions) {
  const headers = new Headers(options.headers ?? undefined);
  const requestInit: RequestInit = {
    ...options,
    headers,
  };

  delete (requestInit as RequestInit & { json?: unknown; query?: Record<string, ApiQueryValue> }).json;
  delete (requestInit as RequestInit & { json?: unknown; query?: Record<string, ApiQueryValue> }).query;

  if (typeof options.json !== 'undefined') {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    requestInit.body = JSON.stringify(options.json);
  }

  return requestInit;
}

export function resolveApiUrl(path: string, query?: Record<string, ApiQueryValue>) {
  const apiBaseUrl = getApiBaseUrl();
  if (!isAbsoluteUrl(apiBaseUrl)) {
    return buildRelativeApiUrl(apiBaseUrl, path, query);
  }

  const baseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`;
  const url = new URL(normalizeApiPath(path).slice(1), baseUrl);
  applyQuery(url.searchParams, query);
  return url.toString();
}

export function resolveApiAssetUrl(path: string | null | undefined) {
  if (!path || isAbsoluteUrl(path)) {
    return path ?? '';
  }

  if (path.startsWith('/api')) {
    return resolveApiUrl(path.slice('/api'.length));
  }

  return path;
}

export async function requestApi(path: string, options: ApiRequestOptions = {}) {
  return fetch(resolveApiUrl(path, options.query), buildRequestInit(options));
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('The API returned invalid JSON.', {
      status: response.status,
      url: response.url || null,
    });
  }

  if (!response.ok) {
    throw createResponseError(response, payload);
  }

  return payload as T;
}

export async function readJsonTextResponse<T>(
  response: Response,
  options: { rejectOkFalse?: boolean; unsuccessfulMessage?: string } = {},
): Promise<T> {
  const rawBody = await response.text();
  let payload: unknown;

  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    throw createInvalidJsonError(rawBody, response);
  }

  if (!response.ok) {
    throw createResponseError(response, payload);
  }

  if (options.rejectOkFalse && isRecord(payload) && payload.ok === false) {
    throw new ApiError(extractErrorMessage(payload) ?? options.unsuccessfulMessage ?? 'The API reported an unsuccessful response.', {
      payload,
      status: response.status,
      url: response.url || null,
    });
  }

  return payload as T;
}

export async function requestJson<T>(path: string, options: ApiRequestOptions = {}) {
  return readJsonResponse<T>(await requestApi(path, options));
}

export async function requestReadableStream(path: string, options: ApiRequestOptions = {}) {
  const response = await requestApi(path, options);
  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw createResponseError(response, payload);
  }

  if (!response.body) {
    throw new ApiError('The API did not return a readable response body.', {
      status: response.status,
      url: response.url || null,
    });
  }

  return response;
}

export async function streamJsonLines<T>(path: string, onChunk: (chunk: T) => void, options: ApiRequestOptions = {}) {
  const response = await requestReadableStream(path, options);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      let payload: T;
      try {
        payload = JSON.parse(trimmed) as T;
      } catch {
        throw new ApiError('The API returned invalid JSON.', {
          status: response.status,
          url: response.url || null,
        });
      }

      onChunk(payload);
    }
  }

  if (buffer.trim()) {
    try {
      onChunk(JSON.parse(buffer.trim()) as T);
    } catch {
      throw new ApiError('The API returned invalid JSON.', {
        status: response.status,
        url: response.url || null,
      });
    }
  }
}
