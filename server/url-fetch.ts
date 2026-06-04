import { Request, Response } from 'express';
import { serverConfig } from './config';
import { extractHtmlDocument } from './html-content';
import {
  buildTimeoutMessage,
  fetchWithTimeout,
  getRequiredQueryParam,
  HttpError,
  toErrorMessage,
} from './http';

function normalizeUrl(rawUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new HttpError(400, 'URL fetch requires a valid absolute URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new HttpError(400, 'Only http and https URLs are supported.');
  }

  return parsed;
}

function isHtmlContentType(contentType: string | null) {
  return Boolean(contentType && /text\/html|application\/xhtml\+xml/i.test(contentType));
}

export async function handleUrlFetch(req: Request, res: Response) {
  try {
    const targetUrl = normalizeUrl(getRequiredQueryParam(req.query.url, 'url'));
    const response = await fetchWithTimeout(
      targetUrl,
      {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': serverConfig.fetchUserAgent,
        },
        redirect: 'follow',
      },
      serverConfig.urlFetchTimeoutMs,
    );

    if (!response.ok) {
      throw new HttpError(response.status, `URL fetch failed with ${response.status}.`);
    }

    const contentType = response.headers.get('content-type');
    if (!isHtmlContentType(contentType)) {
      throw new HttpError(415, 'Only HTML pages are supported by fetch_url in this version.');
    }

    const html = await response.text();
    const extracted = extractHtmlDocument(html, serverConfig.maxFetchedChars);
    if (!extracted.content) {
      throw new HttpError(422, 'The page loaded, but no readable HTML text could be extracted.');
    }

    res.json({
      ok: true,
      finalUrl: response.url || targetUrl.toString(),
      contentType,
      status: response.status,
      ...extracted,
    });
  } catch (error) {
    const message = toErrorMessage(error, buildTimeoutMessage('fetch'));
    const statusCode = error instanceof HttpError ? error.statusCode : 502;
    res.status(statusCode).json({ ok: false, error: message });
  }
}
