import dotenv from 'dotenv';
import path from 'node:path';
import { normalizeModelProvider } from '../shared/ai-runtime-contract';

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

const defaultParserCommand = process.platform === 'win32' ? 'py' : 'python3';
const defaultParserArgs = process.platform === 'win32' ? ['-3'] : [];

function readStringListEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value.split(/\s+/).filter(Boolean) : [];
}

export const serverConfig = {
  host: readStringEnv('HOST', '0.0.0.0'),
  port: readNumberEnv('PORT', 3000),
  modelProvider: normalizeModelProvider(process.env.MODEL_PROVIDER),
  ollamaHost: readStringEnv('OLLAMA_HOST', 'http://127.0.0.1:11434').replace(/\/+$/, ''),
  ollamaModel: readStringEnv('OLLAMA_MODEL', 'qwen3.5:9b-q4_K_M'),
  modelLabel: readStringEnv('MODEL_LABEL', 'Qwen 3.5 9B'),
  deepseekBaseUrl: readStringEnv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com').replace(/\/+$/, ''),
  deepseekApiKey: process.env.DEEPSEEK_API_KEY?.trim() || '',
  localDbPath: path.resolve(process.cwd(), readStringEnv('LOCAL_DB_PATH', '.local-data/thebestappeva.sqlite')),
  aiAttachmentStoragePath: path.resolve(process.cwd(), readStringEnv('AI_ATTACHMENT_STORAGE_PATH', '.local-data/ai-attachments')),
  aiAttachmentMaxUploadBytes: readNumberEnv('AI_ATTACHMENT_MAX_UPLOAD_BYTES', 20 * 1024 * 1024),
  aiAttachmentInlineChars: readNumberEnv('AI_ATTACHMENT_INLINE_CHARS', 12000),
  aiAttachmentMaxContextChars: readNumberEnv('AI_ATTACHMENT_MAX_CONTEXT_CHARS', 18000),
  aiAttachmentTopChunks: readNumberEnv('AI_ATTACHMENT_TOP_CHUNKS', 6),
  aiPdfRenderScale: readNumberEnv('AI_PDF_RENDER_SCALE', 1.5),
  aiParserTimeoutMs: readNumberEnv('AI_PARSER_TIMEOUT_MS', 120000),
  aiParserPythonCommand: readStringEnv('AI_PARSER_PYTHON_COMMAND', defaultParserCommand),
  aiParserPythonArgs: readStringListEnv('AI_PARSER_PYTHON_ARGS').length ? readStringListEnv('AI_PARSER_PYTHON_ARGS') : defaultParserArgs,
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
