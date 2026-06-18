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

function createCombinedSignal(signals: Array<AbortSignal | undefined>) {
  const controller = new AbortController();
  const cleanups: Array<() => void> = [];
  for (const signal of signals) {
    if (!signal) {
      continue;
    }
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    const onAbort = () => {
      if (!controller.signal.aborted) {
        controller.abort(signal.reason);
      }
    };
    signal.addEventListener('abort', onAbort, { once: true });
    cleanups.push(() => signal.removeEventListener('abort', onAbort));
  }
  return {
    signal: controller.signal,
    cleanup() {
      cleanups.forEach((cleanup) => cleanup());
    },
  };
}

export async function fetchWithTimeout(url: string | URL, init: RequestInit, timeoutMs: number, signal?: AbortSignal) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const combined = createCombinedSignal([signal, timeoutSignal]);
  try {
    return await fetch(url, {
      ...init,
      signal: combined.signal,
    });
  } finally {
    combined.cleanup();
  }
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
