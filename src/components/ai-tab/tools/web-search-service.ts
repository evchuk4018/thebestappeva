interface WebSearchApiResult extends Record<string, unknown> {
  category: string | null;
  engine: string | null;
  publishedDate: string | null;
  score: number | null;
  snippet: string;
  title: string;
  url: string;
}

interface WebSearchResponse extends Record<string, unknown> {
  answer: string | null;
  query: string;
  resultCount: number;
  results: WebSearchApiResult[];
}

interface FetchUrlResponse extends Record<string, unknown> {
  canonicalUrl: string;
  content: string;
  contentType: string | null;
  description: string;
  finalUrl: string;
  status: number;
  title: string;
  truncated: boolean;
}

async function readApiResponse<T>(url: URL, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  const payload = (await response.json().catch(() => null)) as { error?: string } & Partial<T> | null;

  if (!response.ok) {
    throw new Error(payload?.error?.trim() || `Local request failed with ${response.status}.`);
  }

  if (!payload) {
    throw new Error('The local server returned an empty response.');
  }

  return payload as T;
}

export async function searchWeb(params: {
  categories?: string;
  maxResults?: number;
  query: string;
  signal?: AbortSignal;
  timeRange?: string;
}) {
  const url = new URL('/api/web-search', window.location.origin);
  url.searchParams.set('query', params.query);

  if (params.categories) {
    url.searchParams.set('categories', params.categories);
  }

  if (params.timeRange) {
    url.searchParams.set('timeRange', params.timeRange);
  }

  if (typeof params.maxResults === 'number') {
    url.searchParams.set('maxResults', String(params.maxResults));
  }

  return readApiResponse<WebSearchResponse>(url, params.signal);
}

export async function fetchUrl(params: { signal?: AbortSignal; url: string }) {
  const requestUrl = new URL('/api/fetch-url', window.location.origin);
  requestUrl.searchParams.set('url', params.url);
  return readApiResponse<FetchUrlResponse>(requestUrl, params.signal);
}
