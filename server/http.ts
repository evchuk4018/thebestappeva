import { serverConfig } from './config';

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

export function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.name === 'TimeoutError' ? fallback : error.message;
  }

  return fallback;
}

export async function fetchWithTimeout(url: string | URL, init: RequestInit, timeoutMs: number) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export function getRequiredQueryParam(value: unknown, name: string) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new HttpError(400, `Missing required "${name}" query parameter.`);
  }

  return normalized;
}

export function getOptionalQueryParam(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getOptionalIntParam(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export function buildTimeoutMessage(kind: 'search' | 'fetch') {
  return kind === 'search'
    ? `Web search timed out after ${serverConfig.webSearchTimeoutMs}ms.`
    : `URL fetch timed out after ${serverConfig.urlFetchTimeoutMs}ms.`;
}
