import { Request, Response } from 'express';
import { serverConfig } from './config';
import {
  buildTimeoutMessage,
  fetchWithTimeout,
  getOptionalIntParam,
  getOptionalQueryParam,
  getRequiredQueryParam,
  HttpError,
  toErrorMessage,
} from './http';

interface SearxngSearchResult {
  category?: string;
  content?: string;
  engine?: string;
  publishedDate?: string;
  score?: number;
  title?: string;
  url?: string;
}

interface SearxngSearchResponse {
  answers?: string[];
  query?: string;
  results?: SearxngSearchResult[];
}

function mapSearchResult(result: SearxngSearchResult) {
  return {
    title: result.title?.trim() || result.url || 'Untitled result',
    url: result.url ?? '',
    snippet: result.content?.trim() || '',
    engine: result.engine ?? null,
    category: result.category ?? null,
    publishedDate: result.publishedDate ?? null,
    score: typeof result.score === 'number' ? result.score : null,
  };
}

export async function handleWebSearch(req: Request, res: Response) {
  try {
    const query = getRequiredQueryParam(req.query.query, 'query');
    const categories = getOptionalQueryParam(req.query.categories);
    const timeRange = getOptionalQueryParam(req.query.timeRange);
    const maxResults = getOptionalIntParam(req.query.maxResults, serverConfig.maxSearchResults, 1, 10);
    const url = new URL(`${serverConfig.searxngBaseUrl}/search`);

    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('language', 'en-US');

    if (categories) {
      url.searchParams.set('categories', categories);
    }

    if (timeRange) {
      url.searchParams.set('time_range', timeRange);
    }

    const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, serverConfig.webSearchTimeoutMs);
    if (!response.ok) {
      throw new HttpError(response.status, `SearXNG search request failed with ${response.status}.`);
    }

    const payload = (await response.json()) as SearxngSearchResponse;
    const results = (payload.results ?? []).slice(0, maxResults).map(mapSearchResult);

    res.json({
      ok: true,
      query: payload.query ?? query,
      answer: payload.answers?.[0] ?? null,
      resultCount: results.length,
      results,
    });
  } catch (error) {
    const message = toErrorMessage(error, buildTimeoutMessage('search'));
    const statusCode = error instanceof HttpError ? error.statusCode : 502;
    res.status(statusCode).json({ ok: false, error: message });
  }
}
