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
import { requestJson } from '../../../lib/api';

export async function searchWeb(params: {
  categories?: string;
  maxResults?: number;
  query: string;
  signal?: AbortSignal;
  timeRange?: string;
}) {
  return requestJson<WebSearchResponse>('/web-search', {
    query: {
      query: params.query,
      categories: params.categories,
      timeRange: params.timeRange,
      maxResults: params.maxResults,
    },
    signal: params.signal,
  });
}

export async function fetchUrl(params: { signal?: AbortSignal; url: string }) {
  return requestJson<FetchUrlResponse>('/fetch-url', { query: { url: params.url }, signal: params.signal });
}
