import dotenv from 'dotenv';

dotenv.config();

function readNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readStringEnv(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export const serverConfig = {
  host: readStringEnv('HOST', '0.0.0.0'),
  port: readNumberEnv('PORT', 3000),
  searxngBaseUrl: readStringEnv('SEARXNG_BASE_URL', 'http://127.0.0.1:8888').replace(/\/+$/, ''),
  webSearchTimeoutMs: readNumberEnv('WEB_SEARCH_TIMEOUT_MS', 10000),
  urlFetchTimeoutMs: readNumberEnv('URL_FETCH_TIMEOUT_MS', 12000),
  maxSearchResults: readNumberEnv('WEB_SEARCH_MAX_RESULTS', 8),
  maxFetchedChars: readNumberEnv('URL_FETCH_MAX_CHARS', 12000),
  fetchUserAgent: readStringEnv(
    'URL_FETCH_USER_AGENT',
    'thebestappeva/1.0 (+local-ai-fetch; https://localhost)',
  ),
};
