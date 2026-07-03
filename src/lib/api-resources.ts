import { useEffect, useState } from 'react';
import { ApiError, requestApi } from './api';

interface ApiResourceState {
  error: string | null;
  objectUrl: string | null;
}

function normalizeResourcePath(path: string) {
  if (!path) {
    throw new Error('A protected API resource path is required.');
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(path) || path.startsWith('//')) {
    const url = new URL(path, 'http://localhost');
    if (url.pathname === '/api') {
      return '/';
    }
    if (url.pathname.startsWith('/api/')) {
      return `${url.pathname.slice('/api'.length)}${url.search}`;
    }
    throw new Error('Only application API resources can be fetched through the authenticated resource helper.');
  }

  return path.startsWith('/api') ? path.slice('/api'.length) || '/' : path;
}

async function createResourceError(response: Response) {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
    ? payload.error
    : `API request failed with ${response.status}.`;
  return new ApiError(message, { payload, status: response.status, url: response.url || null });
}

function readContentDispositionName(response: Response) {
  const header = response.headers.get('content-disposition');
  if (!header) {
    return null;
  }

  const encodedMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1]);
  }

  const quotedMatch = header.match(/filename="?([^";]+)"?/i);
  return quotedMatch?.[1] ?? null;
}

export async function fetchApiBlob(path: string, signal?: AbortSignal) {
  const response = await requestApi(normalizeResourcePath(path), { signal });
  if (!response.ok) {
    throw await createResourceError(response);
  }

  return {
    blob: await response.blob(),
    fileName: readContentDispositionName(response),
    mediaType: response.headers.get('content-type'),
  };
}

export async function downloadApiBlob(path: string, fallbackName: string) {
  const resource = await fetchApiBlob(path);
  const objectUrl = URL.createObjectURL(resource.blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = resource.fileName ?? fallbackName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export function useApiObjectUrl(path: string | null | undefined) {
  const [state, setState] = useState<ApiResourceState>({ error: null, objectUrl: null });

  useEffect(() => {
    if (!path) {
      setState({ error: null, objectUrl: null });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    let activeObjectUrl: string | null = null;

    void fetchApiBlob(path, controller.signal).then(({ blob }) => {
      if (cancelled) {
        return;
      }

      activeObjectUrl = URL.createObjectURL(blob);
      setState({ error: null, objectUrl: activeObjectUrl });
    }).catch((error) => {
      if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError')) {
        setState({ error: error instanceof Error ? error.message : 'Unable to load this resource.', objectUrl: null });
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
      if (activeObjectUrl) {
        URL.revokeObjectURL(activeObjectUrl);
      }
    };
  }, [path]);

  return state;
}
